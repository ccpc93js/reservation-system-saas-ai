import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { hasFeature } from "@/lib/plan";
import { getConnectOptions } from "@/lib/channels/channex-connect";
import { ChannexConfigError } from "@/lib/channels/channex";

// Phase 5 — step 1 of the Connect flow: validate the OTA hotel id and return
// both sides for the mapping screen (OTA rooms/rates + our rate plans).
// Manager-only, Pro plan (reuses the existing "channels" feature gate).
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, role, organizations(plan)")
      .eq("user_id", user.id)
      .single();
    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });
    if (!isManager((membership as any).role)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const plan = (membership as any).organizations?.plan ?? "free";
    if (!hasFeature(plan, "channels")) return Response.json({ error: "Upgrade to Pro to connect OTA channels" }, { status: 402 });

    const { platform, hotel_id } = await request.json();
    if (!platform || !hotel_id) return Response.json({ error: "platform and hotel_id are required" }, { status: 400 });

    const service = await createServiceClient();
    const result = await getConnectOptions(service as any, (membership as any).organization_id, platform, hotel_id);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    if (err instanceof ChannexConfigError) return Response.json({ error: err.message }, { status: 503 });
    console.error("Channex connect options error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
