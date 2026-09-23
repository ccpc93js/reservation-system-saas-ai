import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/session";
import PendingCheckInsClient from "@/components/dashboard/pending-check-ins-client";

export const metadata = {
  title: "Pending Check-Ins",
  description: "Review and verify guest check-ins",
};

export default async function CheckInPendingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await getServerUser();

  // Get org
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!org) redirect("/onboarding");

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();
  if (!membership) redirect("/onboarding");

  return <PendingCheckInsClient />;
}
