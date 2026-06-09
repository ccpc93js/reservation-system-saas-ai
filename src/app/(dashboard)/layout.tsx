import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import DashboardLayoutClient from "@/components/layout/dashboard-layout-client";

type MembershipWithOrg = {
  role: string;
  organizations: { id: string; name: string; slug: string };
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch the user's organization
  const { data: membershipRaw } = await supabase
    .from("memberships")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .single();

  const membership = membershipRaw as MembershipWithOrg | null;

  // If not in any org yet, redirect to onboarding
  if (!membership) redirect("/onboarding");

  const org = membership.organizations;

  return (
    <DashboardLayoutClient
      org={org}
      userRole={membership.role}
      user={user}
    >
      {children}
    </DashboardLayoutClient>
  );
}
