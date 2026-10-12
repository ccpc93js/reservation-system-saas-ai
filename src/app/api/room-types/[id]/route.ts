import { createServerClient } from "@/lib/supabase/server";
import { updateRoomTypeSchema } from "@/lib/validations/room";
import { getMembershipForOrg } from "@/lib/org-membership";
import type { SupabaseClient } from "@supabase/supabase-js";

// The caller's primary/oldest org membership is the wrong authority for a
// request anchored on a specific room type: a user with several memberships
// may be working in a non-primary org, and that org owns the resource.
async function loadOwnedRoomType(
  supabase: SupabaseClient,
  userId: string,
  roomTypeId: string
) {
  const { data: roomType } = await supabase
    .from("room_types")
    .select("*")
    .eq("id", roomTypeId)
    .maybeSingle();

  if (!roomType) return { roomType: null, membership: null };

  const membership = await getMembershipForOrg(
    supabase,
    userId,
    (roomType as any).organization_id
  );
  if (!membership) return { roomType: null, membership: null };

  return { roomType, membership };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomType } = await loadOwnedRoomType(supabase, user.id, id);

    if (!roomType) {
      return Response.json({ error: "Room type not found" }, { status: 404 });
    }

    const { count: roomCount } = await supabase
      .from("rooms")
      .select("*", { count: "exact", head: true })
      .eq("room_type_id", id);

    const { data: ratePlans } = await supabase
      .from("rate_plans")
      .select("id, name, base_price, stop_sell, closed_to_arrival, closed_to_departure, min_stay_arrival, min_stay_through, max_stay, is_default")
      .eq("room_type_id", id)
      .order("is_default", { ascending: false });

    return Response.json({
      ...(roomType as any),
      room_count: roomCount || 0,
      rate_plans: ratePlans ?? [],
    });
  } catch (error) {
    console.error("Error fetching room type:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomType } = await loadOwnedRoomType(supabase, user.id, id);

    if (!roomType) {
      return Response.json({ error: "Room type not found" }, { status: 404 });
    }

    const body = await request.json();

    try {
      await updateRoomTypeSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name || null;
    if (body.type !== undefined) updateData.type = body.type || null;
    if (body.gender !== undefined) updateData.gender = body.gender || null;
    if (body.capacity !== undefined) updateData.capacity = body.capacity || null;
    if (body.description !== undefined) updateData.description = body.description || null;
    updateData.updated_at = new Date().toISOString();

    const { error: updateError } = await (supabase
      .from("room_types") as any)
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Update error:", updateError);
      return Response.json(
        { error: updateError.message || "Failed to update room type" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating room type:", error);
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomType } = await loadOwnedRoomType(supabase, user.id, id);

    if (!roomType) {
      return Response.json({ error: "Room type not found" }, { status: 404 });
    }

    const { data: rooms, error: checkError } = await supabase
      .from("rooms")
      .select("id")
      .eq("room_type_id", id);

    if (checkError) {
      console.error("Check error:", checkError);
      return Response.json(
        { error: "Failed to check rooms" },
        { status: 400 }
      );
    }

    if (rooms && rooms.length > 0) {
      return Response.json(
        {
          error:
            "Cannot delete room type with existing rooms. Please delete all rooms first.",
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabase
      .from("room_types")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return Response.json(
        { error: "Failed to delete room type" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting room type:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
