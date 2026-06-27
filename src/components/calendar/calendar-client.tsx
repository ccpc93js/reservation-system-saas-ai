"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import TapeChart from "@/components/calendar/tape-chart";
import NewReservationDrawer from "@/components/calendar/new-reservation-drawer";
import EditReservationDrawer from "@/components/calendar/edit-reservation-drawer";

interface CalendarClientProps {
  beds: any[];
  reservations: any[];
  orgId: string;
}

export default function CalendarClient({
  beds,
  reservations,
  orgId,
}: CalendarClientProps) {
  const router = useRouter();
  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch("/api/channels/sync-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const total = data.results.reduce(
        (acc: any, r: any) => ({ created: acc.created + (r.created || 0), updated: acc.updated + (r.updated || 0), cancelled: acc.cancelled + (r.cancelled || 0) }),
        { created: 0, updated: 0, cancelled: 0 }
      );
      toast.success(`Sync complete: ${total.created} new, ${total.updated} updated, ${total.cancelled} cancelled`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncingAll(false);
    }
  };

  // Drawer state
  const [newResOpen, setNewResOpen] = useState(false);
  const [newResData, setNewResData] = useState<{
    bedId: string;
    checkIn: string;
  } | null>(null);
  const [editResOpen, setEditResOpen] = useState(false);
  const [editResId, setEditResId] = useState<string | null>(null);

  const handleEmptyCell = (bedId: string, date: string) => {
    setNewResData({ bedId, checkIn: date });
    setNewResOpen(true);
  };

  const handleExistingBlock = (resId: string) => {
    setEditResId(resId);
    setEditResOpen(true);
  };

  const handleRefetch = () => {
    // Force reload the page to clear all caches
    window.location.reload();
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 font-sans space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary" />
            Tape Calendar
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            60-Day Horizon · Click an empty cell to create, or a block to edit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            title="Sync all OTA channels"
          >
            <RefreshCw className={`w-4 h-4 ${syncingAll ? "animate-spin" : ""}`} />
            {syncingAll ? "Syncing..." : "Sync Channels"}
          </button>
          <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground bg-surface px-3 py-1.5 rounded-lg border border-border shadow-sm">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" /> Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" /> Pending
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-400" /> In House
            </span>
          </div>
        </div>
      </div>

      <TapeChart
        beds={beds}
        reservations={reservations}
        orgId={orgId}
        onEmptyCell={handleEmptyCell}
        onExistingBlock={handleExistingBlock}
      />

      <NewReservationDrawer
        open={newResOpen}
        onOpenChange={setNewResOpen}
        bedId={newResData?.bedId}
        checkInDate={newResData?.checkIn}
        orgId={orgId}
        onReservationCreated={handleRefetch}
      />

      <EditReservationDrawer
        open={editResOpen}
        onOpenChange={setEditResOpen}
        reservationId={editResId || undefined}
        onReservationUpdated={handleRefetch}
      />
    </div>
  );
}
