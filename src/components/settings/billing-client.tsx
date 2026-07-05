"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { CheckCircle, Zap, Building2, ExternalLink, CreditCard } from "lucide-react";
import { PLAN_LIMITS, PLAN_NAMES, PLAN_PRICES, type Plan } from "@/lib/plan";

interface Props {
  org: { id: string; name: string; plan: string; pending_plan?: string | null; stripe_customer_id: string | null; plan_expires_at: string | null };
  userRole: string;
  usage: { beds: number; users: number };
  required?: boolean;
}

const PLANS: { key: Plan; icon: any; color: string; highlight: boolean; priceId: string | null }[] = [
  {
    key: "free",
    icon: Building2,
    color: "#6b7280",
    highlight: false,
    priceId: null,
  },
  {
    key: "pro",
    icon: Zap,
    color: "#5f7048",
    highlight: true,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? "",
  },
  {
    key: "scale",
    icon: Building2,
    color: "#0f766e",
    highlight: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCALE_MONTHLY ?? "",
  },
];

function UsageBar({ current, max, label }: { current: number; max: number; label: string }) {
  const unlimited = max === -1;
  const pct = unlimited ? 0 : Math.min(100, (current / max) * 100);
  const near = pct >= 80;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${near ? "text-amber-500" : "text-foreground"}`}>
          {unlimited ? `${current} / ∞` : `${current} / ${max}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${near ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function BillingClient({ org, userRole, usage, required }: Props) {
  const t = useTranslations("settings.billing");
  const router = useRouter();
  const plan = (org.plan ?? "free") as Plan;
  const pendingPlan = (org.pending_plan ?? null) as Plan | null;
  const isAdmin = ["owner", "manager", "admin"].includes(userRole);
  const [loading, setLoading] = useState<string | null>(null);
  const limits = PLAN_LIMITS[plan];

  // Auto-trigger checkout when arriving from plan selection on landing page
  useEffect(() => {
    if (!required || !pendingPlan || !isAdmin) return;
    const pendingPlanConfig = PLANS.find(p => p.key === pendingPlan);
    if (!pendingPlanConfig?.priceId) return;
    handleUpgrade(pendingPlan, pendingPlanConfig.priceId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpgrade = async (targetPlan: Plan, priceId: string) => {
    if (!isAdmin) { toast.error(t("toastAdminOnly")); return; }
    setLoading(targetPlan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, plan: targetPlan, required: !!required }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.upgraded) {
        toast.success(t("toastPlanUpdated"));
        router.refresh();
      } else {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || t("toastCheckoutFailed"));
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || t("toastPortalFailed"));
    } finally {
      setLoading(null);
    }
  };

  const PLAN_ORDER = ["free", "pro", "scale"];

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Payment gate banner */}
      {required && pendingPlan && (
        <div className="rounded-2xl border-2 border-[#C9A24B] bg-[#F0E6CD] p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#C9A24B] flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-[#7A5B12] text-sm">{t("paymentRequiredTitle")}</p>
            <p className="text-xs text-[#8A6A16] mt-1">
              {t.rich("paymentRequiredDesc", {
                strong: (chunks) => <strong>{chunks}</strong>,
                plan: PLAN_NAMES[pendingPlan],
                price: PLAN_PRICES[pendingPlan],
              })}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold" style={{ color: "hsl(var(--text))" }}>{t("heading")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Top row: current plan + billing portal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current plan card with usage bars */}
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("currentPlanHeading")}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-serif text-3xl font-semibold text-foreground">{PLAN_NAMES[plan]}</span>
              <span className="text-sm text-muted-foreground">
                {plan === "free" ? t("freeForever") : PLAN_PRICES[plan]}
              </span>
            </div>
            {org.plan_expires_at && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("cancelsOn", { date: new Date(org.plan_expires_at).toLocaleDateString() })}
              </p>
            )}
          </div>
          {/* Usage progress bars — kept */}
          <div className="space-y-3 pt-4 border-t border-border">
            <UsageBar current={usage.beds} max={limits.beds} label={t("bedsLabel")} />
            <UsageBar current={usage.users} max={limits.users} label={t("teamMembersLabel")} />
          </div>
        </div>

        {/* Billing portal card */}
        <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col justify-center gap-4">
          {plan !== "free" && isAdmin ? (
            <>
              <p className="text-sm text-foreground leading-relaxed">
                {t("renewalNote", { plan: PLAN_NAMES[plan] })}
              </p>
              <button
                onClick={handleManageBilling}
                disabled={loading === "portal"}
                className="self-start flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-surface text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                {loading === "portal" ? t("opening") : t("manageBilling")}
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{t("subtitle")}</p>
          )}
        </div>
      </div>

      {/* Available plans */}
      <div className="space-y-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("availablePlans")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((p) => {
            const isCurrent = p.key === plan;
            const isUpgrade = PLAN_ORDER.indexOf(p.key) > PLAN_ORDER.indexOf(plan);
            const isPending = required && p.key === pendingPlan;

            return (
              <div key={p.key}
                className={`rounded-2xl border bg-surface p-6 flex flex-col transition-all ${
                  isCurrent ? "border-2 border-primary" :
                  isPending ? "border-2 border-[#C9A24B] ring-2 ring-[#E0D0A8]" :
                  "border-border"
                }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-serif text-2xl font-semibold text-foreground">{PLAN_NAMES[p.key]}</span>
                  {isCurrent && (
                    <span className="text-[10px] font-bold text-primary-foreground bg-primary px-2 py-0.5 rounded-full uppercase tracking-wider">{t("current")}</span>
                  )}
                </div>
                <p className="font-serif text-3xl font-semibold text-foreground mb-4">{PLAN_PRICES[p.key]}</p>
                <div className="space-y-2 flex-1 mb-5">
                  {(t.raw(`features.${p.key}`) as string[]).map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-[#4A6740] shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                {isCurrent ? (
                  <button disabled className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted text-muted-foreground cursor-default">
                    {t("currentPlanButton")}
                  </button>
                ) : p.priceId && isAdmin ? (
                  <button
                    onClick={() => handleUpgrade(p.key, p.priceId!)}
                    disabled={!!loading}
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                    style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)`, boxShadow: `0 4px 14px ${p.color}40` }}
                  >
                    {loading === p.key ? t("loadingEllipsis") : isUpgrade ? t("upgrade") : t("downgrade")}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground text-center">{t("adminOnlyNotice")}</p>
      )}
    </div>
  );
}
