import { createServerClient } from "@/lib/supabase/server";
import PropertySettingsClient from "@/components/settings/property-settings-client";

export default async function PropertySettingsPage() {
  const supabase = await createServerClient();

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .single();

  if (!membership) return <div>Error loading settings</div>;

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", (membership as any).organization_id)
    .single();

  return <PropertySettingsClient org={org ?? {}} userRole={(membership as any).role} />;
}
