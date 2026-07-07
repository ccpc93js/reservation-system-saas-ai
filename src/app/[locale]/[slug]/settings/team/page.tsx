import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import TeamSettingsClient from "@/components/settings/team-settings-client";

export default async function TeamSettingsPage() {
  const supabase = await createServerClient();
  const { data: { user: _authUser } } = await supabase.auth.getUser();
  const t = await getTranslations("settings.team");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", _authUser?.id ?? "")
    .single();

  if (!membership) return <div>{t("errorLoading")}</div>;

  return (
    <TeamSettingsClient
      orgId={(membership as any).organization_id}
      userRole={(membership as any).role}
    />
  );
}
