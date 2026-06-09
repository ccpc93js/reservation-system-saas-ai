"use client";

import { useState } from "react";
import { Users, Filter } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Arrival {
  id: string;
  reservation_number: string;
  check_in: string;
  check_out: string;
  status: string;
  guests: {
    id: string;
    first_name: string;
    last_name: string;
    nationality: string | null;
  } | null;
}

interface ArrivalsScheduleProps {
  initialArrivals: Arrival[];
}

export default function ArrivalsSchedule({ initialArrivals }: ArrivalsScheduleProps) {
  const [arrivals, setArrivals] = useState<Arrival[]>(initialArrivals);
  const [checking, setChecking] = useState<string | null>(null);

  const handleCheckIn = async (resId: string) => {
    setChecking(resId);
    try {
      const response = await fetch(`/api/reservations/${resId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "checked_in" }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to check in");
        return;
      }

      setArrivals(prev =>
        prev.map(arr => (arr.id === resId ? { ...arr, status: "checked_in" } : arr))
      );
      toast.success("Guest checked in");
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error("Failed to check in guest");
    } finally {
      setChecking(null);
    }
  };

  return (
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
                <th className="py-3 px-5">Check-in</th>
                <th className="py-3 px-5">Nationality</th>
                <th className="py-3 px-5">Check-out</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {arrivals.map((res) => {
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
                            ID: #{res.reservation_number || res.id.slice(0, 6)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-slate-600 text-xs">
                      {format(new Date(res.check_in), "MMM d, yyyy")}
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
                          : res.status === "checked_in"
                          ? "bg-blue-50 text-blue-800 border-blue-100"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      }`}>
                        {res.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      {res.status !== "checked_in" ? (
                        <button
                          onClick={() => handleCheckIn(res.id)}
                          disabled={checking === res.id}
                          className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {checking === res.id ? "Checking in..." : "Check In"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">Checked in</span>
                      )}
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
  );
}
