import { createServerClient } from "@/lib/supabase/server";
import { createBedSchema } from "@/lib/validations/room";

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
      await createBedSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    // Create bed
    const { data: newBed, error: bedError } = await (supabase
      .from("beds") as any)
      .insert({
        organization_id: (membership as any).organization_id,
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
