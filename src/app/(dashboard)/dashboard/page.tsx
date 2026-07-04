import React from "react";
import { format } from "date-fns";
import { redirect } from "next/navigation";
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
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
};

export default async function DashboardPage() {
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

  // Fetch metrics
  const [occupancy, revenue, arrivals, activeCount, avgNights] = await Promise.all([
    getOccupancyMetrics(orgId),
    getRevenueMetrics(orgId),
    getArrivalsToday(orgId),
    getActiveReservations(orgId),
    getAverageBookingNights(orgId),
  ]);

  const occupancyCount = occupancy.occupiedBeds;
  const totalBeds = occupancy.totalBeds;
  const occupancyRate = occupancy.occupancyRate;
  const arrivalsCount = arrivals.length;

  const confirmedArrivals = arrivals.filter(a => a.status === "confirmed").length;
  const pendingArrivals = arrivals.filter(a => a.status === "pending").length;

  const stats = [
    {
      label: "Occupancy Rate",
      value: `${occupancyRate}%`,
      detailLine1: `${occupancyCount}/${totalBeds} beds occupied`,
      detailLine2: occupancy.trend !== "flat"
        ? `${occupancy.trend === "up" ? "↑" : "↓"} ${occupancy.trendPercent}% from yesterday`
        : "No change from yesterday",
      icon: PieChart,
      color: "indigo" as const,
    },
    {
      label: "Arrivals Today",
      value: arrivalsCount,
      detailLine1: `${confirmedArrivals} Confirmed · ${pendingArrivals} Pending`,
      icon: LogIn,
      color: "amber" as const,
    },
    {
      label: "Monthly Revenue",
      value: `$${revenue.monthlyRevenue.toLocaleString()}`,
      detailLine1: `Active: ${activeCount} reservations`,
      detailLine2: `Today: $${revenue.dailyRevenue.toLocaleString()}`,
      icon: CircleDollarSign,
      color: "emerald" as const,
    },
    {
      label: "Avg Booking Nights",
      value: `${avgNights}`,
      detailLine1: `Average stay length`,
      icon: LogIn,
      color: "amber" as const,
    },
  ];

  return (
    <div className="w-full space-y-10 p-8">
      {/* Section Title */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Today's Overview</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* 4 Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        {stats.map((stat) => {
          const colors = colorMap[stat.color];
          return (
            <div
              key={stat.label}
              className="bg-surface p-10 rounded-2xl border border-border shadow-lg flex items-center justify-between group hover:shadow-xl hover:border-border transition-all cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {stat.label}
                </p>
                <h3 className="text-3xl font-bold text-foreground mb-2">
                  {stat.value}
                </h3>
                <p className="text-sm text-muted-foreground">
                  <span className={`${colors.text}`}>{(stat as any).detailLine1}</span>
                </p>
                {(stat as any).detailLine2 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(stat as any).detailLine2}
                  </p>
                )}
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${colors.bg} ${colors.text}`}>
                <stat.icon className="w-8 h-8" />
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