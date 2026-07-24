import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { hasFeature } from "@/lib/plan";
import { connectChannel, disconnectChannel } from "@/lib/channels/channex-connect";
import { ChannexConfigError } from "@/lib/channels/channex";

// Phase 5 — Connect flow. POST creates + activates the OTA channel from the
// owner's mapping; DELETE (?id=<channelRowId>) disconnects it. Manager-only,
// Pro plan.
async function authorize(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Unauthorized", status: 401 as const };
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role, organizations(plan)")
    .eq("user_id", user.id)
    .single();
  if (!membership) return { error: "No organization", status: 403 as const };
  if (!isManager((membership as any).role)) return { error: "Forbidden", status: 403 as const };
  const plan = (membership as any).organizations?.plan ?? "free";
  if (!hasFeature(plan, "channels")) return { error: "Upgrade to Pro to connect OTA channels", status: 402 as const };
  return { orgId: (membership as any).organization_id as string };
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const auth = await authorize(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const { platform, hotel_id, title, mappings } = await request.json();
    if (!platform || !hotel_id || !title || !Array.isArray(mappings)) {
      return Response.json({ error: "platform, hotel_id, title and mappings are required" }, { status: 400 });
    }

    const service = await createServiceClient();
    const result = await connectChannel(service as any, auth.orgId, { platform, hotelId: hotel_id, title, mappings });
    return Response.json(result, { status: result.ok ? 201 : 400 });
  } catch (err) {
    if (err instanceof ChannexConfigError) return Response.json({ error: err.message }, { status: 503 });
    console.error("Channex connect error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient();
    const auth = await authorize(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });

    const service = await createServiceClient();
    const result = await disconnectChannel(service as any, auth.orgId, id);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("Channex disconnect error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
