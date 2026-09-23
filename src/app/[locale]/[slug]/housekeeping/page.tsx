import { getTranslations } from "next-intl/server";
import { getServerUser } from "@/lib/supabase/session";
import HousekeepingClient from "@/components/housekeeping/housekeeping-client";

type Membership = { organization_id: string };

export default async function HousekeepingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await getServerUser();
  const t = await getTranslations("housekeeping");

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!org) return <div className="text-sm text-muted-foreground">{t("noOrgFound")}</div>;

  const { data: membershipRaw } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();

  const membership = membershipRaw as Membership | null;

  if (!membership) {
    return <div className="text-sm text-muted-foreground">{t("noOrgFound")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm mt-0.5 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <HousekeepingClient orgId={membership.organization_id} />
    </div>
  );
}
