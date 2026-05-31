import { createServerClient } from "@/lib/supabase/server";
import { updateRoomSchema } from "@/lib/validations/room";

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

    // Fetch room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*, room_types(id, name, type, capacity, base_price)")
      .eq("id", id)
      .eq("organization_id", (membership as any).organization_id)
      .single();

    if (roomError || !room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    // Get bed count
    const { count: bedCount } = await supabase
      .from("beds")
      .select("*", { count: "exact", head: true })
      .eq("room_id", id);

    return Response.json({
      ...(room as any),
      bed_count: bedCount || 0,
    });
  } catch (error) {
    console.error("Error fetching room:", error);
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

    // Verify room exists and belongs to org
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", id)
      .eq("organization_id", (membership as any).organization_id)
      .single();

    if (roomError || !room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    // Parse and validate update data
    const body = await _request.json();

    try {
      await updateRoomSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};

    if (body.room_type_id !== undefined) updateData.room_type_id = body.room_type_id || null;
    if (body.name !== undefined) updateData.name = body.name || null;
    if (body.floor !== undefined) updateData.floor = body.floor || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;

    updateData.updated_at = new Date().toISOString();

    // Update room
    const { error: updateError } = await (supabase
      .from("rooms") as any)
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Update error:", updateError);
      return Response.json(
        { error: updateError.message || "Failed to update room" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating room:", error);
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

    // Verify room exists and belongs to org
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", id)
      .eq("organization_id", (membership as any).organization_id)
      .single();

    if (roomError || !room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    // Check for beds in this room
    const { data: beds, error: checkError } = await supabase
      .from("beds")
      .select("id")
      .eq("room_id", id);

    if (checkError) {
      console.error("Check error:", checkError);
      return Response.json(
        { error: "Failed to check beds" },
        { status: 400 }
      );
    }

    if (beds && beds.length > 0) {
      return Response.json(
        {
          error:
            "Cannot delete room with existing beds. Please delete all beds first.",
        },
        { status: 409 }
      );
    }

    // Delete room
    const { error: deleteError } = await supabase
      .from("rooms")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return Response.json(
        { error: "Failed to delete room" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting room:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
