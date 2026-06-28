import { createServerClient } from "@/lib/supabase/server";
import TeamSettingsClient from "@/components/settings/team-settings-client";

export default async function TeamSettingsPage() {
  const supabase = await createServerClient();

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .single();

  if (!membership) return <div>Error loading team</div>;

  return (
    <TeamSettingsClient
      orgId={(membership as any).organization_id}
      userRole={(membership as any).role}
    />
  );
}
