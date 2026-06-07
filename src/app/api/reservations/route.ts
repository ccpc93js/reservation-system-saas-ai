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

    const orgId = (membership as any).organization_id;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const checkInFrom = searchParams.get("check_in_from") || "";
    const checkInTo = searchParams.get("check_in_to") || "";
    const roomId = searchParams.get("room_id") || "";
    const channel = searchParams.get("channel") || "";
    const sort = searchParams.get("sort") || "created_at:desc";

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("reservations")
      .select(
        `
        id, reservation_number, check_in, check_out, status, channel,
        total_amount, paid_amount, created_at,
        guests(first_name, last_name),
        reservation_items(bed_id, beds(id, name, rooms(id, name)))
      `,
        { count: "exact" }
      )
      .eq("organization_id", orgId);

    // No server-side search - client handles all filtering
    // (Supabase limitations with nested OR queries)

    // Apply status filter
    if (status) {
      const statuses = status.split(",").map((s) => s.trim());
      query = query.in("status", statuses);
    }

    // Apply check-in date range
    if (checkInFrom) {
      query = query.gte("check_in", checkInFrom);
    }
    if (checkInTo) {
      query = query.lte("check_in", checkInTo);
    }

    // Apply room filter
    if (roomId) {
      const roomIds = roomId.split(",").map((id) => id.trim());
      // Note: This requires matching through beds.rooms relationship
      // For now, we'll let the client-side filter this if needed
      // Or we could add a separate query for beds in a room
    }

    // Apply channel filter
    if (channel) {
      query = query.eq("channel", channel);
    }

    // Apply sorting
    const [sortField, sortOrder] = sort.split(":");
    query = query.order(sortField || "created_at", {
      ascending: sortOrder === "asc",
    });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: reservations, error: queryError, count } = await query;

    if (queryError) {
      console.error("Query error:", queryError);
      return Response.json(
        { error: "Failed to fetch reservations" },
        { status: 400 }
      );
    }

    return Response.json({
      reservations: reservations || [],
      total: count || 0,
      page,
      pageSize: limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
