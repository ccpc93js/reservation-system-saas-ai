"use client";

import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  BedDouble,
  Settings,
  LogOut,
  BookOpen,
  X,
  ChevronLeft,
  BarChart3,
  ClipboardList,
  Wifi,
  UsersRound,
  CreditCard,
  History,
  Sparkles,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

const mainNavRoutes = [
  { path: "dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { path: "calendar", labelKey: "calendar", icon: CalendarDays },
  { path: "reservations", labelKey: "reservations", icon: BookOpen },
  { path: "check-in-pending", labelKey: "checkInPending", icon: ClipboardList },
  { path: "checkin-history", labelKey: "checkinHistory", icon: History },
  { path: "analytics", labelKey: "analytics", icon: BarChart3 },
  { path: "channels", labelKey: "channels", icon: Wifi },
  { path: "guests", labelKey: "guests", icon: Users },
  { path: "rooms", labelKey: "rooms", icon: BedDouble },
  { path: "housekeeping", labelKey: "housekeeping", icon: Sparkles },
] as const;

const settingsNavRoutes = [
  { path: "settings/property", labelKey: "settingsProperty", icon: Settings },
  { path: "settings/team", labelKey: "settingsTeam", icon: UsersRound },
  { path: "settings/billing", labelKey: "settingsBilling", icon: CreditCard },
] as const;

interface SidebarProps {
  org: { id: string; name: string; slug: string; logo_url?: string | null; plan?: string };
  userRole: string;
  user?: { email?: string };
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ org, user, userRole, isOpen = true, onClose }: SidebarProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserClient();

  const roleLabel: Record<string, string> = {
    owner: t("role.owner"),
    manager: t("role.manager"),
    admin: t("role.admin"),
    staff: t("role.staff"),
  };

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-72 bg-surface border-r border-border flex flex-col shrink-0",
        "fixed inset-y-0 left-0 z-40",
        "transition-transform duration-300 ease-in-out",
        !isOpen && "-translate-x-full"
      )}>
        {/* Logo / org name */}
        <div className="px-6 py-6 border-b border-border/70 lg:pt-6 flex items-center justify-between">
        <Link href={`/${org.slug}/dashboard`} className="flex items-center gap-3 mb-1 group" title={org.name}>
          <div className="h-10 w-10 rounded-md bg-surface border border-border flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={org.logo_url || "/botanical/logo.png"}
              alt={org.name}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-foreground tracking-tight capitalize">
                {org.name}
              </p>
              {org.plan && org.plan !== "free" && (
                <span className="text-[9px] font-bold px-1 py-0.5 rounded text-white uppercase"
                  style={{ background: org.plan === "scale" ? "#0f766e" : "#5f7048" }}>
                  {org.plan}
                </span>
              )}
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {t("liveView")}
            </p>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          title={t("collapseSidebar")}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {/* Main Nav */}
        <div className="px-3 py-4">
          {mainNavRoutes.map((item) => {
            const href = `/${org.slug}/${item.path}`;
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={item.path}
                href={href}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all mb-1",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{t(`nav.${item.labelKey}`)}</span>
              </Link>
            );
          })}
        </div>

        {/* Settings Section */}
        <div className="border-t border-border/70 px-3 py-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-4 mb-3">
            {t("settingsSection")}
          </p>
          {settingsNavRoutes.map((item) => {
            const href = `/${org.slug}/${item.path}`;
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={item.path}
                href={href}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all mb-1",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{t(`nav.${item.labelKey}`)}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom user section */}
      <div className="p-4 border-t border-border/70 bg-muted/30 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center font-bold text-sm text-primary">
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {user?.email?.split("@")[0] || t("defaultUserName")}
            </p>
            <p className="text-xs text-muted-foreground truncate capitalize">{roleLabel[userRole] ?? userRole}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t("logout")}
        </button>
      </div>
      </aside>
    </>
  );
}
