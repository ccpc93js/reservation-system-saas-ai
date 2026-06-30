import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import OnboardingClient from "./onboarding-client";

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // If user already has an org, redirect them to it immediately
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, organizations(slug)")
    .eq("user_id", user.id)
    .single();

  if (membership) {
    const slug = (membership as any)?.organizations?.slug;
    redirect(slug ? `/${slug}/dashboard` : "/dashboard");
  }

  return <Suspense><OnboardingClient /></Suspense>;
}
