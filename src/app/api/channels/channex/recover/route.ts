import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { recoverBookings } from "@/lib/channels/channex-recovery";
import { ChannexConfigError } from "@/lib/channels/channex";

// Manual, time-scoped booking recovery after a >30-min feed/webhook outage.
// Body: { since: ISO timestamp } — the outage start. Backfills any bookings the
// PMS is missing since then, deduped by Channex booking id. A deliberate
// operator action — do NOT put it on a schedule (a periodic full-list re-pull
// is heavy and pointless while the poller is healthy). Manager-only, or a
// one-off invocation with CRON_SECRET.
export async function POST(request: Request) {
  try {
    const service = await createServiceClient();
    const secret = process.env.CRON_SECRET;
    const isCron = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
    const body = await request.json().catch(() => ({} as any));

    let orgId: string | undefined;
    if (isCron) {
      orgId = body.orgId; // cron caller must name the org
    } else {
      const supabase = await createServerClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const { data: membership } = await supabase
        .from("memberships")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .single();
      if (!membership) return Response.json({ error: "No organization" }, { status: 403 });
      if (!isManager((membership as any).role)) return Response.json({ error: "Forbidden" }, { status: 403 });
      orgId = (membership as any).organization_id;
    }

    const since = body.since;
    if (!since || isNaN(Date.parse(since))) {
      return Response.json({ error: "since (ISO timestamp of the outage start) is required" }, { status: 400 });
    }
    if (!orgId) return Response.json({ error: "orgId is required (cron caller)" }, { status: 400 });

    const result = await recoverBookings(service as any, orgId, since);
    return Response.json(result, { status: result.ok ? 200 : 207 });
  } catch (err) {
    if (err instanceof ChannexConfigError) return Response.json({ error: err.message }, { status: 503 });
    console.error("Channex recovery error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
