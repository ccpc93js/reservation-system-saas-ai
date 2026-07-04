"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import type { HousekeepingStatus } from "@/lib/types/housekeeping";

export interface HousekeepingBed {
  id: string;
  name: string;
  position: number | null;
  housekeeping_status: HousekeepingStatus;
  housekeeping_updated_at: string;
  rooms: {
    id: string;
    name: string;
    room_types: { name: string; type: string } | null;
  } | null;
}

export function useHousekeeping(orgId: string) {
  const [beds, setBeds] = useState<HousekeepingBed[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchBeds = useCallback(async () => {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("beds")
      .select("id, name, position, housekeeping_status, housekeeping_updated_at, rooms(id, name, room_types(name, type))")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("position");
    // housekeeping_status is a DB-CHECK-constrained `text` column, not a
    // Postgres enum, so the generated type only says `string` here — the
    // narrowing to HousekeepingStatus is a genuine boundary cast, backed by
    // the CHECK constraint at the DB layer.
    setBeds((data as unknown as HousekeepingBed[]) ?? []);
    setLoaded(true);
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Wait for the initial fetch to land before subscribing, so a realtime
    // event arriving mid-fetch can't be dropped against still-empty state
    // and then overwritten by the fetch's now-stale snapshot.
    fetchBeds().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel("housekeeping-org")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "beds", filter: `organization_id=eq.${orgId}` },
          (payload) => {
            setBeds((prev) =>
              prev.map((b) => (b.id === payload.new.id ? { ...b, ...(payload.new as Partial<HousekeepingBed>) } : b))
            );
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orgId, fetchBeds]);

  const updateStatus = useCallback(async (bedId: string, status: HousekeepingStatus) => {
    let previousStatus: HousekeepingStatus | undefined;
    setBeds((prev) =>
      prev.map((b) => {
        if (b.id !== bedId) return b;
        previousStatus = b.housekeeping_status;
        return { ...b, housekeeping_status: status, housekeeping_updated_at: new Date().toISOString() };
      })
    );

    try {
      const res = await fetch(`/api/beds/${bedId}/housekeeping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    } catch {
      setBeds((prev) =>
        prev.map((b) => (b.id === bedId && previousStatus ? { ...b, housekeeping_status: previousStatus! } : b))
      );
      toast.error("Failed to update bed status");
    }
  }, []);

  return { beds, loaded, updateStatus, refetch: fetchBeds };
}
