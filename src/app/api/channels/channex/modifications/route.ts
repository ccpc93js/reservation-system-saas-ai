import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { listPendingMods, applyModification, dismissModification } from "@/lib/channels/channex-mods";

// Pending OTA booking modifications (from "modified" revisions). GET lists them;
// POST { modId, action: "apply" | "dismiss" } resolves one. Manager-only.
async function auth(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Unauthorized", status: 401 as const };
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .single();
  if (!membership) return { error: "No organization", status: 403 as const };
  if (!isManager((membership as any).role)) return { error: "Forbidden", status: 403 as const };
  return { orgId: (membership as any).organization_id as string };
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const a = await auth(supabase);
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
    const a = await auth(supabase);
    if ("error" in a) return Response.json({ error: a.error }, { status: a.status });

    const { modId, action } = await request.json();
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
