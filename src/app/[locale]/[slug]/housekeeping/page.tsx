import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import HousekeepingClient from "@/components/housekeeping/housekeeping-client";

type Membership = { organization_id: string };

export default async function HousekeepingPage() {
  const supabase = await createServerClient();
  const t = await getTranslations("housekeeping");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <div className="text-sm text-muted-foreground">{t("unauthorized")}</div>;
  }

  const { data: membershipRaw } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  const membership = membershipRaw as Membership | null;

  if (!membership) {
    return <div className="text-sm text-muted-foreground">{t("noOrgFound")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm mt-0.5 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <HousekeepingClient orgId={membership.organization_id} />
    </div>
  );
}
