"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, DollarSign, Calendar, Home, RefreshCw, PieChart } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

interface AnalyticsClientProps {
  bookingTrends: Array<{ date: string; bookings: number }>;
  revenueTrends: Array<{ date: string; revenue: number }>;
  topRooms: Array<{ room: string; revenue: number }>;
  occupancyTimeline: Array<{ date: string; occupancy: number }>;
}

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

  // Summary stats computed from 30-day trend arrays
  const totalBookings = bookingTrends.reduce((s, d) => s + d.bookings, 0);
  const totalRevenue = revenueTrends.reduce((s, d) => s + d.revenue, 0);
  const avgOccupancy = occupancyTimeline.length
    ? Math.round(occupancyTimeline.reduce((s, d) => s + d.occupancy, 0) / occupancyTimeline.length)
    : 0;
  const adr = totalBookings ? Math.round(totalRevenue / totalBookings) : 0;

  const fmtMoney = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

  const stats = [
    { label: t("statTotalBookings"), value: totalBookings.toLocaleString(), detail: t("statLast30d"), icon: Calendar },
    { label: t("statRevenue"), value: fmtMoney(totalRevenue), detail: t("statLast30d"), icon: DollarSign },
    { label: t("statOccupancy"), value: `${avgOccupancy}%`, detail: t("statAvg30d"), icon: PieChart },
    { label: t("statAdr"), value: `$${adr}`, detail: t("statAvgDailyRate"), icon: TrendingUp },
  ];

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
        <div className="rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-xl font-semibold text-foreground">{t("bookingTrends")}</h2>
          </div>
          {bookingTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bookingTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  labelStyle={{ color: "var(--color-foreground)" }}
                />
                <Line type="monotone" dataKey="bookings" stroke="var(--color-primary)" dot={{ fill: "var(--color-primary)" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {t("noBookingData")}
            </div>
          )}
        </div>

        {/* Revenue Trends */}
        <div className="rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h2 className="font-serif text-xl font-semibold text-foreground">{t("revenueTrends")}</h2>
          </div>
          {revenueTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  labelStyle={{ color: "var(--color-foreground)" }}
                />
                <Bar dataKey="revenue" fill="var(--color-emerald-600)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {t("noRevenueData")}
            </div>
          )}
        </div>

        {/* Occupancy Timeline */}
        <div className="rounded-lg border border-border bg-surface p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#3A5F82]" />
            <h2 className="font-serif text-xl font-semibold text-foreground">{t("occupancyTimeline")}</h2>
          </div>
          {occupancyTimeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={occupancyTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  labelStyle={{ color: "var(--color-foreground)" }}
                />
                <Area type="monotone" dataKey="occupancy" fill="#3A5F82" stroke="#3A5F82" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              {t("noOccupancyData")}
            </div>
          )}
        </div>

        {/* Top Rooms */}
        <div className="rounded-lg border border-border bg-surface p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-amber-600" />
            <h2 className="font-serif text-xl font-semibold text-foreground">{t("topRoomsByRevenue")}</h2>
          </div>
          {topRooms.length > 0 ? (
            <div className="space-y-3">
              {topRooms.map((room, idx) => (
                <div key={room.room} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm font-semibold text-amber-700">
                      #{idx + 1}
                    </div>
                    <span className="font-medium text-foreground">{room.room}</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">${room.revenue.toLocaleString()}</span>
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
