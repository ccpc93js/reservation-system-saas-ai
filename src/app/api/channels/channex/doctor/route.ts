import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { runDoctor, isConfigError } from "@/lib/channels/channex-doctor";

// Channex health check. Runs the full chain of checks for the caller's org and
// returns a structured report. 200 when healthy, 503 when a hard check fails
// (so CI / uptime monitors can gate on the status). Manager-only, or cron via
// CRON_SECRET (cron runs it for every provisioned org).
export async function GET(request: Request) {
  try {
    const auth = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    const isCron = !!secret && auth === `Bearer ${secret}`;
    const service = await createServiceClient();

    if (isCron) {
      const { data } = await service.from("channel_provider_links").select("organization_id").eq("kind", "property");
      const orgIds = [...new Set(((data as { organization_id: string }[]) ?? []).map((r) => r.organization_id))];
      const reports = [];
      for (const orgId of orgIds) reports.push(await runDoctor(service as any, orgId));
      const ok = reports.every((r) => r.ok);
      return Response.json({ ok, reports }, { status: ok ? 200 : 503 });
    }

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

    const report = await runDoctor(service as any, (membership as any).organization_id);
    return Response.json(report, { status: report.ok ? 200 : 503 });
  } catch (err) {
    if (isConfigError(err)) return Response.json({ ok: false, error: err.message }, { status: 503 });
    console.error("Channex doctor error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
