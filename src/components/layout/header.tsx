"use client";

import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Plus, Bell, Menu } from "lucide-react";

interface HeaderProps {
  org: { id: string; name: string; slug: string };
  user: User;
  onMenuClick?: () => void;
}

export default function Header({ org, user, onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const initials = user.email?.slice(0, 2).toUpperCase() ?? "??";

  const pageTitle = {
    "/dashboard": "Dashboard",
    "/calendar": "Tape Calendar",
    "/reservations": "Reservations",
    "/analytics": "Analytics",
    "/guests": "Guest Directory",
    "/rooms": "Room Inventory",
  }[pathname] || "Dashboard";

  return (
    <header className="h-16 bg-surface border-b border-border px-6 lg:px-8 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="Toggle menu"
        >
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden sm:block">
          <svg
            className="w-5 h-5 text-muted-foreground absolute left-3 top-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search guests, reservations..."
            className="pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm w-64 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
          />
        </div>

        {/* Notifications */}
        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* New Booking Button */}
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" />
          New Booking
        </button>

        {/* User avatar */}
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
          {initials}
        </div>
      </div>
    </header>
  );
}
