import { getServerUser } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import CheckinHistoryClient from "./checkin-history-client";

export default async function CheckinHistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase, user } = await getServerUser();

  const { data: orgRaw } = await supabase
    .from("organizations")
    .select("id, name, currency, plan, country")
    .eq("slug", slug)
    .single();
  const org = orgRaw as any;
  if (!org) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();
  if (!membership) redirect("/login");

  const { data: records } = await (supabase as any)
    .from("checkin_registry")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <CheckinHistoryClient
      records={records ?? []}
      orgName={org.name}
      orgCurrency={org.currency ?? "EUR"}
      orgId={org.id}
      orgPlan={org.plan ?? "free"}
      orgCountry={org.country ?? null}
    />
  );
}
