import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { drainFeed } from "@/lib/channels/channex-bookings";
import { ChannexConfigError } from "@/lib/channels/channex";

// Phase 3 — inbound booking poller. Drains the account-wide Channex revision
// feed (applies + acks). Meant to run on a schedule (cron, every ~1 min if
// feed-only). Also invokable manually by a manager. The feed is account-wide,
// so one call covers every mapped property.
export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    const isCron = !!secret && auth === `Bearer ${secret}`;

    if (!isCron) {
      const supabase = await createServerClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (!membership || !isManager((membership as any).role)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const service = await createServiceClient();
    const summary = await drainFeed(service as any);
    // 207 when some revisions failed (left un-acked for retry).
    return Response.json(summary, { status: summary.errors.length ? 207 : 200 });
  } catch (err) {
    if (err instanceof ChannexConfigError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    console.error("Channex feed poll error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
