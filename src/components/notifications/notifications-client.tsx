"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/lib/hooks/use-notifications";
import {
  Bell, CheckCircle2, CalendarPlus, XCircle, Users, AlertTriangle, Wifi, Search, Check,
} from "lucide-react";

const TYPE_ICON: Record<string, typeof Bell> = {
  checkin_submitted: CheckCircle2,
  reservation_created: CalendarPlus,
  reservation_cancelled: XCircle,
  duplicate_guest: Users,
  channel_sync_failed: AlertTriangle,
  channel_synced: Wifi,
};
const TYPES = Object.keys(TYPE_ICON);
const PAGE = 30;

function fullTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
function relative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationsClient({ userId, orgSlug }: { userId: string; orgSlug: string }) {
  const t = useTranslations("notifications");
  const router = useRouter();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [search, setSearch] = useState("");
  const offsetRef = useRef(0);

  // Build a filtered, paginated query. `reset` restarts from the top.
  const fetchPage = useCallback(async (reset: boolean) => {
    setLoading(true);
    const supabase = createBrowserClient();
    const from = reset ? 0 : offsetRef.current;
    let q = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (typeFilter !== "all") q = q.eq("type", typeFilter);
    if (statusFilter === "unread") q = q.is("read_at", null);
    if (statusFilter === "read") q = q.not("read_at", "is", null);
    const { data } = await q;
    const batch = (data ?? []) as AppNotification[];
    setItems((prev) => (reset ? batch : [...prev, ...batch]));
    offsetRef.current = from + batch.length;
    setHasMore(batch.length === PAGE);
    setLoading(false);
  }, [typeFilter, statusFilter]);

  // Refetch when a server-side filter changes.
  useEffect(() => { fetchPage(true); }, [fetchPage]);

  // Realtime: prepend new notifications (respecting the current type filter).
  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification;
          if (typeFilter !== "all" && n.type !== typeFilter) return;
          if (statusFilter === "read") return; // new ones are unread
          setItems((prev) => [n, ...prev]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, typeFilter, statusFilter]);

  const text = (n: AppNotification) => t(`types.${n.type}`, (n.data ?? {}) as Record<string, string>);

  // Search filters the loaded set by rendered text (client-side).
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) => text(n).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search]);

  const unreadCount = items.filter((i) => !i.read_at).length;

  const markRead = async (n: AppNotification) => {
    if (n.read_at) return;
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)));
    await fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => {});
  };
  const markAllRead = async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: now })));
    await fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {});
  };
  const open = (n: AppNotification) => {
    markRead(n);
    if (n.link) router.push(`/${orgSlug}${n.link}`);
  };

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-3xl font-semibold" style={{ color: "hsl(var(--text))" }}>{t("pageTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("pageSubtitle")}</p>
        </div>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
        >
          <Check className="w-4 h-4" /> {t("markAllRead")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm"
        >
          <option value="all">{t("allTypes")}</option>
          {TYPES.map((ty) => <option key={ty} value={ty}>{t(`typeLabels.${ty}`)}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm"
        >
          <option value="all">{t("statusAll")}</option>
          <option value="unread">{t("statusUnread")}</option>
          <option value="read">{t("statusRead")}</option>
        </select>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
        {visible.length === 0 && !loading && (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {search ? t("noResults") : t("empty")}
          </p>
        )}
        {visible.map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Bell;
          return (
            <div
              key={n.id}
              onClick={() => open(n)}
              className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/50 transition-colors ${!n.read_at ? "bg-primary/5" : ""}`}
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{text(n)}</p>
                <p className="text-xs text-muted-foreground mt-0.5" title={fullTime(n.created_at)}>
                  {relative(n.created_at)} · {fullTime(n.created_at)}
                </p>
              </div>
              {!n.read_at ? (
                <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" title={t("unread")} />
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="text-[10px] text-muted-foreground shrink-0 mt-0.5"
                >
                  {t("read")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more — only when not searching (search filters the loaded set). */}
      {hasMore && !search && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchPage(false)}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          >
            {loading ? t("loading") : t("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
