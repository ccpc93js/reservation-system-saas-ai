import { createServerClient } from "@/lib/supabase/server";

export async function getBookingTrends(orgId: string, days: number = 30) {
  const supabase = await createServerClient();

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("check_in, status")
      .eq("organization_id", orgId)
      .gte("check_in", startDateStr)
      .neq("status", "cancelled")
      .order("check_in", { ascending: true });

    if (error) {
      console.error("Error fetching booking trends:", error);
      return [];
    }

    // Group by date
    const trendMap = new Map<string, number>();
    reservations?.forEach((res) => {
      const date = res.check_in.split("T")[0];
      trendMap.set(date, (trendMap.get(date) || 0) + 1);
    });

    // Convert to chart format
    const trends = Array.from(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        bookings: count,
      }));

    return trends;
  } catch (error) {
    console.error("Error calculating booking trends:", error);
    return [];
  }
}

export async function getRevenueTrends(orgId: string, days: number = 30) {
  const supabase = await createServerClient();

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("check_in, paid_amount")
      .eq("organization_id", orgId)
      .gte("check_in", startDateStr)
      .neq("status", "cancelled");

    if (error) {
      console.error("Error fetching revenue trends:", error);
      return [];
    }

    // Group by date
    const revenueMap = new Map<string, number>();
    reservations?.forEach((res) => {
      const date = res.check_in.split("T")[0];
      revenueMap.set(date, (revenueMap.get(date) || 0) + (res.paid_amount || 0));
    });

    // Convert to chart format
    const trends = Array.from(revenueMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: Math.round(revenue),
      }));

    return trends;
  } catch (error) {
    console.error("Error calculating revenue trends:", error);
    return [];
  }
}

export async function getTopRoomsByRevenue(orgId: string, limit: number = 5) {
  const supabase = await createServerClient();

  try {
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("reservation_items(beds(rooms(name))), paid_amount")
      .eq("organization_id", orgId)
      .neq("status", "cancelled");

    if (error) {
      console.error("Error fetching top rooms:", error);
      return [];
    }

    // Group revenue by room
    const roomMap = new Map<string, number>();
    reservations?.forEach((res: any) => {
      res.reservation_items?.forEach((item: any) => {
        const roomName = item.beds?.rooms?.name || "Unknown";
        roomMap.set(roomName, (roomMap.get(roomName) || 0) + (res.paid_amount || 0));
      });
    });

    // Sort and return top N
    const topRooms = Array.from(roomMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([room, revenue]) => ({
        room,
        revenue: Math.round(revenue),
      }));

    return topRooms;
  } catch (error) {
    console.error("Error calculating top rooms:", error);
    return [];
  }
}

export async function getOccupancyTimeline(orgId: string, days: number = 30) {
  const supabase = await createServerClient();

  try {
    // Get total beds
    const { data: beds, error: bedsError } = await supabase
      .from("beds")
      .select("id")
      .eq("organization_id", orgId);

    if (bedsError) {
      console.error("Error fetching beds:", bedsError);
      return [];
    }

    const totalBeds = beds?.length || 0;
    if (totalBeds === 0) return [];

    // Get occupancy for each day
    const timeline = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const { data: booked, error: bookedError } = await supabase
        .from("reservation_items")
        .select("id")
        .eq("organization_id", orgId)
        .lte("check_in", dateStr)
        .gt("check_out", dateStr)
        .neq("status", "cancelled");

      if (bookedError) continue;

      const occupancy = Math.round(((booked?.length || 0) / totalBeds) * 100);
      timeline.push({
        date: new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        occupancy,
      });
    }

    return timeline;
  } catch (error) {
    console.error("Error calculating occupancy timeline:", error);
    return [];
  }
}
