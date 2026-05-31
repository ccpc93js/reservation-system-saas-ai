import { createServerClient } from "@/lib/supabase/server";
import { updateRoomTypeSchema } from "@/lib/validations/room";

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

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    // Fetch room type
    const { data: roomType, error: roomTypeError } = await supabase
      .from("room_types")
      .select("*")
      .eq("id", id)
      .eq("organization_id", (membership as any).organization_id)
      .single();

    if (roomTypeError || !roomType) {
      return Response.json({ error: "Room type not found" }, { status: 404 });
    }

    // Get room count
    const { count: roomCount } = await supabase
      .from("rooms")
      .select("*", { count: "exact", head: true })
      .eq("room_type_id", id);

    return Response.json({
      ...(roomType as any),
      room_count: roomCount || 0,
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

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    // Verify room type exists and belongs to org
    const { data: roomType, error: roomTypeError } = await supabase
      .from("room_types")
      .select("id")
      .eq("id", id)
      .eq("organization_id", (membership as any).organization_id)
      .single();

    if (roomTypeError || !roomType) {
      return Response.json({ error: "Room type not found" }, { status: 404 });
    }

    // Parse and validate update data
    const body = await _request.json();

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
    if (body.base_price !== undefined) updateData.base_price = body.base_price || null;
    if (body.description !== undefined) updateData.description = body.description || null;

    updateData.updated_at = new Date().toISOString();

    // Update room type
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

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    // Verify room type exists and belongs to org
    const { data: roomType, error: roomTypeError } = await supabase
      .from("room_types")
      .select("id")
      .eq("id", id)
      .eq("organization_id", (membership as any).organization_id)
      .single();

    if (roomTypeError || !roomType) {
      return Response.json({ error: "Room type not found" }, { status: 404 });
    }

    // Check for rooms using this room type
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

    // Delete room type
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
