import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// Root page: redirect to dashboard if logged in, otherwise to login
export default async function RootPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
