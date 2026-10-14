import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { provisionOrg } from "@/lib/channels/channex-provision";
import { ChannexConfigError } from "@/lib/channels/channex";
import { getMembershipForOrg } from "@/lib/org-membership";

// Phase 2 — app-driven provisioning. Creates/updates the org's Channex
// property, room types and rate plans from PMS data and stores the ids in
// channel_provider_links. Idempotent (re-runnable as a "sync structure").
// Manager-only, for the org whose Channel Manager page the caller is on —
// NOT their primary/oldest membership, which may be a different org for a
// multi-org user (provisioning the wrong org would create duplicate Channex
// entities there).
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const orgId: string | undefined = body?.orgId;
    if (!orgId) return Response.json({ error: "orgId is required" }, { status: 400 });

    const membership = await getMembershipForOrg(supabase, user.id, orgId);
    if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (!isManager(membership.role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const result = await provisionOrg(supabase as any, orgId);
    return Response.json(result, { status: result.ok ? 200 : 207 });
  } catch (err) {
    if (err instanceof ChannexConfigError) {
      return Response.json({ ok: false, error: err.message }, { status: 503 });
    }
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
