import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getPrimaryOrgSlug } from "@/lib/org-membership";

// Legacy route group — redirect all old /(dashboard)/* routes to /{slug}/*
export default async function LegacyDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const slug = await getPrimaryOrgSlug(supabase, user.id);
  if (slug) redirect(`/${slug}/dashboard`);
  redirect("/onboarding");

  // Never reached — satisfies Next.js layout contract
  return <>{children}</>;
}
