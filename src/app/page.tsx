import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/landing-page";

export default async function RootPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, organizations(slug)")
      .eq("user_id", user.id)
      .single();
    const slug = (membership as any)?.organizations?.slug;
    redirect(slug ? `/${slug}/dashboard` : "/onboarding");
  }

  return <LandingPage />;
}
