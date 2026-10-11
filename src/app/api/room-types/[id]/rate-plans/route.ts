import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { createRatePlanSchema } from "@/lib/validations/rate-plan";
import { provisionOrg } from "@/lib/channels/channex-provision";
import { getPrimaryMembership } from "@/lib/org-membership";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomTypeId } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership || !isManager(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: roomType } = await supabase
      .from("room_types")
      .select("id")
      .eq("id", roomTypeId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (!roomType) return Response.json({ error: "Room type not found" }, { status: 404 });

    const body = await request.json();
    try {
      await createRatePlanSchema.validate(body);
    } catch (validationError: any) {
      return Response.json({ error: validationError.message }, { status: 400 });
    }

    const { data: ratePlan, error } = await (supabase.from("rate_plans") as any)
      .insert({
        organization_id: membership.organizationId,
        room_type_id: roomTypeId,
        name: body.name,
        base_price: body.base_price,
        stop_sell: body.stop_sell ?? false,
        closed_to_arrival: body.closed_to_arrival ?? false,
        closed_to_departure: body.closed_to_departure ?? false,
        min_stay_arrival: body.min_stay_arrival ?? null,
        min_stay_through: body.min_stay_through ?? null,
        max_stay: body.max_stay ?? null,
        is_default: false,
      })
      .select()
      .single();

    if (error) return Response.json({ error: "Failed to create rate plan" }, { status: 400 });

    // Provision it on Channex immediately — safe to no-op if the org isn't
    // connected. The rate plan already exists locally at this point; a
    // provisioning failure (or an unhandled exception from provisionOrg's own
    // unguarded setup queries) must not turn an already-successful create
    // into a misleading 500 — log it and let the existing manual "sync now"
    // recovery path (and the next scheduled provisioning run) catch up.
    try {
      const result = await provisionOrg(supabase, membership.organizationId);
      if (!result.ok) {
        console.error(`provisionOrg failed after creating rate plan ${(ratePlan as any).id}:`, result.warnings, result.rows.filter((r) => r.action === "error"));
      }
    } catch (provisionError) {
      console.error(`provisionOrg threw after creating rate plan ${(ratePlan as any).id}:`, provisionError);
    }

    return Response.json({ rate_plan: ratePlan }, { status: 201 });
  } catch (error) {
    console.error("Error creating rate plan:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
