import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BillingClient from "@/components/settings/billing-client";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string; success?: string }>;
}) {
  const { required } = await searchParams;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role, organizations(id, name, plan, pending_plan, stripe_customer_id, stripe_subscription_id, plan_expires_at)")
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/onboarding");

  const org = (membership as any).organizations;

  const [{ count: bedCount }, { count: userCount }] = await Promise.all([
    supabase.from("beds").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
  ]);

  return (
    <BillingClient
      org={org}
      userRole={(membership as any).role}
      usage={{ beds: bedCount ?? 0, users: userCount ?? 0 }}
      required={required === "true"}
    />
  );
}
