import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "25"));
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("room_types")
      .select("*", { count: "exact" })
      .eq("organization_id", (membership as any).organization_id);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data: roomTypes, count, error: roomTypesError } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (roomTypesError) {
      console.error("Room types error:", roomTypesError);
      return Response.json(
        { error: "Failed to fetch room types" },
        { status: 400 }
      );
    }

    return Response.json({
      room_types: roomTypes || [],
      total: count || 0,
      page,
      page_size: limit,
    });
  } catch (error) {
    console.error("Error fetching room types:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
