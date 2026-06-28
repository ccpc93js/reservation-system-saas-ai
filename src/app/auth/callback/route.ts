import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user already has an org
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: membership } = await supabase
          .from("memberships")
          .select("organization_id, organizations(slug)")
          .eq("user_id", user.id)
          .single();

        const slug = (membership as any)?.organizations?.slug;
        if (slug) {
          return NextResponse.redirect(`${origin}/${slug}/dashboard`);
        }
        // New user — go to onboarding
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  // Fallback
  return NextResponse.redirect(`${origin}${next}`);
}
