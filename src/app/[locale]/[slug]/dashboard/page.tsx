import React from "react";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  PieChart,
  LogIn,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { getOccupancyMetrics, getRevenueMetrics, getArrivalsToday, getActiveReservations, getAverageBookingNights } from "@/lib/metrics";
import ArrivalsSchedule from "@/components/dashboard/arrivals-schedule";

const colorMap: Record<string, { bg: string; text: string }> = {
  indigo: { bg: "bg-[#DDE7F0]", text: "text-[#3A5F82]" },
  amber: { bg: "bg-amber-50", text: "text-amber-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
};

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get org
  const { data: membership } = await supabase
    .from("memberships")
    .select("organizations(id)")
    .eq("user_id", user.id)
    .single();

  const orgId = (membership as any)?.organizations?.id;
  if (!orgId) redirect("/onboarding");

  // Setup progress checks (parallel with metrics)
  const [occupancy, revenue, arrivals, activeCount, avgNights, setupChecks] = await Promise.all([
    getOccupancyMetrics(orgId),
    getRevenueMetrics(orgId),
    getArrivalsToday(orgId),
    getActiveReservations(orgId),
    getAverageBookingNights(orgId),
    Promise.all([
      supabase.from("room_types").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("beds").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    ]).then(([rt, r, b, res]) => ({
      hasRoomTypes: (rt.count ?? 0) > 0,
      hasRooms: (r.count ?? 0) > 0,
      hasBeds: (b.count ?? 0) > 0,
      hasReservations: (res.count ?? 0) > 0,
    })),
  ]);

  const occupancyCount = occupancy.occupiedBeds;
  const totalBeds = occupancy.totalBeds;
  const occupancyRate = occupancy.occupancyRate;
  const arrivalsCount = arrivals.length;

  const confirmedArrivals = arrivals.filter(a => a.status === "confirmed").length;
  const pendingArrivals = arrivals.filter(a => a.status === "pending").length;

  const stats = [
    {
      label: t("stats.occupancyRate"),
      value: `${occupancyRate}%`,
      detailLine1: t("stats.bedsOccupied", { count: occupancyCount, total: totalBeds }),
      detailLine2: occupancy.trend !== "flat"
        ? t(occupancy.trend === "up" ? "stats.trendUp" : "stats.trendDown", { percent: occupancy.trendPercent })
        : t("stats.noChange"),
      icon: PieChart,
      color: "indigo" as const,
    },
    {
      label: t("stats.arrivalsToday"),
      value: arrivalsCount,
      detailLine1: t("stats.confirmedPending", { confirmed: confirmedArrivals, pending: pendingArrivals }),
      icon: LogIn,
      color: "amber" as const,
    },
    {
      label: t("stats.monthlyRevenue"),
      value: `$${revenue.monthlyRevenue.toLocaleString()}`,
      detailLine1: t("stats.activeReservations", { count: activeCount }),
      detailLine2: t("stats.todayRevenue", { amount: revenue.dailyRevenue.toLocaleString() }),
      icon: CircleDollarSign,
      color: "emerald" as const,
    },
    {
      label: t("stats.avgBookingNights"),
      value: `${avgNights}`,
      detailLine1: t("stats.avgStayLength"),
      icon: LogIn,
      color: "amber" as const,
    },
  ];

  return (
    <div className="w-full space-y-10 p-8">
      {/* ── SETUP PROGRESS CARD — hidden once fully set up ── */}
      {setupChecks && !setupChecks.hasReservations && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">{t("setup.title")}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("setup.subtitle")}
              </p>
            </div>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              {t("setup.progress", { done: [true, setupChecks.hasRoomTypes, setupChecks.hasRooms, setupChecks.hasBeds, setupChecks.hasReservations].filter(Boolean).length })}
            </span>
          </div>
          <div className="space-y-2">
            {[
              { done: true, label: t("setup.steps.createProperty"), href: null },
              { done: setupChecks.hasRoomTypes, label: t("setup.steps.addRoomType"), href: "rooms", hint: t("setup.steps.addRoomTypeHint") },
              { done: setupChecks.hasRooms, label: t("setup.steps.addRoom"), href: "rooms", hint: t("setup.steps.addRoomHint") },
              { done: setupChecks.hasBeds, label: t("setup.steps.addBeds"), href: "rooms", hint: t("setup.steps.addBedsHint") },
              { done: setupChecks.hasReservations, label: t("setup.steps.firstReservation"), href: "reservations", hint: t("setup.steps.firstReservationHint") },
            ].map((step) => (
              <div key={step.label} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${step.done ? "opacity-50" : "bg-surface border border-border"}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? "bg-emerald-500" : "bg-muted border-2 border-border"}`}>
                  {step.done && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`text-sm flex-1 ${step.done ? "line-through text-muted-foreground" : "font-medium text-foreground"}`}>
                  {step.label}
                  {step.hint && !step.done && <span className="text-xs text-muted-foreground ml-2 font-normal">— {step.hint}</span>}
                </span>
                {!step.done && step.href && (
                  <a href={step.href} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                    {t("setup.go")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section Title */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-foreground">{t("todaysOverview")}</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* 4 Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const colors = colorMap[stat.color];
          return (
            <div
              key={stat.label}
              className="bg-surface border border-border rounded-2xl p-6 flex items-start justify-between gap-4"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {stat.label}
                </p>
                <h3 className="font-serif text-4xl font-semibold text-foreground mb-2 leading-none">
                  {stat.value}
                </h3>
                <p className="text-xs text-muted-foreground">
                  <span className={`${colors.text}`}>{(stat as any).detailLine1}</span>
                </p>
                {(stat as any).detailLine2 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(stat as any).detailLine2}
                  </p>
                )}
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors.bg} ${colors.text}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Arrivals Schedule */}
      <ArrivalsSchedule initialArrivals={arrivals} />
    </div>
  );
}