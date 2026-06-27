import { createServiceClient } from "@/lib/supabase/server";
import ical from "ical-generator";

// Rate limit: max 60 req/hr per token (OTAs poll ~1/hr, 60 is generous)
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function checkRateLimit(token: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 100) {
    for (const [k, v] of rateLimitMap) {
      if (now > v.reset) rateLimitMap.delete(k);
    }
  }
  const entry = rateLimitMap.get(token);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(token, { count: 1, reset: now + 3600_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!checkRateLimit(token)) {
      return new Response("Too many requests", { status: 429 });
    }
    const supabase = await createServiceClient();

    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id, name, organization_id, bed_id")
      .eq("export_token", token)
      .eq("is_active", true)
      .single();

    if (channelError || !channel) {
      return new Response("Not found", { status: 404 });
    }

    // Get reservation IDs scoped to this channel's bed (if set)
    let reservationIds: string[] | null = null;
    if (channel.bed_id) {
      const { data: items } = await supabase
        .from("reservation_items")
        .select("reservation_id")
        .eq("organization_id", channel.organization_id)
        .eq("bed_id", channel.bed_id);
      reservationIds = (items ?? []).map((i) => i.reservation_id);
      // If bed exists but has no reservations, return empty calendar immediately
      if (reservationIds.length === 0) {
        const cal = ical({ name: channel.name, timezone: "UTC" });
        return new Response(cal.toString(), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="${channel.name.replace(/\s+/g, "-")}.ics"`,
            "Cache-Control": "no-cache",
          },
        });
      }
    }

    // Fetch confirmed/checked_in/pending direct reservations
    let query = supabase
      .from("reservations")
      .select("id, reservation_number, check_in, check_out, status, created_at, updated_at, guests(first_name, last_name)")
      .eq("organization_id", channel.organization_id)
      .in("status", ["confirmed", "checked_in", "pending"])
      .eq("channel_source", "direct");

    // Scope to this channel's bed when set
    if (reservationIds !== null) {
      query = query.in("id", reservationIds);
    }

    const { data: reservations } = await query;

    const cal = ical({ name: channel.name, timezone: "UTC" });

    for (const res of reservations ?? []) {
      const guest = (res as any).guests;
      const guestName = guest ? `${guest.first_name} ${guest.last_name}` : "Guest";

      cal.createEvent({
        id: res.id,
        start: new Date(`${res.check_in}T12:00:00Z`),
        end: new Date(`${res.check_out}T12:00:00Z`),
        allDay: true,
        summary: `BLOCKED - ${guestName}`,
        description: `Reservation ${res.reservation_number}`,
        created: new Date(res.created_at),
        lastModified: new Date(res.updated_at || res.created_at),
      });
    }

    return new Response(cal.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${channel.name.replace(/\s+/g, "-")}.ics"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("iCal export error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
