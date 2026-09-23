import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import PropertySettingsClient from "@/components/settings/property-settings-client";
import { canAccessSection } from "@/lib/permissions";

export default async function PropertySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data: { user: _authUser } } = await supabase.auth.getUser();
  const t = await getTranslations("settings.property");

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
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

  // Property settings are manager+ only.
  if (!canAccessSection(membership.role, "settings/property")) redirect(`/${slug}/dashboard`);

  return <PropertySettingsClient org={org ?? {}} userRole={membership.role} />;
}
