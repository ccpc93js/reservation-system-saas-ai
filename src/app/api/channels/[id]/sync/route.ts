import { createServerClient, createServiceClient } from "@/lib/supabase/server";
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
  try {
    const { id } = await params;
    const serviceClient = await createServiceClient();

    // Allow cron/sync-all to bypass user auth via Bearer token
    const auth = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    const isCron = !!secret && auth === `Bearer ${secret}`;

    let orgId: string;

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
      return Response.json({ error: "Failed to fetch iCal feed" }, { status: 422 });
    }

    // Use the bed directly linked to this channel
    const syncBedId: string | null = channel.bed_id || null;
    if (!syncBedId) {
      return Response.json({ error: "No bed assigned to this channel. Edit the channel and select a bed first." }, { status: 400 });
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
        await serviceClient
          .from("reservations")
          .update({ check_in: checkIn, check_out: checkOut, external_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        await serviceClient
          .from("reservation_items")
          .update({ check_in: checkIn, check_out: checkOut })
          .eq("reservation_id", existing.id);
        results.updated++;
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
          p_bed_id: syncBedId,
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
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
