import { createServerClient } from "@/lib/supabase/server";
import { updateRoomSchema } from "@/lib/validations/room";
import { getMembershipForOrg } from "@/lib/org-membership";
import type { SupabaseClient } from "@supabase/supabase-js";

// The caller's primary/oldest org membership is the wrong authority for a
// request anchored on a specific room: a user with several memberships may
// be working in a non-primary org, and that org owns the resource.
async function loadOwnedRoom(supabase: SupabaseClient, roomId: string, select: string) {
  const { data: room } = await supabase.from("rooms").select(select).eq("id", roomId).maybeSingle();
  if (!room) return null;
  return room as any;
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

    // Fetch room
    const room = await loadOwnedRoom(supabase, id, "*, room_types(id, name, type, capacity, base_price)");
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await getMembershipForOrg(supabase, user.id, room.organization_id);
    if (!membership) {
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

    // Verify room exists and belongs to org
    const room = await loadOwnedRoom(supabase, id, "id, organization_id");
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await getMembershipForOrg(supabase, user.id, room.organization_id);
    if (!membership) {
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

    // Verify room exists and belongs to org
    const room = await loadOwnedRoom(supabase, id, "id, organization_id");
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await getMembershipForOrg(supabase, user.id, room.organization_id);
    if (!membership) {
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
