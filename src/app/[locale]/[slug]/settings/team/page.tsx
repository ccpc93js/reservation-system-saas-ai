import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import TeamSettingsClient from "@/components/settings/team-settings-client";

export default async function TeamSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data: { user: _authUser } } = await supabase.auth.getUser();
  const t = await getTranslations("settings.team");

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!org) return <div>{t("errorLoading")}</div>;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", _authUser?.id ?? "")
    .single();

  if (!membership) return <div>{t("errorLoading")}</div>;

  return (
    <TeamSettingsClient
      orgId={org.id}
      userRole={membership.role}
    />
  );
}
