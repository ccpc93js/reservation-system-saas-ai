import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import AnalyticsClient from "@/components/analytics/analytics-client";
import { getBookingTrends, getRevenueTrends, getTopRoomsByRevenue, getOccupancyTimeline } from "@/lib/analytics-metrics";

export default async function AnalyticsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get org
  const { data: membership } = await supabase
    .from("memberships")
    .select("organizations(id)")
    .eq("user_id", user.id)
    .single();

  const orgId = (membership as any)?.organizations?.id;
  if (!orgId) redirect("/onboarding");

  // Fetch analytics data
  const [bookingTrends, revenueTrends, topRooms, occupancyTimeline] = await Promise.all([
    getBookingTrends(orgId, 30),
    getRevenueTrends(orgId, 30),
    getTopRoomsByRevenue(orgId, 5),
    getOccupancyTimeline(orgId, 30),
  ]);

  return (
    <AnalyticsClient
      bookingTrends={bookingTrends}
      revenueTrends={revenueTrends}
      topRooms={topRooms}
      occupancyTimeline={occupancyTimeline}
    />
  );
}
