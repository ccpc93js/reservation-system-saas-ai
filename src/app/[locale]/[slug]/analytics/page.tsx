import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getServerUser } from "@/lib/supabase/session";
import AnalyticsClient from "@/components/analytics/analytics-client";
import { getBookingTrends, getRevenueTrends, getTopRoomsByRevenue, getOccupancyTimeline } from "@/lib/analytics-metrics";
import Paywall from "@/components/billing/paywall";
import { hasFeature } from "@/lib/plan";
import { canAccessSection } from "@/lib/permissions";

export default async function AnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { supabase, user } = await getServerUser();
  const t = await getTranslations("analytics");

  const { slug } = await params;

  // Get org + plan
  const { data: org } = await supabase
    .from("organizations")
    .select("id, plan")
    .eq("slug", slug)
    .single();
  if (!org) redirect("/onboarding");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();
  if (!membership) redirect("/onboarding");

  const orgId = org.id;
  const orgPlan = org.plan ?? "free";
  const orgSlug = slug;
  // Analytics is manager+ only.
  if (!canAccessSection(membership.role, "analytics")) redirect(`/${orgSlug}/dashboard`);

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
    getBookingTrends(orgId, 60),
    getRevenueTrends(orgId, 60),
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
