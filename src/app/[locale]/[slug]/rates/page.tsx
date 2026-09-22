import { getTranslations } from "next-intl/server";
import { getServerUser } from "@/lib/supabase/session";
import RateOverridesClient from "@/components/rates/rate-overrides-client";
import { canAccessSection } from "@/lib/permissions";
import { redirect } from "next/navigation";

type Membership = { organization_id: string; role: string };
type RoomTypeOption = { id: string; name: string };

export default async function RatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await getServerUser();
  const t = await getTranslations("rates");

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!org) {
    return <div className="text-sm text-muted-foreground">{t("noOrgFound")}</div>;
  }

  const { data: membershipRaw } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();
  const membership = membershipRaw as Membership | null;

  if (!membership) {
    return <div className="text-sm text-muted-foreground">{t("noOrgFound")}</div>;
  }

  if (!canAccessSection(membership.role, "rates")) redirect(`/${slug}/dashboard`);

  const { data: roomTypes = [] } = await supabase
    .from("room_types")
    .select("id, name")
    .eq("organization_id", membership.organization_id)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm mt-0.5 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
        <RateOverridesClient roomTypes={(roomTypes ?? []) as RoomTypeOption[]} />
      </div>
    </div>
  );
}
