import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import GuestListClient from "@/components/guests/guest-list-client";

export default async function GuestsPage() {
  const supabase = await createServerClient();
  const t = await getTranslations("guests");

  // Get org context
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("organization_id")
    .single();

  if (error || !membership) {
    return <div>{t("errorLoading")}</div>;
  }

  const orgId = (membership as any).organization_id as string;

  // Load initial guests (first page, 25 per page)
  const { data: guests } = await supabase
    .from("guests")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(25);

  // Get total count
  const { count: totalGuests } = await supabase
    .from("guests")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  return (
    <GuestListClient
      initialGuests={guests ?? []}
      totalGuests={totalGuests ?? 0}
      orgId={orgId}
    />
  );
}
