import { createServerClient } from "@/lib/supabase/server";
import ChannelsClient from "@/components/channels/channels-client";

export default async function ChannelsPage() {
  const supabase = await createServerClient();

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .single();

  if (!membership) return <div>Error loading channels</div>;

  const orgId = (membership as any).organization_id as string;

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
