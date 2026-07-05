"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, BedDouble, ChevronDown } from "lucide-react";
import { useHousekeeping, type HousekeepingBed } from "@/lib/hooks/use-housekeeping";
import { HOUSEKEEPING_STATUSES, type HousekeepingStatus } from "@/lib/types/housekeeping";

// Botanical status palette — pill background/text + a solid dot color.
const STATUS_META: Record<HousekeepingStatus, { pill: string; dot: string }> = {
  clean: { pill: "bg-[#E0EADB] text-[#4A6740]", dot: "#4A6740" },
  dirty: { pill: "bg-[#F0E6CD] text-[#8A6A16]", dot: "#C9A24B" },
  inspected: { pill: "bg-[#DDE7F0] text-[#3A5F82]", dot: "#3A5F82" },
  out_of_order: { pill: "bg-[#EEDCD5] text-[#9C4A37]", dot: "#9C4A37" },
};

type Filter = "all" | HousekeepingStatus;

export default function HousekeepingClient({ orgId }: { orgId: string }) {
  const t = useTranslations("housekeeping");
  const { beds, loaded, updateStatus, refetch } = useHousekeeping(orgId);
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

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

  const filters: Filter[] = ["all", ...HOUSEKEEPING_STATUSES];

  return (
    <div className="space-y-6">
      {/* Filters + refresh */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
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
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-muted disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {t("refresh")}
        </button>
      </div>

      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center">{t("empty")}</p>
      )}

      {/* Grouped by room */}
      {grouped.map((group) => (
        <div key={group.roomId} className="space-y-3">
          <h3 className="font-serif text-lg font-semibold text-foreground">{group.roomName}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {group.beds.map((bed) => {
              const meta = STATUS_META[bed.housekeeping_status];
              const isOpen = openMenu === bed.id;
              return (
                <div
                  key={bed.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <BedDouble className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{bed.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{group.roomName}</p>
                  </div>

                  {/* Status pill = dropdown to change status */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setOpenMenu(isOpen ? null : bed.id)}
                      title={t("changeStatus")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${meta.pill}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
                      {t(`status_${bed.housekeeping_status}`)}
                      <ChevronDown className="w-3 h-3 opacity-70" />
                    </button>
                    {isOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                        <div className="absolute right-0 mt-1 z-20 w-40 rounded-xl border border-border bg-surface shadow-lg py-1">
                          {HOUSEKEEPING_STATUSES.map((s) => (
                            <button
                              key={s}
                              onClick={() => { updateStatus(bed.id, s); setOpenMenu(null); }}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-muted transition-colors ${
                                s === bed.housekeeping_status ? "font-semibold" : "text-foreground"
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_META[s].dot }} />
                              {t(`status_${s}`)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
