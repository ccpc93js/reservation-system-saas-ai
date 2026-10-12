import { createServerClient } from "@/lib/supabase/server";
import { createBedSchema } from "@/lib/validations/room";
import { canAddBed, getBedLimit } from "@/lib/plan";
import { getMembershipForOrg } from "@/lib/org-membership";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    try {
      await createBedSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    // The bed being created belongs to whichever org owns body.room_id —
    // the caller's primary/oldest membership is the wrong authority when
    // the user has several memberships and is working in a non-primary one.
    const { data: room } = await supabase
      .from("rooms")
      .select("organization_id")
      .eq("id", body.room_id)
      .maybeSingle();
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await getMembershipForOrg(supabase, user.id, (room as any).organization_id);
    if (!membership) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("plan")
      .eq("id", membership.organizationId)
      .maybeSingle();

    const orgId = membership.organizationId;
    const plan = (org as any)?.plan ?? "free";

    // Check bed limit
    const { count: currentBeds } = await supabase
      .from("beds")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);

    if (!canAddBed(plan, currentBeds ?? 0)) {
      const limit = getBedLimit(plan);
      return Response.json({
        error: `Bed limit reached (${currentBeds}/${limit} on ${plan} plan). Upgrade to add more beds.`,
        code: "BED_LIMIT_REACHED",
        current: currentBeds,
        limit,
        plan,
      }, { status: 403 });
    }

    // Create bed
    const { data: newBed, error: bedError } = await (supabase
      .from("beds") as any)
      .insert({
        organization_id: orgId,
        room_id: body.room_id,
        name: body.name,
        position: body.position || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
      })
      .select("id")
      .single();

    if (bedError) {
      console.error("Bed creation error:", bedError);
      return Response.json(
        { error: "Failed to create bed" },
        { status: 400 }
      );
    }

    return Response.json(
      { success: true, bed_id: (newBed as any).id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating bed:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
