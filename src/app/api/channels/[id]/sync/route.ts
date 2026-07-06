import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { notifyOrg } from "@/lib/notifications";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ical = require("node-ical");

const PLATFORM_GUEST_NAMES: Record<string, string> = {
  booking_com: "Booking.com Guest",
  airbnb: "Airbnb Guest",
  vrbo: "VRBO Guest",
  expedia: "Expedia Guest",
  hostelworld: "Hostelworld Guest",
  direct: "Direct Guest",
  other: "External Guest",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Declared outside the try block (not just before it) so the outer catch
  // can safely read it even if the failure happens before it's assigned.
  let orgId: string | undefined;
  try {
    const { id } = await params;
    const serviceClient = await createServiceClient();

    // Allow cron/sync-all to bypass user auth via Bearer token
    const auth = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    const isCron = !!secret && auth === `Bearer ${secret}`;

    if (isCron) {
      const { data: channel } = await serviceClient
        .from("channels")
        .select("organization_id")
        .eq("id", id)
        .single();
      if (!channel) return Response.json({ error: "Channel not found" }, { status: 404 });
      orgId = channel.organization_id;
    } else {
      const supabase = await createServerClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

      const { data: membership } = await supabase
        .from("memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();
      if (!membership) return Response.json({ error: "No organization" }, { status: 403 });
      orgId = (membership as any).organization_id;
    }

    if (!orgId) {
      return Response.json({ error: "Organization not resolved" }, { status: 500 });
    }

    // Get channel and verify ownership
    const { data: channel, error: channelError } = await serviceClient
      .from("channels")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (channelError || !channel) {
      return Response.json({ error: "Channel not found" }, { status: 404 });
    }

    if (!channel.ical_url) {
      return Response.json({ error: "No iCal URL configured" }, { status: 400 });
    }

    // Fetch iCal feed
    let events: Record<string, any>;
    try {
      events = await ical.async.fromURL(channel.ical_url);
    } catch (err: any) {
      await serviceClient
        .from("channels")
        .update({ last_error: `Failed to fetch feed: ${err.message}`, updated_at: new Date().toISOString() })
        .eq("id", id);
      await notifyOrg(
        orgId,
        "channel_sync_failed",
        { channelName: channel?.name ?? "channel", reason: err.message },
        "/channels"
      );
      return Response.json({ error: "Failed to fetch iCal feed" }, { status: 422 });
    }

    // Mapping: legacy per-bed channels book one fixed bed; room-type channels
    // auto-assign any free bed from the room type's pool (like real CMs).
    const roomTypeId: string | null = channel.mapping_mode === "room_type" ? channel.room_type_id : null;
    const isRoomType = roomTypeId !== null;
    const syncBedId: string | null = channel.bed_id || null;
    if (!isRoomType && !syncBedId) {
      return Response.json({ error: "No bed assigned to this channel. Edit the channel and select a bed (or map it to a room type) first." }, { status: 400 });
    }

    const MAX_EVENTS = 500;
    const results = { created: 0, updated: 0, cancelled: 0, skipped: 0, errors: 0 };
    const syncedExternalIds: string[] = [];

    const allEntries = Object.entries(events);
    if (allEntries.length > MAX_EVENTS) {
      console.warn(`[sync] Channel ${id} feed has ${allEntries.length} events, capping at ${MAX_EVENTS}`);
    }

    for (const [, event] of allEntries.slice(0, MAX_EVENTS)) {
      if (event.type !== "VEVENT") continue;

      const externalId = event.uid;
      if (!externalId) { results.skipped++; continue; }

      const start = event.start ? new Date(event.start) : null;
      const end = event.end ? new Date(event.end) : null;
      if (!start || !end) { results.skipped++; continue; }

      const isCancelled = event.status === "CANCELLED";
      const checkIn = start.toISOString().split("T")[0];
      const checkOut = end.toISOString().split("T")[0];
      const summary = event.summary || PLATFORM_GUEST_NAMES[channel.platform] || "External Guest";

      syncedExternalIds.push(externalId);

      // Check if reservation already exists for this channel + external_id
      const { data: existing } = await serviceClient
        .from("reservations")
        .select("id, status, guest_id")
        .eq("channel_id", id)
        .eq("external_id", externalId)
        .single();

      if (isCancelled) {
        if (existing && existing.status !== "cancelled") {
          await serviceClient
            .from("reservations")
            .update({ status: "cancelled", external_sync_at: new Date().toISOString() })
            .eq("id", existing.id);
          results.cancelled++;
        } else {
          results.skipped++;
        }
        continue;
      }

      // Dedup guest by external_id: reuse existing reservation's guest, create once per new UID
      let guestId: string | null = existing?.guest_id || null;
      if (!guestId) {
        const { data: newGuest } = await serviceClient
          .from("guests")
          .insert({
            organization_id: orgId,
            first_name: summary,
            last_name: `[${channel.platform}]`,
            notes: `Auto-created from ${channel.name} — ${externalId}`,
          })
          .select("id")
          .single();
        guestId = newGuest?.id || null;
      }

      if (existing) {
        // Room-type channels: if the OTA moved the dates, the assigned bed may
        // now clash with another booking — reassign to a free bed in the pool.
        if (isRoomType) {
          const { data: curItem } = await serviceClient
            .from("reservation_items")
            .select("id, bed_id")
            .eq("reservation_id", existing.id)
            .limit(1)
            .single();

          if (curItem) {
            const { data: clash } = await serviceClient
              .from("reservation_items")
              .select("id, reservations!inner(status)")
              .eq("bed_id", curItem.bed_id)
              .neq("reservation_id", existing.id)
              .lt("check_in", checkOut)
              .gt("check_out", checkIn)
              .not("reservations.status", "in", '("cancelled","no_show")')
              .limit(1);

            if (clash && clash.length > 0) {
              // Find another free bed in the room type for the new dates.
              const { data: freeBeds } = await serviceClient
                .from("beds")
                .select("id, name, is_active, rooms!inner(room_type_id)")
                .eq("rooms.room_type_id", roomTypeId)
                .eq("is_active", true);
              let newBedId: string | null = null;
              for (const b of freeBeds ?? []) {
                const { data: busy } = await serviceClient
                  .from("reservation_items")
                  .select("id, reservations!inner(status)")
                  .eq("bed_id", b.id)
                  .neq("reservation_id", existing.id)
                  .lt("check_in", checkOut)
                  .gt("check_out", checkIn)
                  .not("reservations.status", "in", '("cancelled","no_show")')
                  .limit(1);
                if (!busy || busy.length === 0) { newBedId = b.id; break; }
              }
              if (!newBedId) {
                results.errors++;
                await notifyOrg(
                  orgId,
                  "channel_sync_failed",
                  { channelName: channel.name, reason: `OVERBOOKING on date change: no free bed for ${summary} (${checkIn} → ${checkOut})` },
                  "/channels"
                );
                continue; // keep the old dates rather than double-booking
              }
              await serviceClient
                .from("reservation_items")
                .update({ bed_id: newBedId })
                .eq("id", curItem.id);
            }
          }
        }

        await serviceClient
          .from("reservations")
          .update({ check_in: checkIn, check_out: checkOut, external_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        await serviceClient
          .from("reservation_items")
          .update({ check_in: checkIn, check_out: checkOut })
          .eq("reservation_id", existing.id);
        results.updated++;
      } else if (!guestId) {
        console.error("Skipping OTA reservation: failed to create guest for", externalId);
        results.errors++;
      } else if (isRoomType) {
        // Room-type channel: auto-assign a free bed from the pool (atomic,
        // serialized per room type). Null result = no bed free → overbooking.
        const { data: newResId, error: rpcError } = await serviceClient.rpc("create_ota_reservation_room_type", {
          p_organization_id: orgId,
          p_guest_id: guestId,
          p_channel_id: id,
          p_channel_source: channel.platform,
          p_external_id: externalId,
          p_check_in: checkIn,
          p_check_out: checkOut,
          p_notes: `${channel.name}: ${summary}`,
          p_room_type_id: roomTypeId,
        });

        if (rpcError) {
          console.error("RPC insert error:", rpcError);
          results.errors++;
        } else if (!newResId) {
          // Overbooking: surface it loudly instead of silently dropping.
          results.errors++;
          await notifyOrg(
            orgId,
            "channel_sync_failed",
            { channelName: channel.name, reason: `OVERBOOKING: no free bed for ${summary} (${checkIn} → ${checkOut})` },
            "/channels"
          );
        } else {
          results.created++;
        }
      } else {
        // Atomic: create reservation + reservation_item in one transaction via RPC
        const { error: rpcError } = await serviceClient.rpc("create_ota_reservation", {
          p_organization_id: orgId,
          p_guest_id: guestId,
          p_channel_id: id,
          p_channel_source: channel.platform,
          p_external_id: externalId,
          p_check_in: checkIn,
          p_check_out: checkOut,
          p_notes: `${channel.name}: ${summary}`,
          // Guarded above: non-room-type channels always have a bed.
          p_bed_id: syncBedId as string,
        });

        if (rpcError) {
          console.error("RPC insert error:", rpcError);
          results.errors++;
        } else {
          results.created++;
        }
      }
    }

    // Cancel reservations whose external_id is no longer in the feed (event deleted from OTA)
    const { data: allChannelRes } = await serviceClient
      .from("reservations")
      .select("id, external_id")
      .eq("channel_id", id)
      .neq("status", "cancelled");

    if (allChannelRes && allChannelRes.length > 0) {
      const orphanIds = allChannelRes
        .filter((r) => r.external_id && !syncedExternalIds.includes(r.external_id))
        .map((r) => r.id);

      if (orphanIds.length > 0) {
        await serviceClient
          .from("reservations")
          .update({ status: "cancelled", external_sync_at: new Date().toISOString() })
          .in("id", orphanIds);
        results.cancelled += orphanIds.length;
      }
    }

    // Mark channel sync success
    await serviceClient
      .from("channels")
      .update({
        last_synced_at: new Date().toISOString(),
        last_error: null,
        sync_count: (channel.sync_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return Response.json({ success: true, results });
  } catch (err: any) {
    console.error("Sync error:", err);
    // orgId may be unassigned if the failure happened before it was resolved
    // (e.g. during the initial channel/membership lookups) — guard before notifying.
    if (typeof orgId === "string") {
      await notifyOrg(orgId, "channel_sync_failed", { channelName: "channel", reason: err.message }, "/channels");
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
