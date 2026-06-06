"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
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
} from "lucide-react";

const DAY_WIDTH = 52;
const ROW_HEIGHT = 56;
const LABEL_WIDTH = 220;

interface Bed {
  id: string;
  name: string;
  position: number | null;
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
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: CheckCircle2,
  },
  pending: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: Clock,
  },
  checked_in: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    icon: User,
  },
  checked_out: {
    bg: "bg-slate-100",
    border: "border-slate-200",
    text: "text-slate-600",
    icon: CheckCircle2,
  },
  cancelled: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: Ban,
  },
  no_show: {
    bg: "bg-slate-100",
    border: "border-slate-300",
    text: "text-slate-500",
    icon: AlertCircle,
  },
};

const ROOM_TYPE_STYLES: Record<string, { chip: string; label: string }> = {
  dorm: {
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    label: "Dorm",
  },
  private: {
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "Private",
  },
};

export default function TapeChart({ beds, reservations, onEmptyCell, onExistingBlock }: TapeChartProps) {
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
            roomName: bed.rooms?.name ?? "Unknown",
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
      reservations.reduce<Record<string, ReservationBlock[]>>((acc, block) => {
        if (!acc[block.bed_id]) acc[block.bed_id] = [];
        acc[block.bed_id].push(block);
        return acc;
      }, {}),
    [reservations]
  );

  // Merge overlapping blocks for each bed into continuous blocks
  const mergedBlocksByBed = useMemo(() => {
    const merged: Record<string, ReservationBlock[]> = {};

    Object.entries(blocksByBed).forEach(([bedId, blocks]) => {
      if (blocks.length === 0) {
        merged[bedId] = [];
        return;
      }

      const sorted = [...blocks].sort((a, b) =>
        new Date(a.check_in).getTime() - new Date(b.check_in).getTime()
      );

      const result: ReservationBlock[] = [];
      let current = sorted[0];

      for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        const currentEnd = new Date(current.check_out);
        const nextStart = new Date(next.check_in);

        if (nextStart <= currentEnd) {
          if (new Date(next.check_out) > currentEnd) {
            current = {
              ...current,
              check_out: next.check_out,
            };
          }
        } else {
          result.push(current);
          current = next;
        }
      }

      result.push(current);
      merged[bedId] = result;
    });

    return merged;
  }, [blocksByBed]);

  if (beds.length === 0) {
    return (
      <div className="rounded-xl border border-border flex items-center justify-center bg-surface shadow-sm" style={{ height: 320 }}>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">No beds configured</p>
          <p className="text-xs mt-1 text-muted-foreground">Add rooms and beds to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden flex flex-col relative transition-shadow duration-300 hover:shadow-md">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Availability Timeline</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-200 border border-slate-300" aria-hidden="true" />
          <span>Past dates locked</span>
        </div>
      </div>
      {/* Scrollable Container - Content and Header inside */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-240px)] tape-chart-container relative">
        <div style={{ width: LABEL_WIDTH + days.length * DAY_WIDTH, minWidth: "100%" }}>
          {/* Header Row - Sticky to top, scrolls with horizontal content */}
          <div className="flex sticky top-0 z-40 bg-surface border-b border-border shadow-sm">
            <div
              className="shrink-0 bg-muted border-r border-border flex items-center px-4 sticky left-0 z-50"
              style={{ width: LABEL_WIDTH, height: 48 }}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Property / Unit</span>
            </div>
            <div className="flex bg-muted/40 backdrop-blur-sm">
              {days.map((day) => {
                const isToday = format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "shrink-0 flex flex-col items-center justify-center border-r border-slate-100 transition-colors duration-200",
                      isToday ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
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
                "flex sticky left-0 z-30 bg-slate-100/80 backdrop-blur-md border-b border-slate-200 w-full transition-all duration-500 hover:bg-slate-100",
                animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
              )}
              style={{ transitionDelay: `${roomIndex * 35}ms` }}
            >
              <div className="px-4 py-2 flex items-center gap-2" style={{ width: LABEL_WIDTH }}>
                {type === "dorm" ? <Hotel className="w-3.5 h-3.5 text-slate-500" /> : <BedDouble className="w-3.5 h-3.5 text-slate-500" />}
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{roomName}</span>
                <span
                  className={cn(
                    "ml-auto text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider",
                    (ROOM_TYPE_STYLES[type]?.chip ?? ROOM_TYPE_STYLES.dorm.chip)
                  )}
                >
                  {ROOM_TYPE_STYLES[type]?.label ?? "Dorm"}
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
              const blocks = mergedBlocksByBed[bed.id] ?? [];
              return (
                <div
                  key={bed.id}
                  className={cn(
                    "flex group hover:bg-slate-50/50 transition-all duration-500 border-b border-slate-100",
                    animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  )}
                  style={{
                    height: ROW_HEIGHT,
                    transitionDelay: `${roomIndex * 35 + bedIndex * 24 + 60}ms`,
                  }}
                >
                  {/* Bed Label */}
                  <div
                    className="shrink-0 flex items-center px-4 border-r border-slate-200 bg-surface group-hover:bg-slate-50 sticky left-0 z-20 transition-colors"
                    style={{ width: LABEL_WIDTH }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-medium text-slate-900 truncate pr-2">{bed.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">#{bed.id.slice(0, 3)}</span>
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
                            "shrink-0 border-r border-slate-100/60 transition-colors duration-150",
                            hasReservation
                              ? ""
                              : isPastDate
                                ? "bg-slate-50/40 cursor-not-allowed"
                                : "cursor-pointer hover:bg-indigo-50/40"
                          )}
                          style={{ width: DAY_WIDTH }}
                          title={isPastDate ? "Past dates cannot be booked" : undefined}
                          onClick={() => !hasReservation && !isPastDate && onEmptyCell?.(bed.id, dateStr)}
                        />
                      );
                    })}

                    {/* Reservation Blocks */}
                    {blocks.map((block) => {
                      const start = parseISO(block.check_in);
                      const end = parseISO(block.check_out);
                      const offsetDays = differenceInDays(start, days[0]);
                      const durationDays = differenceInDays(end, start);
                      if (offsetDays + durationDays <= 0 || offsetDays >= days.length) return null;

                      const status = block.reservations?.status ?? "pending";
                      const colors = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
                      const Icon = colors.icon;
                      const guestFirst = block.reservations?.guests?.first_name ?? "Unknown";
                      const guestLast = block.reservations?.guests?.last_name ?? "";
                      const fullName = `${guestFirst} ${guestLast}`.trim();
                      const totalPrice = block.price_per_night * durationDays;

                      return (
                        <div
                          key={block.id}
                          className={cn(
                            "absolute top-1.5 bottom-1.5 rounded-md border shadow-sm flex flex-col px-2 py-1 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 z-10",
                            colors.bg,
                            colors.border
                          )}
                          style={{
                            left: offsetDays * DAY_WIDTH + 2,
                            width: Math.max(durationDays * DAY_WIDTH - 4, 30),
                          }}
                          title={`${fullName} · $${totalPrice.toFixed(2)} total · ${block.check_in} to ${block.check_out}`}
                          onClick={() => {
                            if (block.reservations?.id) onExistingBlock?.(block.reservations.id);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if ((event.key === "Enter" || event.key === " ") && block.reservations?.id) {
                              event.preventDefault();
                              onExistingBlock?.(block.reservations.id);
                            }
                          }}
                        >
                          <div className="flex items-center gap-1 overflow-hidden w-full">
                            <div className={cn("w-4 h-4 rounded-sm flex items-center justify-center shrink-0 bg-white/60", colors.text)}>
                              <Icon className="w-2.5 h-2.5" />
                            </div>
                            <span className={cn("truncate text-[10px] font-semibold tracking-tight", colors.text)}>{fullName}</span>
                          </div>
                          <span className={cn("truncate text-[8px] font-medium", colors.text)}>
                            ${totalPrice.toFixed(2)} total
                          </span>
                        </div>
                      );
                    })}
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
