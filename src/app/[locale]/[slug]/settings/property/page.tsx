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

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", _authUser?.id ?? "")
    .single();

  if (!membership) return <div>{t("errorLoading")}</div>;

  // Property settings are manager+ only.
  if (!canAccessSection((membership as any).role, "settings/property")) redirect(`/${slug}/dashboard`);

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", (membership as any).organization_id)
    .single();

  return <PropertySettingsClient org={org ?? {}} userRole={(membership as any).role} />;
}
