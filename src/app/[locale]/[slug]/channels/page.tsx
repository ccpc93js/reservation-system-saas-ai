import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import ChannelsClient from "@/components/channels/channels-client";
import Paywall from "@/components/billing/paywall";
import { hasFeature } from "@/lib/plan";

export default async function ChannelsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const t = await getTranslations("channels");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, organizations(plan)")
    .single();

  if (!membership) return <div>{t("errorLoading")}</div>;

  const orgId = (membership as any).organization_id as string;
  const plan = (membership as any).organizations?.plan ?? "free";

  if (!hasFeature(plan, "channels")) {
    return (
      <Paywall
        slug={slug}
        feature={t("paywallFeature")}
        description={t("paywallDescription")}
        requiredPlan="pro"
      />
    );
  }

  const [{ data: channels }, { data: beds }] = await Promise.all([
    supabase
      .from("channels")
      .select("*, bed_id, beds(id, name, rooms(id, name))")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("beds")
      .select("id, name, rooms(id, name)")
      .eq("organization_id", orgId)
      .order("name"),
  ]);

  return (
    <ChannelsClient
      initialChannels={channels ?? []}
      beds={beds ?? []}
      orgId={orgId}
    />
  );
}
