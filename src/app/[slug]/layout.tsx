import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import DashboardLayoutClient from "@/components/layout/dashboard-layout-client";

function hexToHsl(hex: string): string {
  if (!hex || !hex.startsWith("#")) return "262 83% 54%";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, theme_color")
    .eq("slug", slug)
    .single();

  if (!org) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    const { data: myMembership } = await supabase
      .from("memberships")
      .select("organization_id, organizations(slug)")
      .eq("user_id", user.id)
      .single();
    const mySlug = (myMembership as any)?.organizations?.slug;
    if (mySlug) redirect(`/${mySlug}/dashboard`);
    redirect("/onboarding");
  }

  const accentHsl = hexToHsl((org as any).theme_color ?? "#7c3aed");

  return (
    <>
      {/* Inject org theme color as CSS variable override */}
      <style>{`:root { --accent: ${accentHsl}; --ring: ${accentHsl}; --primary: ${accentHsl}; }`}</style>
      <DashboardLayoutClient
        org={org}
        userRole={membership.role}
        user={user}
      >
        {children}
      </DashboardLayoutClient>
    </>
  );
}
