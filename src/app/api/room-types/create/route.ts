import { createServerClient } from "@/lib/supabase/server";
import { createRoomTypeSchema } from "@/lib/validations/room";

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
      await createRoomTypeSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    // Create room type
    const { data: newRoomType, error: roomTypeError } = await (supabase
      .from("room_types") as any)
      .insert({
        organization_id: (membership as any).organization_id,
        name: body.name,
        type: body.type,
        gender: body.gender || null,
        capacity: body.capacity,
        base_price: body.base_price,
        description: body.description || null,
      })
      .select("id")
      .single();

    if (roomTypeError) {
      console.error("Room type creation error:", roomTypeError);
      return Response.json(
        { error: "Failed to create room type" },
        { status: 400 }
      );
    }

    return Response.json(
      { success: true, room_type_id: (newRoomType as any).id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating room type:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
