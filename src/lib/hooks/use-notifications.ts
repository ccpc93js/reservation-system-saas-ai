"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/types/database";

export interface AppNotification {
  id: string;
  type: string;
  link: string | null;
  data: Json;
  read_at: string | null;
  created_at: string;
}

export function useNotifications(userId: string) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchLatest = useCallback(async () => {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setItems(data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchLatest();

    const supabase = createBrowserClient();
    const channel = supabase
      .channel("notifications-self")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setItems((prev) => [payload.new as AppNotification, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchLatest]);

  const unreadCount = items.filter((i) => !i.read_at).length;

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i)));
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: now })));
    await fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {});
  }, []);

  return { items, loaded, unreadCount, markRead, markAllRead, refetch: fetchLatest };
}
