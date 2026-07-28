import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { processOutbox } from "@/lib/channels/channex-outbox";
import { ChannexConfigError } from "@/lib/channels/channex";

// Channex outbox worker. Drains due outbox rows, coalescing per (org, kind)
// into single availability / restrictions pushes, rate-limited with backoff.
// Meant to run on a short cron (~1 min) so PMS changes reach Channex within a
// batch window. Cron via CRON_SECRET, or a manager for a manual flush.
export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    const isCron = !!secret && auth === `Bearer ${secret}`;

    if (!isCron) {
      const supabase = await createServerClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const { data: membership } = await supabase.from("memberships").select("role").eq("user_id", user.id).single();
      if (!membership || !isManager((membership as any).role)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const service = await createServiceClient();
    const result = await processOutbox(service as any);
    return Response.json(result, { status: result.errored ? 207 : 200 });
  } catch (err) {
    if (err instanceof ChannexConfigError) return Response.json({ error: err.message }, { status: 503 });
    console.error("Channex outbox worker error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
