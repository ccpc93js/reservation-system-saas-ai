"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, DollarSign, Calendar, RefreshCw, PieChart } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

interface AnalyticsClientProps {
  // booking/revenue trends carry 60 days so we can compare last-30 vs prev-30
  bookingTrends: Array<{ date: string; bookings: number }>;
  revenueTrends: Array<{ date: string; revenue: number }>;
  topRooms: Array<{ room: string; revenue: number }>;
  occupancyTimeline: Array<{ date: string; occupancy: number }>;
}

const SAGE = "#A3B18A";
const GOLD = "#D0A94A";

export default function AnalyticsClient({
  bookingTrends,
  revenueTrends,
  topRooms,
  occupancyTimeline,
}: AnalyticsClientProps) {
  const t = useTranslations("analytics");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  // Split the 60-day trend arrays into current 30 vs previous 30 for deltas.
  const half = (arr: any[]) => {
    const n = arr.length;
    const cut = n > 30 ? n - 30 : Math.floor(n / 2);
    return { prev: arr.slice(0, cut), curr: arr.slice(cut) };
  };
  const sum = (arr: any[], key: string) => arr.reduce((s, d) => s + (d[key] || 0), 0);
  const pctDelta = (curr: number, prev: number) =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;
  const fmtDelta = (d: number) => `${d >= 0 ? "+" : ""}${d}% ${t("statVsPrev")}`;

  const bk = half(bookingTrends);
  const rv = half(revenueTrends);
  const bookingChart = bk.curr;
  const revenueChart = rv.curr;

  const totalBookings = sum(bk.curr, "bookings");
  const prevBookings = sum(bk.prev, "bookings");
  const totalRevenue = sum(rv.curr, "revenue");
  const prevRevenue = sum(rv.prev, "revenue");
  const avgOccupancy = occupancyTimeline.length
    ? Math.round(occupancyTimeline.reduce((s, d) => s + d.occupancy, 0) / occupancyTimeline.length)
    : 0;
  const adr = totalBookings ? Math.round(totalRevenue / totalBookings) : 0;

  const fmtMoney = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

  const maxRoomRevenue = topRooms.reduce((m, r) => Math.max(m, r.revenue), 0) || 1;

  const stats = [
    { label: t("statTotalBookings"), value: totalBookings.toLocaleString(), detail: fmtDelta(pctDelta(totalBookings, prevBookings)), icon: Calendar },
    { label: t("statRevenue"), value: fmtMoney(totalRevenue), detail: fmtDelta(pctDelta(totalRevenue, prevRevenue)), icon: DollarSign },
    { label: t("statOccupancy"), value: `${avgOccupancy}%`, detail: t("statAvg30d"), icon: PieChart },
    { label: t("statAdr"), value: `$${adr}`, detail: t("statAvgDailyRate"), icon: TrendingUp },
  ];

  const tooltipStyle = {
    contentStyle: { background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8 },
    labelStyle: { color: "hsl(var(--text))" },
  };

  return (
    <div className="w-full space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-border bg-background hover:bg-muted disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          {t("refresh")}
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface border border-border rounded-2xl p-6 flex items-start justify-between gap-4"
          >
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {stat.label}
              </p>
              <p className="font-serif text-4xl font-semibold text-foreground leading-none mb-2">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.detail}</p>
            </div>
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-primary"
              style={{ background: "color-mix(in srgb, hsl(var(--accent)) 12%, transparent)" }}
            >
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Trends */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-semibold text-foreground mb-4">{t("bookingTrends")}</h2>
          {bookingChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bookingChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} {...tooltipStyle} />
                <Bar dataKey="bookings" fill={SAGE} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              {t("noBookingData")}
            </div>
          )}
        </div>

        {/* Revenue Trends */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-semibold text-foreground mb-4">{t("revenueTrends")}</h2>
          {revenueChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} {...tooltipStyle} />
                <Bar dataKey="revenue" fill={GOLD} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              {t("noRevenueData")}
            </div>
          )}
        </div>

        {/* Top Rooms — horizontal bars */}
        <div className="rounded-2xl border border-border bg-surface p-6 lg:col-span-2">
          <h2 className="font-serif text-xl font-semibold text-foreground mb-4">{t("topRoomsByRevenue")}</h2>
          {topRooms.length > 0 ? (
            <div className="space-y-4">
              {topRooms.map((room) => (
                <div key={room.room} className="flex items-center gap-4">
                  <span className="w-40 shrink-0 text-sm font-medium text-foreground truncate">{room.room}</span>
                  <div className="flex-1 h-3 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, (room.revenue / maxRoomRevenue) * 100)}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm font-semibold text-foreground">
                    ${room.revenue.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground">
              {t("noRoomData")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
