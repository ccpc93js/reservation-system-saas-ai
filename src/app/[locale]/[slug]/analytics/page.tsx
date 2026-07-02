import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import AnalyticsClient from "@/components/analytics/analytics-client";
import { getBookingTrends, getRevenueTrends, getTopRoomsByRevenue, getOccupancyTimeline } from "@/lib/analytics-metrics";
import Paywall from "@/components/billing/paywall";
import { hasFeature } from "@/lib/plan";

export default async function AnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createServerClient();
  const t = await getTranslations("analytics");
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { slug: _slug } = await params;

  // Get org + plan
  const { data: membership } = await supabase
    .from("memberships")
    .select("organizations(id, plan, slug)")
    .eq("user_id", user.id)
    .single();

  const orgId = (membership as any)?.organizations?.id;
  const orgPlan = (membership as any)?.organizations?.plan ?? "free";
  const orgSlug = (membership as any)?.organizations?.slug ?? "";
  if (!orgId) redirect("/onboarding");

  if (!hasFeature(orgPlan, "analytics")) {
    return (
      <Paywall
        slug={orgSlug}
        feature={t("paywallFeature")}
        description={t("paywallDescription")}
        requiredPlan="pro"
      />
    );
  }

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
