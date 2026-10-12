import { createServerClient } from "@/lib/supabase/server";
import { updateBedSchema } from "@/lib/validations/room";
import { getMembershipForOrg } from "@/lib/org-membership";
import type { SupabaseClient } from "@supabase/supabase-js";

// The caller's primary/oldest org membership is the wrong authority for a
// request anchored on a specific bed: a user with several memberships may
// be working in a non-primary org, and that org owns the resource.
async function loadOwnedBed(supabase: SupabaseClient, bedId: string, select: string) {
  const { data: bed } = await supabase.from("beds").select(select).eq("id", bedId).maybeSingle();
  if (!bed) return null;
  return bed as any;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch bed
    const bed = await loadOwnedBed(supabase, id, "*, rooms(id, name, floor, room_types(name, type))");
    if (!bed) {
      return Response.json({ error: "Bed not found" }, { status: 404 });
    }

    const membership = await getMembershipForOrg(supabase, user.id, bed.organization_id);
    if (!membership) {
      return Response.json({ error: "Bed not found" }, { status: 404 });
    }

    // Get reservation count
    const { count: reservationCount } = await supabase
      .from("reservation_items")
      .select("*", { count: "exact", head: true })
      .eq("bed_id", id);

    return Response.json({
      ...(bed as any),
      reservation_count: reservationCount || 0,
    });
  } catch (error) {
    console.error("Error fetching bed:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify bed exists and belongs to org
    const bed = await loadOwnedBed(supabase, id, "id, organization_id");
    if (!bed) {
      return Response.json({ error: "Bed not found" }, { status: 404 });
    }

    const membership = await getMembershipForOrg(supabase, user.id, bed.organization_id);
    if (!membership) {
      return Response.json({ error: "Bed not found" }, { status: 404 });
    }

    // Parse and validate update data
    const body = await _request.json();

    try {
      await updateBedSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};

    if (body.room_id !== undefined) updateData.room_id = body.room_id || null;
    if (body.name !== undefined) updateData.name = body.name || null;
    if (body.position !== undefined) updateData.position = body.position || null;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    updateData.updated_at = new Date().toISOString();

    // Update bed
    const { error: updateError } = await (supabase
      .from("beds") as any)
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Update error:", updateError);
      return Response.json(
        { error: updateError.message || "Failed to update bed" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating bed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify bed exists and belongs to org
    const bed = await loadOwnedBed(supabase, id, "id, organization_id");
    if (!bed) {
      return Response.json({ error: "Bed not found" }, { status: 404 });
    }

    const membership = await getMembershipForOrg(supabase, user.id, bed.organization_id);
    if (!membership) {
      return Response.json({ error: "Bed not found" }, { status: 404 });
    }

    // Check for reservation items using this bed
    const { data: reservationItems, error: checkError } = await supabase
      .from("reservation_items")
      .select("id")
      .eq("bed_id", id);

    if (checkError) {
      console.error("Check error:", checkError);
      return Response.json(
        { error: "Failed to check reservations" },
        { status: 400 }
      );
    }

    if (reservationItems && reservationItems.length > 0) {
      return Response.json(
        {
          error:
            "Cannot delete bed with existing reservations. Please cancel or checkout all reservations first.",
        },
        { status: 409 }
      );
    }

    // Delete bed
    const { error: deleteError } = await supabase
      .from("beds")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return Response.json(
        { error: "Failed to delete bed" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting bed:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
