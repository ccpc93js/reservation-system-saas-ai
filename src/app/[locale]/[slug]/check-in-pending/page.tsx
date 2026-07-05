import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/session";
import PendingCheckInsClient from "@/components/dashboard/pending-check-ins-client";

export const metadata = {
  title: "Pending Check-Ins",
  description: "Review and verify guest check-ins",
};

export default async function CheckInPendingPage() {
  const { supabase, user } = await getServerUser();

  // Get org
  const { data: membership } = await supabase
    .from("memberships")
    .select("organizations(id)")
    .eq("user_id", user.id)
    .single();

  const orgId = (membership as any)?.organizations?.id;
  if (!orgId) redirect("/onboarding");

  return <PendingCheckInsClient />;
}
