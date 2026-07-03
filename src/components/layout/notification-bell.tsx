"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTranslations } from "next-intl";
import { Bell, CheckCircle2, CalendarPlus, XCircle, Users, AlertTriangle } from "lucide-react";
import { useNotifications, type AppNotification } from "@/lib/hooks/use-notifications";
import { useRouter } from "@/i18n/navigation";

const TYPE_ICON: Record<string, typeof Bell> = {
  checkin_submitted: CheckCircle2,
  reservation_created: CalendarPlus,
  reservation_cancelled: XCircle,
  duplicate_guest: Users,
  channel_sync_failed: AlertTriangle,
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function NotificationBell({ userId, orgSlug }: { userId: string; orgSlug: string }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { items, unreadCount, markRead, markAllRead } = useNotifications(userId);

  const handleSelect = (n: AppNotification) => {
    markRead(n.id);
    if (n.link) router.push(`/${orgSlug}${n.link}`);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors relative"
          title={t("title")}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-96 max-h-[28rem] overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-surface">
            <p className="text-sm font-semibold text-foreground">{t("title")}</p>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              {t("markAllRead")}
            </button>
          </div>
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
          )}
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            return (
              <DropdownMenu.Item
                key={n.id}
                onSelect={() => handleSelect(n)}
                className={`flex items-start gap-3 px-4 py-3 text-sm cursor-pointer outline-none hover:bg-muted transition-colors border-b border-border last:border-0 ${
                  !n.read_at ? "bg-primary/5" : ""
                }`}
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate">
                    {t(`types.${n.type}`, n.data as unknown as Record<string, string>)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(n.created_at)}</p>
                </div>
                {!n.read_at && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
