import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { applyRateOverridesSchema } from "@/lib/validations/rate-override";
import { applyRateOverrides, OVERRIDE_FIELD_KEYS } from "@/lib/rate-overrides";
import { getPrimaryMembership } from "@/lib/org-membership";

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership) return Response.json({ error: "You don't have access to any organization" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) return Response.json({ error: "from and to are required" }, { status: 400 });

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

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership || !isManager(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    try {
      await applyRateOverridesSchema.validate(body);
    } catch (validationError: any) {
      return Response.json({ error: validationError.message }, { status: 400 });
    }

    const fields: Record<string, unknown> = {};
    for (const key of OVERRIDE_FIELD_KEYS) {
      if (body[key] !== undefined) fields[key] = body[key];
    }

    const result = await applyRateOverrides(supabase, membership.organizationId, {
      roomTypeIds: body.room_type_ids,
      dateFrom: body.date_from,
      dateTo: body.date_to,
      fields,
    });

    if (!result.ok) return Response.json({ error: result.error || "Failed to apply overrides" }, { status: 400 });
    return Response.json({ success: true, rows_written: result.rowsWritten, skipped_room_type_ids: result.skippedRoomTypeIds });
  } catch (error) {
    console.error("Error applying rate overrides:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
