import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Signs out any current session then redirects to signup flow.
// Used by demo "Create your account" links so demo session doesn't block signup.
export default async function SignupPage() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login?mode=signup");
}
