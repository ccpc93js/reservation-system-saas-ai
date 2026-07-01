import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

// Signs out any current session then redirects to signup flow.
// Used by demo "Create your account" links so demo session doesn't block signup.
export default async function SignupPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect({ href: "/login?mode=signup", locale });
}
