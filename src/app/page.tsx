import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, organizations(slug)")
    .eq("user_id", user.id)
    .single();

  const slug = (membership as any)?.organizations?.slug;
  if (slug) redirect(`/${slug}/dashboard`);
  redirect("/onboarding");
}
