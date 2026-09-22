import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { clearRateOverrideField, OVERRIDE_FIELD_KEYS, type OverrideFieldKey } from "@/lib/rate-overrides";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();
    if (membershipError || !membership || !isManager((membership as any).role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const field = body.field as OverrideFieldKey;
    if (!OVERRIDE_FIELD_KEYS.includes(field)) {
      return Response.json({ error: "Invalid field" }, { status: 400 });
    }

    const result = await clearRateOverrideField(supabase, (membership as any).organization_id, id, field);
    if (!result.ok) return Response.json({ error: result.error || "Failed to clear field" }, { status: 400 });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error clearing rate override field:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
