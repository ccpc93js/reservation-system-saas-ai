import { getServerUser } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import BillingClient from "@/components/settings/billing-client";
import { canAccessSection } from "@/lib/permissions";

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ required?: string; success?: string }>;
}) {
  const { slug } = await params;
  const { required, success } = await searchParams;
  const { supabase, user } = await getServerUser();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, plan, pending_plan, stripe_customer_id, stripe_subscription_id, plan_expires_at")
    .eq("slug", slug)
    .single();
  if (!org) redirect("/onboarding");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/onboarding");

  // Billing is owner-only.
  if (!canAccessSection(membership.role, "settings/billing")) redirect(`/${slug}/dashboard`);

  const [{ count: bedCount }, { count: userCount }] = await Promise.all([
    supabase.from("beds").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
  ]);

  return (
    <BillingClient
      org={org}
      userRole={membership.role}
      usage={{ beds: bedCount ?? 0, users: userCount ?? 0 }}
      required={required === "true"}
      success={success === "1"}
    />
  );
}
