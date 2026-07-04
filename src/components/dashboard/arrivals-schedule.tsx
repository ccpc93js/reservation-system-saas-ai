"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("dashboard.arrivals");
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
        toast.error(error.error || t("toastCheckInFailed"));
        return;
      }

      setArrivals(prev =>
        prev.map(arr => (arr.id === resId ? { ...arr, status: "checked_in" } : arr))
      );
      toast.success(t("toastCheckInSuccess"));
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error(t("toastCheckInFailed"));
    } finally {
      setChecking(null);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm flex flex-col">
      <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-semibold text-foreground">{t("title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-[#DDE7F0] text-[#3A5F82] text-[11px] font-semibold rounded-full uppercase tracking-wider">
            {t("count", { count: arrivals?.length || 0 })}
          </span>
          <button className="px-3 py-1.5 border border-border text-muted-foreground text-xs font-medium rounded-lg hover:bg-background transition-colors flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" /> {t("filter")}
          </button>
        </div>
      </div>

      {arrivals && arrivals.length > 0 ? (
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-background/70 border-b border-border text-xs text-muted-foreground font-medium">
                <th className="py-3 px-5 w-1/4">{t("colGuestProfile")}</th>
                <th className="py-3 px-5">{t("colCheckIn")}</th>
                <th className="py-3 px-5">{t("colNationality")}</th>
                <th className="py-3 px-5">{t("colCheckOut")}</th>
                <th className="py-3 px-5">{t("colStatus")}</th>
                <th className="py-3 px-5 text-right">{t("colAction")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {arrivals.map((res) => {
                const firstName = res.guests?.first_name || "";
                const lastName = res.guests?.last_name || "";
                const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

                return (
                  <tr key={res.id} className="hover:bg-background/50 transition-colors group">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-xs border border-border">
                          {initials || "G"}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {firstName} {lastName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {t("idPrefix", { id: res.reservation_number || res.id.slice(0, 6) })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-muted-foreground text-xs">
                      {format(new Date(res.check_in), "MMM d, yyyy")}
                    </td>
                    <td className="py-3 px-5">
                      <p className="font-medium text-foreground">{res.guests?.nationality || "—"}</p>
                    </td>
                    <td className="py-3 px-5 text-muted-foreground text-xs">
                      {format(new Date(res.check_out), "MMM d, yyyy")}
                    </td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium capitalize ${
                        res.status === "confirmed"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                          : res.status === "checked_in"
                          ? "bg-primary/10 text-primary border-primary/20"
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
                          className="px-3 py-1.5 bg-surface border border-border shadow-sm hover:border-border hover:bg-background text-foreground rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {checking === res.id ? t("checkingIn") : t("checkIn")}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("checkedIn")}</span>
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
          <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t("noArrivals")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("noArrivalsHint")}</p>
        </div>
      )}
    </div>
  );
}
