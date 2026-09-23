import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { provisionOrg } from "@/lib/channels/channex-provision";
import { ChannexConfigError } from "@/lib/channels/channex";
import { getPrimaryMembership } from "@/lib/org-membership";

// Phase 2 — app-driven provisioning. Creates/updates the org's Channex
// property, room types and rate plans from PMS data and stores the ids in
// channel_provider_links. Idempotent (re-runnable as a "sync structure").
// Manager-only. The owner never touches the Channex dashboard.
export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });
    if (!isManager(membership.role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const result = await provisionOrg(supabase as any, membership.organizationId);
    return Response.json(result, { status: result.ok ? 200 : 207 });
  } catch (err) {
    if (err instanceof ChannexConfigError) {
      return Response.json({ ok: false, error: err.message }, { status: 503 });
    }
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
