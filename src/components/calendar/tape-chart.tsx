"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import { useTranslations } from "next-intl";
import { format, addDays, startOfDay, differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Hotel,
  BedDouble,
  CheckCircle2,
  Clock,
  Ban,
  User,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

const DAY_WIDTH = 52;
const ROW_HEIGHT = 56;
const LABEL_WIDTH = 220;

interface Bed {
  id: string;
  name: string;
  position: number | null;
  housekeeping_status?: string;
  rooms: {
    id: string;
    name: string;
    room_types: { id: string; name: string; type: string } | null;
  } | null;
}

interface ReservationBlock {
  id: string;
  bed_id: string;
  check_in: string;
  check_out: string;
  price_per_night: number;
  reservations: {
    id: string;
    reservation_number: string;
    status: string;
    guests: { first_name: string; last_name: string } | null;
  } | null;
}

interface TapeChartProps {
  beds: Bed[];
  reservations: ReservationBlock[];
  orgId: string;
  onEmptyCell?: (bedId: string, date: string) => void;
  onExistingBlock?: (reservationId: string) => void;
}

const STATUS_COLORS: Record<
  string,
  { bg: string; border: string; text: string; icon: ElementType }
> = {
  confirmed: {
    bg: "bg-[#E0EADB]",
    border: "border-[#C5D6BC]",
    text: "text-[#4A6740]",
    icon: CheckCircle2,
  },
  pending: {
    bg: "bg-[#F0E6CD]",
    border: "border-[#E0D0A8]",
    text: "text-[#8A6A16]",
    icon: Clock,
  },
  checked_in: {
    bg: "bg-[#DDE7F0]",
    border: "border-[#C2D2E2]",
    text: "text-[#3A5F82]",
    icon: User,
  },
  checked_out: {
    bg: "bg-[#E8E2D4]",
    border: "border-[#D6CDB8]",
    text: "text-[#6F6857]",
    icon: CheckCircle2,
  },
  cancelled: {
    bg: "bg-[#EEDCD5]",
    border: "border-[#E0C4B8]",
    text: "text-[#9C4A37]",
    icon: Ban,
  },
  no_show: {
    bg: "bg-muted",
    border: "border-border",
    text: "text-muted-foreground",
    icon: AlertCircle,
  },
};

const ROOM_TYPE_STYLES: Record<string, { chip: string }> = {
  dorm: {
    chip: "bg-[#DDE7F0] text-[#3A5F82] border-[#C2D2E2]",
  },
  private: {
    chip: "bg-[#E0EADB] text-[#4A6740] border-[#C5D6BC]",
  },
};

export default function TapeChart({ beds, reservations, onEmptyCell, onExistingBlock }: TapeChartProps) {
  const t = useTranslations("calendar.tapeChart");
  const roomTypeLabels: Record<string, string> = {
    dorm: t("roomTypeDorm"),
    private: t("roomTypePrivate"),
  };
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayStr = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const startDate = useMemo(() => addDays(today, -5), [today]);
  const days = useMemo(() => Array.from({ length: 60 }, (_, i) => addDays(startDate, i)), [startDate]);

  const bedsByRoom = useMemo(
    () =>
      beds.reduce<Record<string, { roomName: string; type: string; beds: Bed[] }>>((acc, bed) => {
        const roomId = bed.rooms?.id ?? "unknown";
        if (!acc[roomId]) {
          acc[roomId] = {
            roomName: bed.rooms?.name ?? t("unknownRoom"),
            type: bed.rooms?.room_types?.type ?? "dorm",
            beds: [],
          };
        }
        acc[roomId].beds.push(bed);
        return acc;
      }, {}),
    [beds]
  );

  const blocksByBed = useMemo(
    () =>
      reservations
        .filter((res) => {
          const status = res.reservations?.status;
          return status !== "cancelled" && status !== "no_show";
        })
        .reduce<Record<string, ReservationBlock[]>>((acc, block) => {
          if (!acc[block.bed_id]) acc[block.bed_id] = [];
          acc[block.bed_id].push(block);
          return acc;
        }, {}),
    [reservations]
  );


  if (beds.length === 0) {
    return (
      <div className="rounded-xl border border-border flex items-center justify-center bg-surface shadow-sm" style={{ height: 320 }}>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{t("noBeds")}</p>
          <p className="text-xs mt-1 text-muted-foreground">{t("noBedsHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden flex flex-col relative transition-shadow duration-300 hover:shadow-md">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("availabilityTimeline")}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-200 border border-border" aria-hidden="true" />
          <span>{t("pastDatesLocked")}</span>
        </div>
      </div>
      {/* Scrollable Container - Content and Header inside */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100dvh-240px)] tape-chart-container relative">
        <div style={{ width: LABEL_WIDTH + days.length * DAY_WIDTH, minWidth: "100%" }}>
          {/* Header Row - Sticky to top, scrolls with horizontal content */}
          <div className="flex sticky top-0 z-40 bg-surface border-b border-border shadow-sm">
            <div
              className="shrink-0 bg-muted border-r border-border flex items-center px-4 sticky left-0 z-50"
              style={{ width: LABEL_WIDTH, height: 48 }}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{t("propertyUnit")}</span>
            </div>
            <div className="flex bg-muted/40 backdrop-blur-sm">
              {days.map((day) => {
                const isToday = format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "shrink-0 flex flex-col items-center justify-center border-r border-border transition-colors duration-200",
                      isToday ? "bg-[#DDE7F0] text-[#3A5F82]" : "text-muted-foreground hover:bg-background"
                    )}
                    style={{ width: DAY_WIDTH, height: 48 }}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{format(day, "MMM")}</span>
                    <span className="text-xs font-bold">{format(day, "d")}</span>
                  </div>
                );
              })}
            </div>
          </div>

      {/* Body */}
      <div className="pb-12">
        {Object.entries(bedsByRoom).map(([roomId, { roomName, type, beds: roomBeds }], roomIndex) => (
          <div key={roomId}>
            {/* Room Section Header */}
            <div
              className={cn(
                "flex bg-muted border-b border-border w-full transition-all duration-500",
                animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
              )}
              style={{ transitionDelay: `${roomIndex * 35}ms` }}
            >
              <div
                className="px-4 py-2 flex items-center gap-2 sticky left-0 z-30 bg-muted border-r border-border"
                style={{ width: LABEL_WIDTH }}
              >
                {type === "dorm" ? <Hotel className="w-3.5 h-3.5 text-muted-foreground" /> : <BedDouble className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="text-xs font-bold uppercase tracking-wider text-foreground truncate">{roomName}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider",
                    (ROOM_TYPE_STYLES[type]?.chip ?? ROOM_TYPE_STYLES.dorm.chip)
                  )}
                >
                  {roomTypeLabels[type] ?? roomTypeLabels.dorm}
                </span>
              </div>
            </div>

            {/* Bed Rows */}
            {[...roomBeds]
              .sort((a, b) => {
                const aPos = a.position ?? Number.MAX_SAFE_INTEGER;
                const bPos = b.position ?? Number.MAX_SAFE_INTEGER;
                return aPos - bPos || a.name.localeCompare(b.name);
              })
              .map((bed, bedIndex) => {
              const blocks = blocksByBed[bed.id] ?? [];
              return (
                <div
                  key={bed.id}
                  className={cn(
                    "flex group hover:bg-background/50 transition-all duration-500 border-b border-border",
                    animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  )}
                  style={{
                    height: ROW_HEIGHT,
                    transitionDelay: `${roomIndex * 35 + bedIndex * 24 + 60}ms`,
                  }}
                >
                  {/* Bed Label */}
                  <div
                    className="shrink-0 flex items-center px-4 border-r border-border bg-surface group-hover:bg-background sticky left-0 z-20 transition-colors"
                    style={{ width: LABEL_WIDTH }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-medium text-foreground truncate pr-2">{bed.name}</span>
                      {(bed.housekeeping_status === "dirty" || bed.housekeeping_status === "out_of_order") && (
                        <span
                          className="shrink-0 inline-flex"
                          title={t(`housekeepingWarning_${bed.housekeeping_status}`)}
                        >
                          <AlertTriangle
                            className={`w-3 h-3 ${
                              bed.housekeeping_status === "out_of_order" ? "text-red-500" : "text-amber-500"
                            }`}
                            aria-label={t(`housekeepingWarning_${bed.housekeeping_status}`)}
                          />
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono">#{bed.id.slice(0, 3)}</span>
                    </div>
                  </div>

                  {/* Days Grid */}
                  <div className="relative flex-1 flex">
                    {days.map((day, i) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const isPastDate = dateStr < todayStr;
                      const hasReservation = blocks.some((b) => parseISO(b.check_in) <= day && parseISO(b.check_out) > day);

                      return (
                        <div
                          key={i}
                          className={cn(
                            "shrink-0 border-r border-border/60 transition-colors duration-150",
                            hasReservation
                              ? ""
                              : isPastDate
                                ? "bg-background/40 cursor-not-allowed"
                                : "cursor-pointer hover:bg-[#DDE7F0]/40"
                          )}
                          style={{ width: DAY_WIDTH }}
                          title={isPastDate ? t("pastDatesTooltip") : undefined}
                          onClick={() => !hasReservation && !isPastDate && onEmptyCell?.(bed.id, dateStr)}
                        />
                      );
                    })}

                    {/* Reservation Blocks — grouped by reservation so multi-segment stays render as one block */}
                    {(() => {
                      const resMap = new Map<string, { res: any; minCheckIn: string; maxCheckOut: string }>();
                      for (const block of blocks) {
                        const resId = block.reservations?.id;
                        if (!resId) continue;
                        const existing = resMap.get(resId);
                        if (!existing) {
                          resMap.set(resId, { res: block.reservations, minCheckIn: block.check_in, maxCheckOut: block.check_out });
                        } else {
                          if (block.check_in < existing.minCheckIn) existing.minCheckIn = block.check_in;
                          if (block.check_out > existing.maxCheckOut) existing.maxCheckOut = block.check_out;
                        }
                      }

                      return Array.from(resMap.values()).map(({ res, minCheckIn, maxCheckOut }) => {
                        const start = parseISO(minCheckIn);
                        const end = parseISO(maxCheckOut);
                        const offsetDays = differenceInDays(start, days[0]);
                        const durationDays = differenceInDays(end, start);
                        if (offsetDays + durationDays <= 0 || offsetDays >= days.length) return null;

                        const status = res?.status ?? "pending";
                        const colors = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
                        const Icon = colors.icon;
                        const channelColor = res?.channels?.color;
                        const isOTA = res?.channel_source && res?.channel_source !== "direct";
                        const guestFirst = res?.guests?.first_name ?? "Unknown";
                        const guestLast = res?.guests?.last_name ?? "";
                        const fullName = `${guestFirst} ${guestLast}`.trim();
                        const totalAmount = Number(res?.total_amount ?? 0);

                        return (
                          <div
                            key={res?.id}
                            className={cn(
                              "absolute top-1.5 bottom-1.5 rounded-md border shadow-sm flex flex-col px-2 py-1 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 z-10",
                              colors.bg,
                              colors.border
                            )}
                            style={{
                              left: offsetDays * DAY_WIDTH + 2,
                              width: Math.max(durationDays * DAY_WIDTH - 4, 30),
                              ...(isOTA && channelColor ? { borderLeftColor: channelColor, borderLeftWidth: 3 } : {}),
                            }}
                            title={t("blockTooltip", { name: fullName, amount: totalAmount.toFixed(2), checkIn: minCheckIn, checkOut: maxCheckOut })}
                            onClick={() => { if (res?.id) onExistingBlock?.(res.id); }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if ((event.key === "Enter" || event.key === " ") && res?.id) {
                                event.preventDefault();
                                onExistingBlock?.(res.id);
                              }
                            }}
                          >
                            <div className="flex items-center gap-1 overflow-hidden w-full">
                              <div className={cn("w-4 h-4 rounded-sm flex items-center justify-center shrink-0 bg-surface/60", colors.text)}>
                                <Icon className="w-2.5 h-2.5" />
                              </div>
                              <span className={cn("truncate text-[10px] font-semibold tracking-tight", colors.text)}>{fullName}</span>
                            </div>
                            <span className={cn("truncate text-[8px] font-medium", colors.text)}>
                              {isOTA ? res?.channel_source?.replace("_", ".") : t("totalSuffix", { amount: totalAmount.toFixed(2) })}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
        </div>
      </div>
    </div>
  );
}
