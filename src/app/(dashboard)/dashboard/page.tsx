import React from "react";
import { format } from "date-fns";
import { 
  Users, 
  TrendingUp, 
  PieChart,
  LogIn,
  CircleDollarSign,
  Filter
} from "lucide-react";

const colorMap: Record<string, { bg: string; text: string }> = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
};

// Removed 'async' to fix the "Objects are not valid as a React child (found: [object Promise])" error in Canvas preview
export default function DashboardPage() {
  // Use mock data so the UI can be previewed without the missing Supabase backend
  const today = format(new Date(), "yyyy-MM-dd");

  const occupancyCount = 38;
  const totalBeds = 45;
  const occupancyRate = 84;
  const arrivalsCount = 14;

  const arrivals = [
    {
      id: "1",
      reservation_number: "BKG-8832",
      check_in: today,
      check_out: "2026-05-29",
      status: "confirmed",
      guests: { first_name: "Marcus", last_name: "Vance", nationality: "United States" }
    },
    {
      id: "2",
      reservation_number: "AB-9910",
      check_in: today,
      check_out: "2026-05-26",
      status: "pending",
      guests: { first_name: "Clara", last_name: "Jenkins", nationality: "United Kingdom" }
    },
    {
      id: "3",
      reservation_number: "DIR-0042",
      check_in: today,
      check_out: "2026-05-31",
      status: "confirmed",
      guests: { first_name: "Sora", last_name: "Takahashi", nationality: "Japan" }
    },
    {
      id: "4",
      reservation_number: "WLK-001",
      check_in: today,
      check_out: "2026-05-27",
      status: "confirmed",
      guests: { first_name: "Lucas", last_name: "Wright", nationality: "Australia" }
    }
  ];

  // Adaptado para encajar con el nuevo diseño
  const stats = [
    {
      label: "Occupancy Rate",
      value: `${occupancyRate}.2%`,
      detailLine1: `${occupancyCount}/${totalBeds} beds occupied`,
      icon: PieChart,
      color: "indigo" as const,
    },
    {
      label: "Arrivals today",
      value: arrivalsCount ?? 0,
      detailLine1: `8 Checked in · 6 Pending`,
      icon: LogIn,
      color: "amber" as const,
    },
    {
      label: "Daily Revenue",
      value: "$1,240",
      detailLine1: "+12% Direct channels",
      icon: CircleDollarSign,
      color: "emerald" as const,
    },
  ];

  return (
    <div className="w-full space-y-10 p-8">
      {/* Section Title */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Today's Overview</h2>
          <p className="text-sm text-slate-500 mt-2">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* 3 Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {stats.map((stat) => {
          const colors = colorMap[stat.color];
          return (
            <div
              key={stat.label}
              className="bg-white p-10 rounded-2xl border border-slate-200 shadow-lg flex items-center justify-between group hover:shadow-xl hover:border-slate-300 transition-all cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {stat.label}
                </p>
                <h3 className="text-3xl font-bold text-slate-900 mb-2">
                  {stat.value}
                </h3>
                <p className="text-sm text-slate-600">
                  <span className={`${colors.text}`}>{stat.detailLine1}</span>
                </p>
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${colors.bg} ${colors.text}`}>
                <stat.icon className="w-8 h-8" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Arrivals Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Dynamic Arrivals Schedule</h3>
            <p className="text-xs text-slate-500 mt-0.5">Manage guests arriving today</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[11px] font-semibold rounded-full uppercase tracking-wider">
              {arrivals?.length || 0} Arrivals
            </span>
            <button className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
          </div>
        </div>

        {arrivals && arrivals.length > 0 ? (
          <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs text-slate-500 font-medium">
                  <th className="py-3 px-5 w-1/4">Guest Profile</th>
                  <th className="py-3 px-5">Nationality</th>
                  <th className="py-3 px-5">Check-out</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {arrivals.map((res: any) => {
                  const firstName = res.guests?.first_name || "";
                  const lastName = res.guests?.last_name || "";
                  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

                  return (
                    <tr key={res.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs border border-slate-200">
                            {initials || "G"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {firstName} {lastName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              ID: #{res.reservation_number || res.id.slice(0,6)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <p className="font-medium text-slate-700">{res.guests?.nationality || "—"}</p>
                      </td>
                      <td className="py-3 px-5 text-slate-600 text-xs">
                        {format(new Date(res.check_out), "MMM d, yyyy")}
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium capitalize ${
                          res.status === "confirmed"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                            : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}>
                          {res.status}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                          Check In
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Users className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-900">No arrivals today</p>
            <p className="text-xs text-slate-500 mt-1">Your arrivals queue is clear.</p>
          </div>
        )}
      </div>
    </div>
  );
}