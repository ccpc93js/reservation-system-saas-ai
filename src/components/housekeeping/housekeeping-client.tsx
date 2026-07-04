"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { useHousekeeping, type HousekeepingBed } from "@/lib/hooks/use-housekeeping";
import { HOUSEKEEPING_STATUSES, type HousekeepingStatus } from "@/lib/types/housekeeping";

const STATUS_COLORS: Record<HousekeepingStatus, string> = {
  clean: "bg-emerald-100 text-emerald-700 border-emerald-200",
  dirty: "bg-amber-100 text-amber-700 border-amber-200",
  inspected: "bg-blue-100 text-blue-700 border-blue-200",
  out_of_order: "bg-red-100 text-red-700 border-red-200",
};

export default function HousekeepingClient({ orgId }: { orgId: string }) {
  const t = useTranslations("housekeeping");
  const { beds, loaded, updateStatus, refetch } = useHousekeeping(orgId);
  const [filter, setFilter] = useState<"all" | "dirty" | "out_of_order">("all");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredBeds = useMemo(() => {
    if (filter === "all") return beds;
    return beds.filter((b) => b.housekeeping_status === filter);
  }, [beds, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { roomId: string; roomName: string; beds: HousekeepingBed[] }>();
    for (const bed of filteredBeds) {
      const roomId = bed.rooms?.id ?? "unassigned";
      const roomName = bed.rooms?.name ?? t("noRoom");
      if (!map.has(roomId)) map.set(roomId, { roomId, roomName, beds: [] });
      map.get(roomId)!.beds.push(bed);
    }
    return Array.from(map.values());
  }, [filteredBeds, t]);

  if (!loaded) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {(["all", "dirty", "out_of_order"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface text-foreground border-border hover:bg-muted"
              }`}
            >
              {t(`filter_${f}`)}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-border bg-background hover:bg-muted disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {t("refresh")}
        </button>
      </div>

      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">{t("empty")}</p>
      )}

      {grouped.map((group) => (
        <div key={group.roomId} className="bg-surface rounded-xl border border-border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">{group.roomName}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {group.beds.map((bed) => (
              <div key={bed.id} className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm font-medium text-foreground truncate">{bed.name}</p>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[bed.housekeeping_status]}`}
                >
                  {t(`status_${bed.housekeeping_status}`)}
                </span>
                <div className="flex flex-wrap gap-1">
                  {HOUSEKEEPING_STATUSES.filter((s) => s !== bed.housekeeping_status).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(bed.id, s)}
                      className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                    >
                      {t(`status_${s}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
