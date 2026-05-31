import { createServerClient } from "@/lib/supabase/server";
import { createRoomSchema } from "@/lib/validations/room";

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

    // Parse and validate request body
    const body = await request.json();

    try {
      await createRoomSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    // Create room
    const { data: newRoom, error: roomError } = await (supabase
      .from("rooms") as any)
      .insert({
        organization_id: (membership as any).organization_id,
        room_type_id: body.room_type_id,
        name: body.name,
        floor: body.floor || null,
        notes: body.notes || null,
      })
      .select("id")
      .single();

    if (roomError) {
      console.error("Room creation error:", roomError);
      return Response.json(
        { error: "Failed to create room" },
        { status: 400 }
      );
    }

    return Response.json(
      { success: true, room_id: (newRoom as any).id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating room:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
