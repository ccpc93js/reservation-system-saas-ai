import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getServerUser } from "@/lib/supabase/session";
import DashboardLayoutClient from "@/components/layout/dashboard-layout-client";
import DemoWelcomeModal from "@/components/demo/demo-welcome-modal";
import { reconcilePendingPlan } from "@/lib/billing-reconcile";
import type { Metadata } from "next";

// Tenant app is private/auth-gated — keep it out of search indexes.
export const metadata: Metadata = { robots: { index: false, follow: false } };

function hexToHsl(hex: string): string {
  if (!hex || !hex.startsWith("#")) return "90 22% 36%";
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
  const { supabase, user } = await getServerUser();
  const t = await getTranslations("demoBanner");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, theme_color, plan, pending_plan, stripe_customer_id")
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

  // Safety net: if a subscription was paid but the webhook hasn't cleared
  // pending_plan yet, reconcile straight from Stripe so the payment gate below
  // doesn't loop the user back to checkout.
  if ((org as any).pending_plan && (org as any).stripe_customer_id) {
    const applied = await reconcilePendingPlan(org as any);
    if (applied) {
      (org as any).plan = applied;
      (org as any).pending_plan = null;
    }
  }

  const accentHsl = hexToHsl((org as any).theme_color ?? "#5f7048");
  const isDemo = slug === "demo-hostel";

  return (
    <>
      <style>{`:root { --accent: ${accentHsl}; --ring: ${accentHsl}; --primary: ${accentHsl}; }`}</style>

      {/* Demo welcome modal — shown once on first visit */}
      {isDemo && <DemoWelcomeModal slug={slug} />}

      {/* Demo mode banner */}
      {isDemo && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(90deg, #5f7048, #7f8a58, #5f7048)", backgroundSize: "200%", animation: "shimmer 3s linear infinite" }}>
          <style>{`@keyframes shimmer{0%{background-position:0%}100%{background-position:200%}}`}</style>
          <span>{t("message")}</span>
          <a href="/signup"
            className="underline underline-offset-2 hover:text-white/80 transition-colors">
            {t("createAccountCta")}
          </a>
        </div>
      )}

      <div className={isDemo ? "pt-8" : ""}>
        <DashboardLayoutClient
          org={org}
          userRole={membership.role}
          user={user}
          pendingPlan={(org as any).pending_plan ?? null}
        >
          {children}
        </DashboardLayoutClient>
      </div>
    </>
  );
}
