import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { updateRatePlanSchema } from "@/lib/validations/rate-plan";
import { getMembershipForOrg } from "@/lib/org-membership";
import { enqueueRestrictions } from "@/lib/channels/channex-outbox";
import { touchedOverrideFields } from "@/lib/channels/channex";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rateplanId: string }> }
) {
  try {
    const { rateplanId } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: ratePlan } = await supabase
      .from("rate_plans")
      .select("id, organization_id")
      .eq("id", rateplanId)
      .maybeSingle();
    if (!ratePlan) return Response.json({ error: "Rate plan not found" }, { status: 404 });

    const membership = await getMembershipForOrg(supabase, user.id, (ratePlan as any).organization_id);
    if (!membership) return Response.json({ error: "Rate plan not found" }, { status: 404 });
    if (!isManager(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    try {
      await updateRatePlanSchema.validate(body);
    } catch (validationError: any) {
      return Response.json({ error: validationError.message }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ["name", "base_price", "stop_sell", "closed_to_arrival", "closed_to_departure", "min_stay_arrival", "min_stay_through", "max_stay"] as const) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    const { error } = await (supabase.from("rate_plans") as any).update(updateData).eq("id", rateplanId);
    if (error) return Response.json({ error: "Failed to update rate plan" }, { status: 400 });

    const touchedFields = touchedOverrideFields(body);
    if (touchedFields) {
      const today = new Date().toISOString().slice(0, 10);
      const horizon = new Date(Date.now() + 500 * 86400000).toISOString().slice(0, 10);
      // Full date window (a standing-value edit affects every future date),
      // but only the fields actually touched — a price-only edit shouldn't
      // re-send every restriction field, which is exactly what Channex's
      // own certification flagged about this push path before this feature.
      await enqueueRestrictions(supabase, membership.organizationId, today, horizon, [rateplanId], [...touchedFields]);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating rate plan:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; rateplanId: string }> }
) {
  try {
    const { rateplanId } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: ratePlan } = await supabase
      .from("rate_plans")
      .select("id, is_default, organization_id")
      .eq("id", rateplanId)
      .maybeSingle();
    if (!ratePlan) return Response.json({ error: "Rate plan not found" }, { status: 404 });

    const membership = await getMembershipForOrg(supabase, user.id, (ratePlan as any).organization_id);
    if (!membership) return Response.json({ error: "Rate plan not found" }, { status: 404 });
    if (!isManager(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if ((ratePlan as any).is_default) {
      return Response.json({ error: "Can't delete a room type's only (default) rate plan" }, { status: 409 });
    }

    const { data: overrides } = await supabase
      .from("room_type_rate_overrides")
      .select("id")
      .eq("rate_plan_id", rateplanId)
      .limit(1);
    if (overrides && overrides.length > 0) {
      return Response.json({ error: "This rate plan has date-specific overrides — clear them first" }, { status: 409 });
    }

    const { error } = await supabase.from("rate_plans").delete().eq("id", rateplanId);
    if (error) return Response.json({ error: "Failed to delete rate plan" }, { status: 400 });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting rate plan:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
