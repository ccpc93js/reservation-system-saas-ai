import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { applyRateOverridesSchema } from "@/lib/validations/rate-override";
import { applyRateOverrides, OVERRIDE_FIELD_KEYS } from "@/lib/rate-overrides";
import { getMembershipForOrg } from "@/lib/org-membership";

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const orgId = searchParams.get("org_id");
    if (!from || !to) return Response.json({ error: "from and to are required" }, { status: 400 });
    if (!orgId) return Response.json({ error: "org_id is required" }, { status: 400 });

    // The page the caller is looking at (not their oldest/"primary" org
    // membership) is the authority on which org this list is for — a user
    // with more than one membership would otherwise silently see another
    // org's overrides, or an incorrectly empty list for the org they're
    // actually viewing. Same reasoning as POST/PATCH below.
    const membership = await getMembershipForOrg(supabase, user.id, orgId);
    if (!membership) return Response.json({ error: "You don't have access to this organization" }, { status: 403 });

    const { data, error } = await supabase
      .from("room_type_rate_overrides")
      .select("*")
      .eq("organization_id", membership.organizationId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true });

    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ overrides: data ?? [] });
  } catch (error) {
    console.error("Error listing rate overrides:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    try {
      await applyRateOverridesSchema.validate(body);
    } catch (validationError: any) {
      return Response.json({ error: validationError.message }, { status: 400 });
    }

    // The caller's primary/oldest membership is the wrong authority here: the
    // rate plans being edited belong to whichever org the user is currently
    // working in, which may not be their primary one. Anchor on the first
    // targeted rate plan's own org instead; applyRateOverrides already skips
    // (via skippedRatePlanIds) any requested id that doesn't belong to it.
    const { data: anchorRatePlan } = await supabase
      .from("rate_plans")
      .select("organization_id")
      .eq("id", body.rate_plan_ids[0])
      .maybeSingle();
    if (!anchorRatePlan) return Response.json({ error: "Rate plan not found" }, { status: 404 });

    const membership = await getMembershipForOrg(supabase, user.id, (anchorRatePlan as any).organization_id);
    if (!membership) return Response.json({ error: "Rate plan not found" }, { status: 404 });
    if (!isManager(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const fields: Record<string, unknown> = {};
    for (const key of OVERRIDE_FIELD_KEYS) {
      if (body[key] !== undefined) fields[key] = body[key];
    }

    const result = await applyRateOverrides(supabase, membership.organizationId, {
      ratePlanIds: body.rate_plan_ids,
      dateFrom: body.date_from,
      dateTo: body.date_to,
      fields,
    });

    if (!result.ok) return Response.json({ error: result.error || "Failed to apply overrides" }, { status: 400 });
    return Response.json({ success: true, rows_written: result.rowsWritten, skipped_rate_plan_ids: result.skippedRatePlanIds });
  } catch (error) {
    console.error("Error applying rate overrides:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
