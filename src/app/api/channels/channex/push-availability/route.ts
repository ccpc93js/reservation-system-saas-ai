import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { pushAvailabilityForOrg } from "@/lib/channels/channex-availability";
import { ChannexConfigError } from "@/lib/channels/channex";

// Phase 4 — availability (ARI) reconcile push. Pushes free-bed counts over a
// long horizon to Channex. Run nightly (cron) as drift correction across all
// provisioned orgs, or manually by a manager for their own org. Per-booking
// decrements happen inline in applyRevision; this is the safety net.
export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    const isCron = !!secret && auth === `Bearer ${secret}`;
    const service = await createServiceClient();

    let orgIds: string[];
    if (isCron) {
      // Every provisioned org (has a Channex property link).
      const { data } = await service
        .from("channel_provider_links")
        .select("organization_id")
        .eq("kind", "property");
      orgIds = [...new Set(((data as { organization_id: string }[]) ?? []).map((r) => r.organization_id))];
    } else {
      const supabase = await createServerClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const { data: membership } = await supabase
        .from("memberships")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .single();
      if (!membership || !isManager((membership as any).role)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      orgIds = [(membership as any).organization_id];
    }

    const horizonDays = 365;
    const results = [];
    for (const orgId of orgIds) {
      try {
        results.push({ orgId, ...(await pushAvailabilityForOrg(service as any, orgId, { horizonDays })) });
      } catch (err) {
        results.push({ orgId, ok: false, error: err instanceof Error ? err.message : "error" });
      }
    }

    const failed = results.some((r) => (r as any).ok === false);
    return Response.json({ orgs: results.length, results }, { status: failed ? 207 : 200 });
  } catch (err) {
    if (err instanceof ChannexConfigError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    console.error("Channex availability push error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
