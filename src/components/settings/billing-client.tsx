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

  return (
    <div className="p-6 max-w-2xl space-y-8">
      {/* Payment gate banner */}
      {required && pendingPlan && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-amber-900 text-sm">{t("paymentRequiredTitle")}</p>
            <p className="text-xs text-amber-700 mt-1">
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
        <h1 className="text-2xl font-bold" style={{ color: "hsl(var(--text))" }}>{t("heading")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
      </div>

      {/* Current plan card */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">{t("planLabel", { name: PLAN_NAMES[plan] })}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                style={{ backgroundColor: PLANS.find(p => p.key === plan)?.color }}>
                {plan.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {plan === "free" ? t("freeForever") : PLAN_PRICES[plan]}
              {org.plan_expires_at && ` · ${t("cancelsOn", { date: new Date(org.plan_expires_at).toLocaleDateString() })}`}
            </p>
          </div>
          {plan !== "free" && org.stripe_customer_id && isAdmin && (
            <button onClick={handleManageBilling} disabled={loading === "portal"}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50">
              <CreditCard className="w-3.5 h-3.5" />
              {loading === "portal" ? t("opening") : t("manageBilling")}
            </button>
          )}
        </div>

        {/* Usage bars */}
        <div className="space-y-3 pt-2 border-t border-border">
          <UsageBar current={usage.beds} max={limits.beds} label={t("bedsLabel")} />
          <UsageBar current={usage.users} max={limits.users} label={t("teamMembersLabel")} />
        </div>
      </div>

      {/* Plans */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("availablePlans")}</p>
        {PLANS.map((p) => {
          const isCurrent = p.key === plan;
          const PLAN_ORDER = ["free", "pro", "scale"];
          const isUpgrade = PLAN_ORDER.indexOf(p.key) > PLAN_ORDER.indexOf(plan);

          return (
            <div key={p.key}
              className={`rounded-xl border p-5 transition-all ${
                isCurrent ? "border-primary/40 bg-primary/5" :
                (required && p.key === pendingPlan) ? "border-amber-400 bg-amber-50/50 ring-2 ring-amber-300" :
                "border-border bg-surface"
              }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-foreground">{PLAN_NAMES[p.key]}</span>
                    {isCurrent && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{t("current")}</span>}
                  </div>
                  <p className="text-lg font-extrabold text-foreground mb-3">{PLAN_PRICES[p.key]}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {(t.raw(`features.${p.key}`) as string[]).map((f) => (
                      <div key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>

                {!isCurrent && p.priceId && isAdmin && (
                  <button
                    onClick={() => handleUpgrade(p.key, p.priceId!)}
                    disabled={!!loading}
                    className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                    style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)`, boxShadow: `0 4px 14px ${p.color}40` }}
                  >
                    {loading === p.key ? t("loadingEllipsis") : isUpgrade ? t("upgrade") : t("downgrade")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground text-center">{t("adminOnlyNotice")}</p>
      )}
    </div>
  );
}
