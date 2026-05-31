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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at:desc";

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("guests")
      .select("*", { count: "exact" })
      .eq("organization_id", (membership as any).organization_id);

    // Apply search filter
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(
        `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`
      );
    }

    // Apply sorting
    const [sortField, sortOrder] = sort.split(":");
    query = query.order(sortField || "created_at", {
      ascending: sortOrder === "asc",
    });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: guests, error: queryError, count } = await query;

    if (queryError) {
      console.error("Query error:", queryError);
      return Response.json(
        { error: "Failed to fetch guests" },
        { status: 400 }
      );
    }

    return Response.json({
      guests: guests || [],
      total: count || 0,
      page,
      pageSize: limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Error fetching guests:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
