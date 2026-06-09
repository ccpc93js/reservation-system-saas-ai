import { createServerClient } from "@/lib/supabase/server";

export async function getOccupancyMetrics(orgId: string) {
  const supabase = await createServerClient();

  try {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Get total beds in org
    const { data: beds, error: bedsError } = await supabase
      .from("beds")
      .select("id")
      .eq("organization_id", orgId);

    if (bedsError) {
      console.error("Error fetching beds:", bedsError);
      return { occupiedBeds: 0, totalBeds: 0, occupancyRate: 0, trend: "flat" as const, trendPercent: 0, previousRate: 0 };
    }

    const totalBeds = beds?.length || 0;

  // Get beds booked today
  const { data: activeReservations } = await supabase
    .from("reservations")
    .select("reservation_items(bed_id)")
    .eq("organization_id", orgId)
    .lte("check_in", today)
    .gt("check_out", today)
    .neq("status", "cancelled");

  const bedIds = new Set<string>();
  activeReservations?.forEach((res: any) => {
    res.reservation_items?.forEach((item: any) => {
      if (item.bed_id) bedIds.add(item.bed_id);
    });
  });

  const occupiedBeds = bedIds.size;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Get beds booked yesterday for trend
  const { data: yesterdayReservations } = await supabase
    .from("reservations")
    .select("reservation_items(bed_id)")
    .eq("organization_id", orgId)
    .lte("check_in", yesterday)
    .gt("check_out", yesterday)
    .neq("status", "cancelled");

  const yesterdayBedIds = new Set<string>();
  yesterdayReservations?.forEach((res: any) => {
    res.reservation_items?.forEach((item: any) => {
      if (item.bed_id) yesterdayBedIds.add(item.bed_id);
    });
  });

  const yesterdayOccupied = yesterdayBedIds.size;
  const yesterdayRate = totalBeds > 0 ? Math.round((yesterdayOccupied / totalBeds) * 100) : 0;

  // Calculate trend
  const trend = occupancyRate - yesterdayRate;
  const trendDirection = trend > 0 ? "up" : trend < 0 ? "down" : "flat";
  const trendPercent = Math.abs(trend);

    return {
      occupiedBeds,
      totalBeds,
      occupancyRate,
      trend: trendDirection,
      trendPercent,
      previousRate: yesterdayRate,
    };
  } catch (error) {
    console.error("Error calculating occupancy metrics:", error);
    return { occupiedBeds: 0, totalBeds: 0, occupancyRate: 0, trend: "flat" as const, trendPercent: 0, previousRate: 0 };
  }
}

export async function getRevenueMetrics(orgId: string) {
  const supabase = await createServerClient();

  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString().split("T")[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    // Revenue this month
    const { data: monthRes, error: monthError } = await supabase
      .from("reservations")
      .select("paid_amount")
      .eq("organization_id", orgId)
      .gte("check_in", monthStart)
      .lte("check_in", monthEnd)
      .neq("status", "cancelled");

    if (monthError) {
      console.error("Error fetching monthly revenue:", monthError);
      return { monthlyRevenue: 0, dailyRevenue: 0 };
    }

    const monthlyRevenue = monthRes?.reduce((sum, r) => sum + (r.paid_amount || 0), 0) || 0;

    // Revenue today
    const { data: todayRes, error: todayError } = await supabase
      .from("reservation_items")
      .select("reservations(paid_amount)")
      .eq("organization_id", orgId)
      .eq("check_in", todayStr)
      .neq("status", "cancelled");

    if (todayError) {
      console.error("Error fetching daily revenue:", todayError);
      return { monthlyRevenue, dailyRevenue: 0 };
    }

    const dailyRevenue = todayRes?.reduce((sum, item: any) => {
      return sum + (item.reservations?.paid_amount || 0);
    }, 0) || 0;

    return { monthlyRevenue, dailyRevenue };
  } catch (error) {
    console.error("Error calculating revenue metrics:", error);
    return { monthlyRevenue: 0, dailyRevenue: 0 };
  }
}

export async function getArrivalsToday(orgId: string) {
  const supabase = await createServerClient();

  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: arrivals, error } = await supabase
      .from("reservations")
      .select(
        `id, reservation_number, check_in, check_out, status,
         guests(id, first_name, last_name, nationality)`
      )
      .eq("organization_id", orgId)
      .eq("check_in", today)
      .neq("status", "cancelled")
      .order("check_in", { ascending: true })
      .limit(10);

    if (error) {
      console.error("Error fetching arrivals:", error);
      return [];
    }

    return arrivals || [];
  } catch (error) {
    console.error("Error calculating arrivals:", error);
    return [];
  }
}

export async function getActiveReservations(orgId: string) {
  const supabase = await createServerClient();

  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: active, error } = await supabase
      .from("reservations")
      .select("id")
      .eq("organization_id", orgId)
      .lte("check_in", today)
      .gt("check_out", today)
      .neq("status", "cancelled");

    if (error) {
      console.error("Error fetching active reservations:", error);
      return 0;
    }

    return active?.length || 0;
  } catch (error) {
    console.error("Error calculating active reservations:", error);
    return 0;
  }
}

export async function getAverageBookingNights(orgId: string) {
  const supabase = await createServerClient();

  try {
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("check_in, check_out")
      .eq("organization_id", orgId)
      .neq("status", "cancelled")
      .limit(1000);

    if (error) {
      console.error("Error fetching reservations for avg nights:", error);
      return 0;
    }

    if (!reservations || reservations.length === 0) {
      return 0;
    }

    const totalNights = reservations.reduce((sum, res) => {
      const checkIn = new Date(res.check_in);
      const checkOut = new Date(res.check_out);
      const nights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + nights;
    }, 0);

    return Math.round((totalNights / reservations.length) * 10) / 10;
  } catch (error) {
    console.error("Error calculating average booking nights:", error);
    return 0;
  }
}
