// Channex inbound bookings — apply one revision to the PMS. Shared by the feed
// poller and the webhook handler. Runs with the service client (no user
// context), so it must resolve the org itself and never trust the caller.
//
// Rules (see the channex-pms-integration skill, "Inbound bookings"):
//   - dedupe by Channex booking_id stored in reservations.external_id
//   - map property_id / room_type_id back through channel_provider_links;
//     skip revisions for properties we don't own
//   - new     -> create reservation (multi-bed atomic RPC, real prices)
//   - cancelled -> find by external_id, cancel
//   - modified  -> DO NOT auto-apply date/room/price changes to a live
//     calendar; flag + notify a human (no reconciliation UX yet)
//   - overbooking (not enough free beds) -> create nothing, notify loudly

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex, type RevisionAttributes } from "./channex";
import { pushAvailabilityForOrg } from "./channex-availability";
import { notifyOrg } from "@/lib/notifications";

// After an inbound booking changes the calendar, push the affected date window
// so OTAs see the new availability. Scoped to the stay window (cheap), all room
// types. Awaited-but-swallowed: a push failure must not block the ack — the
// periodic reconcile corrects any drift.
async function pushWindow(supabase: SupabaseClient, orgId: string, from?: string, to?: string): Promise<void> {
  if (!from || !to) return;
  try {
    await pushAvailabilityForOrg(supabase, orgId, { from, to });
  } catch (err) {
    console.error("channex availability push failed:", err);
  }
}

// Keys are the OTA name reduced to lowercase alphanumerics, so "Booking.com",
// "BookingCom" and "booking.com" all collapse to "bookingcom".
const OTA_PLATFORM: Record<string, string> = {
  bookingcom: "booking_com",
  airbnb: "airbnb",
  vrbo: "vrbo",
  homeaway: "vrbo",
  expedia: "expedia",
  hostelworld: "hostelworld",
};

function normalizeOta(otaName?: string): string {
  if (!otaName) return "other";
  const key = otaName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return OTA_PLATFORM[key] ?? "other";
}

export type ApplyAction = "created" | "cancelled" | "modified_flagged" | "skipped" | "overbooking" | "error";

export interface ApplyResult {
  action: ApplyAction;
  bookingId: string;
  reservationId?: string;
  warning?: string;
}

async function reverseLink(
  supabase: SupabaseClient,
  kind: string,
  channexId: string
): Promise<{ organization_id: string; local_id: string } | null> {
  const { data } = await supabase
    .from("channel_provider_links")
    .select("organization_id, local_id")
    .eq("kind", kind)
    .eq("channex_id", channexId)
    .maybeSingle();
  return (data as { organization_id: string; local_id: string } | null) ?? null;
}

