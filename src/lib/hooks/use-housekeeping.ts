"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export interface HousekeepingBed {
  id: string;
  name: string;
  position: number | null;
  housekeeping_status: string;
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
    setBeds(data ?? []);
    setLoaded(true);
  }, [orgId]);

  useEffect(() => {
    fetchBeds();

    const supabase = createBrowserClient();
    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, fetchBeds]);

  const updateStatus = useCallback(async (bedId: string, status: string) => {
    setBeds((prev) =>
      prev.map((b) => (b.id === bedId ? { ...b, housekeeping_status: status, housekeeping_updated_at: new Date().toISOString() } : b))
    );
    await fetch(`/api/beds/${bedId}/housekeeping`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }, []);

  return { beds, loaded, updateStatus, refetch: fetchBeds };
}
