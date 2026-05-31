"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  BedDouble,
  Settings,
  LogOut,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard Overview", icon: LayoutDashboard },
  { href: "/calendar", label: "Tape Calendar", icon: CalendarDays },
  { href: "/guests", label: "Guest Directory", icon: Users },
  { href: "/rooms", label: "Room Inventory", icon: BedDouble },
];

const settingsNavItems = [
  { href: "/settings/property", label: "Property Settings", icon: Settings },
];

interface SidebarProps {
  org: { id: string; name: string; slug: string };
  userRole: string;
  user?: { email?: string };
}

export default function Sidebar({ org, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <aside className="w-72 bg-surface border-r border-border flex flex-col shrink-0">
      {/* Logo / org name */}
      <div className="px-6 py-6 border-b border-border/70">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            {org.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground tracking-tight">
              {org.name}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Live View
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {/* Main Nav */}
        <div className="px-3 py-4">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all mb-1",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Settings Section */}
        <div className="border-t border-border/70 px-3 py-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-4 mb-3">
            Settings
          </p>
          {settingsNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all mb-1",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
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
              {user?.email?.split("@")[0] || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">Property Manager</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