export async function applyRevision(
  supabase: SupabaseClient,
  attrs: RevisionAttributes
): Promise<ApplyResult> {
  const bookingId = attrs.booking_id;
  try {
    // 1. Whose property is this? Skip anything not in our mapping.
    const propLink = await reverseLink(supabase, "property", attrs.property_id);
    if (!propLink) return { action: "skipped", bookingId, warning: "property not mapped to any org" };
    const orgId = propLink.organization_id;

    const platform = normalizeOta(attrs.ota_name);
    const otaCode = attrs.ota_reservation_code ? ` (${attrs.ota_reservation_code})` : "";

    // 2. Existing reservation for this booking? (dedupe / cancel / modify)
    const { data: existing } = await supabase
      .from("reservations")
      .select("id, status, guest_id")
      .eq("organization_id", orgId)
      .eq("external_id", bookingId)
      .maybeSingle();

    // 3. Cancellation.
    if (attrs.status === "cancelled") {
      if (existing && (existing as any).status !== "cancelled") {
        await supabase
          .from("reservations")
          .update({ status: "cancelled", external_sync_at: new Date().toISOString() })
          .eq("id", (existing as any).id);
        await notify(supabase, orgId, "reservation_cancelled", (existing as any).id, attrs);
        await pushWindow(supabase, orgId, attrs.arrival_date, attrs.departure_date);
        return { action: "cancelled", bookingId, reservationId: (existing as any).id };
      }
      return { action: "skipped", bookingId, warning: "cancel for unknown/already-cancelled booking" };
    }

    // 4. Modification of a booking we already hold — do NOT mutate the live
    //    calendar automatically; flag for a human.
    if (attrs.status === "modified" && existing) {
      await notifyOrg(
        orgId,
        "channel_sync_failed",
        {
          channelName: `${attrs.ota_name ?? "OTA"}${otaCode}`,
          reason: `Booking MODIFIED on ${attrs.ota_name ?? "OTA"} — review manually (dates/rooms/price may have changed). Booking ${bookingId}.`,
        },
        "/reservations"
      );
      return { action: "modified_flagged", bookingId, reservationId: (existing as any).id };
    }

    // 5. New booking (or a modification we don't yet hold → treat as new).
    if (existing) return { action: "skipped", bookingId, warning: "already imported" };

    // Map the room type. A booking can list several rooms; v1 assigns from the
    // first mapped room type with quantity = number of room entries. Mixed
    // types are flagged (rare for hostels).
    const rooms = attrs.rooms ?? [];
    if (rooms.length === 0) return { action: "error", bookingId, warning: "no rooms in revision" };

    const firstChannexRt = rooms[0].room_type_id;
    if (!firstChannexRt) return { action: "error", bookingId, warning: "room has no room_type_id" };
    const rtLink = await reverseLink(supabase, "room_type", firstChannexRt);
    if (!rtLink || rtLink.organization_id !== orgId) {
      return { action: "error", bookingId, warning: `room_type ${firstChannexRt} not mapped` };
    }
    const localRoomTypeId = rtLink.local_id;
    const mixedTypes = rooms.some((r) => r.room_type_id && r.room_type_id !== firstChannexRt);
    const quantity = rooms.length;

    // Dates: prefer per-room, fall back to booking-level.
    const checkIn = rooms[0].checkin_date || attrs.arrival_date;
    const checkOut = rooms[0].checkout_date || attrs.departure_date;
    if (!checkIn || !checkOut) return { action: "error", bookingId, warning: "missing dates" };

    // Money: booking-level total, split to a nightly per-bed figure.
    const total = Number(attrs.amount ?? 0) || 0;
    const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
    const pricePerNight = quantity > 0 && nights > 0 ? total / quantity / nights : 0;

    // Guest: create from the real customer details.
    const guestId = await upsertGuest(supabase, orgId, platform, attrs);

    const { data: newResId, error: rpcErr } = await supabase.rpc("create_channex_reservation", {
      p_organization_id: orgId,
      p_guest_id: guestId,
      p_channel_source: platform,
      p_external_id: bookingId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_notes: `${attrs.ota_name ?? "OTA"}${otaCode}${mixedTypes ? " — MIXED room types, review" : ""}`,
      p_room_type_id: localRoomTypeId,
      p_quantity: quantity,
      p_price_per_night: pricePerNight,
      p_total_price: total,
    });

    if (rpcErr) return { action: "error", bookingId, warning: rpcErr.message };

    if (!newResId) {
      // Overbooking — not enough free beds. Never drop the booking silently.
      await notifyOrg(
        orgId,
        "channel_sync_failed",
        {
          channelName: `${attrs.ota_name ?? "OTA"}${otaCode}`,
          reason: `OVERBOOKING: no ${quantity} free bed(s) for ${checkIn} → ${checkOut}. Booking ${bookingId} needs manual placement.`,
        },
        "/reservations"
      );
      return { action: "overbooking", bookingId, warning: "no free beds" };
    }

    await notify(supabase, orgId, "reservation_created", newResId as string, attrs);
    await pushWindow(supabase, orgId, checkIn, checkOut);
    return { action: "created", bookingId, reservationId: newResId as string, warning: mixedTypes ? "mixed room types" : undefined };
  } catch (err) {
    return { action: "error", bookingId, warning: err instanceof Error ? err.message : "unknown error" };
  }
}

