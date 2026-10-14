import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { listPendingMods, applyModification, dismissModification } from "@/lib/channels/channex-mods";
import { getMembershipForOrg } from "@/lib/org-membership";

// Pending OTA booking modifications (from "modified" revisions). GET lists them;
// POST { orgId, modId, action: "apply" | "dismiss" } resolves one. Manager-only,
// for the org the caller explicitly names — NOT their primary/oldest
// membership, which may be a different org for a multi-org user.
async function authForOrg(supabase: Awaited<ReturnType<typeof createServerClient>>, orgId: string | undefined) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Unauthorized", status: 401 as const };
  if (!orgId) return { error: "orgId is required", status: 400 as const };
  const membership = await getMembershipForOrg(supabase, user.id, orgId);
  if (!membership || !isManager(membership.role)) return { error: "Forbidden", status: 403 as const };
  return { orgId };
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const orgId = new URL(request.url).searchParams.get("orgId") ?? undefined;
    const a = await authForOrg(supabase, orgId);
    if ("error" in a) return Response.json({ error: a.error }, { status: a.status });
    const service = await createServiceClient();
    const mods = await listPendingMods(service as any, a.orgId);
    return Response.json({ mods });
  } catch (err) {
    console.error("Channex modifications list error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { orgId, modId, action } = await request.json();
    const a = await authForOrg(supabase, orgId);
    if ("error" in a) return Response.json({ error: a.error }, { status: a.status });

    if (!modId || !["apply", "dismiss"].includes(action)) {
      return Response.json({ error: "modId and action ('apply'|'dismiss') are required" }, { status: 400 });
    }

    const service = await createServiceClient();
    const result = action === "apply"
      ? await applyModification(service as any, a.orgId, modId)
      : await dismissModification(service as any, a.orgId, modId);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("Channex modification action error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