export interface DrainSummary {
  processed: number;
  acked: number;
  byAction: Record<string, number>;
  errors: { bookingId: string; warning?: string }[];
}

// Drain the account-wide revision feed: apply each, ack on success, leave
// hard errors un-acked for retry within the 30-minute window (and surface
// them). Bounded iterations so a poison revision can't spin forever.
export async function drainFeed(supabase: SupabaseClient): Promise<DrainSummary> {
  const summary: DrainSummary = { processed: 0, acked: 0, byAction: {}, errors: [] };
  const MAX_ITER = 25;

  for (let i = 0; i < MAX_ITER; i++) {
    const page = await channex.bookingFeed(1); // acked items leave the feed
    const items = page.data ?? [];
    if (items.length === 0) break;

    let ackedThisPage = 0;
    for (const rev of items) {
      const res = await applyRevision(supabase, rev.attributes);
      summary.processed++;
      summary.byAction[res.action] = (summary.byAction[res.action] ?? 0) + 1;

      if (res.action === "error") {
        // Leave un-acked so it retries; alert so the cause is fixed before the
        // 30-minute window closes and the revision is lost for good.
        summary.errors.push({ bookingId: res.bookingId, warning: res.warning });
        continue;
      }
      await channex.ackRevision(rev.id);
      summary.acked++;
      ackedThisPage++;
    }

    // Nothing acked this pass ⇒ only errored revisions remain; stop and let the
    // next tick retry rather than looping on the same failures.
    if (ackedThisPage === 0) break;
    // Drained everything that was pending at fetch time.
    if (page.meta && page.meta.total <= items.length) break;
  }

  return summary;
}

async function upsertGuest(
  supabase: SupabaseClient,
  orgId: string,
  platform: string,
  attrs: RevisionAttributes
): Promise<string | null> {
  const c = attrs.customer ?? {};
  const first = (c.name || "").trim() || otaGuestName(attrs.ota_name);
  const last = (c.surname || "").trim() || `[${platform}]`;

  // Match an existing guest by email when we have one, else create.
  if (c.mail) {
    const { data: match } = await supabase
      .from("guests")
      .select("id")
      .eq("organization_id", orgId)
      .eq("email", c.mail)
      .maybeSingle();
    if (match) return (match as any).id;
  }

  const { data: created } = await supabase
    .from("guests")
    .insert({
      organization_id: orgId,
      first_name: first,
      last_name: last,
      email: c.mail || null,
      phone: c.phone || null,
      country_of_residence: c.country || null,
      notes: `Imported from ${attrs.ota_name ?? "OTA"} — booking ${attrs.booking_id}${
        attrs.ota_reservation_code ? `, code ${attrs.ota_reservation_code}` : ""
      }`,
    })
    .select("id")
    .single();
  return (created as any)?.id ?? null;
}

function otaGuestName(otaName?: string): string {
  return otaName ? `${otaName} Guest` : "OTA Guest";
}

async function notify(
  supabase: SupabaseClient,
  orgId: string,
  type: "reservation_created" | "reservation_cancelled",
  reservationId: string,
  attrs: RevisionAttributes
): Promise<void> {
  try {
    const { data: r } = await supabase
      .from("reservations")
      .select("reservation_number, guests(first_name, last_name)")
      .eq("id", reservationId)
      .single();
    const g: any = (r as any)?.guests;
    const fallback = attrs.customer?.name
      ? `${attrs.customer.name} ${attrs.customer.surname ?? ""}`.trim()
      : otaGuestName(attrs.ota_name);
    await notifyOrg(
      orgId,
      type,
      {
        guestName: g ? `${g.first_name} ${g.last_name}` : fallback,
        reservationNumber: (r as any)?.reservation_number ?? "",
        roomName: attrs.ota_name ?? "OTA",
      },
      "/calendar"
    );
  } catch (err) {
    console.error("channex notify failed:", err);
  }
}
