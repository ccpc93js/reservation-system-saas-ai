"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus, Bell, Menu, Search as SearchIcon, Settings, LogOut, X } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

interface HeaderProps {
  org: { id: string; name: string; slug: string };
  user: User;
  onMenuClick?: () => void;
}

interface GuestResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface ReservationResult {
  id: string;
  reservation_number: string;
  check_in: string;
  status: string;
}

export default function Header({ org, user, onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = user.email?.slice(0, 2).toUpperCase() ?? "??";

  const [query, setQuery] = useState("");
  const [guestResults, setGuestResults] = useState<GuestResult[]>([]);
  const [reservationResults, setReservationResults] = useState<ReservationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Strip leading /{slug} prefix to get the route segment
  const routeSegment = pathname.replace(new RegExp(`^/${org.slug}`), "") || "/dashboard";

  const pageTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/calendar": "Tape Calendar",
    "/reservations": "Reservations",
    "/check-in-pending": "Pending Check-Ins",
    "/analytics": "Analytics",
    "/guests": "Guest Directory",
    "/rooms": "Room Inventory",
    "/channels": "Channel Manager",
    "/settings/property": "Property Settings",
    "/settings/team": "Team",
    "/settings/billing": "Billing & Plan",
  };
  const title = pageTitles[routeSegment]
    ?? (routeSegment.startsWith("/settings") ? "Settings" : "Dashboard");

  // Debounced live search across guests + reservations
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGuestResults([]);
      setReservationResults([]);
      setShowDropdown(false);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const supabase = createBrowserClient();
        const [guestsRes, reservationsRes] = await Promise.all([
          supabase
            .from("guests")
            .select("id, first_name, last_name, email")
            .eq("organization_id", org.id)
            .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,document_number.ilike.%${q}%`)
            .limit(5),
          supabase
            .from("reservations")
            .select("id, reservation_number, check_in, status")
            .eq("organization_id", org.id)
            .ilike("reservation_number", `%${q}%`)
            .limit(5),
        ]);
        setGuestResults((guestsRes.data as GuestResult[]) ?? []);
        setReservationResults((reservationsRes.data as ReservationResult[]) ?? []);
        setShowDropdown(true);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, org.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goToReservations = (q: string) => {
    setShowDropdown(false);
    router.push(`/${org.slug}/reservations?q=${encodeURIComponent(q)}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length > 0) goToReservations(query.trim());
  };

  const clearSearch = () => {
    setQuery("");
    setGuestResults([]);
    setReservationResults([]);
    setShowDropdown(false);
  };

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const hasResults = guestResults.length > 0 || reservationResults.length > 0;

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
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden sm:block" ref={searchRef}>
          <form onSubmit={handleSearchSubmit}>
            <SearchIcon className="w-5 h-5 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => hasResults && setShowDropdown(true)}
              placeholder="Search guests, reservations..."
              className="pl-10 pr-9 py-2.5 bg-background border border-border rounded-lg text-sm w-64 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {showDropdown && (
            <div className="absolute z-50 mt-1 w-80 rounded-lg border border-border bg-surface shadow-lg overflow-hidden right-0">
              {searching && (
                <p className="px-4 py-3 text-xs text-muted-foreground">Searching…</p>
              )}
              {!searching && !hasResults && (
                <p className="px-4 py-3 text-xs text-muted-foreground">No results</p>
              )}
              {!searching && guestResults.length > 0 && (
                <div className="py-1">
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Guests</p>
                  {guestResults.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => goToReservations(`${g.first_name} ${g.last_name}`)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="font-medium text-foreground">{g.first_name} {g.last_name}</span>
                      {g.email && <span className="text-muted-foreground ml-2 text-xs">{g.email}</span>}
                    </button>
                  ))}
                </div>
              )}
              {!searching && reservationResults.length > 0 && (
                <div className="py-1 border-t border-border">
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reservations</p>
                  {reservationResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => goToReservations(r.reservation_number)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="font-medium text-foreground">{r.reservation_number}</span>
                      <span className="text-muted-foreground ml-2 text-xs capitalize">{r.status.replace("_", " ")} · {r.check_in}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* New Booking Button */}
        <button
          onClick={() => router.push(`/${org.slug}/calendar`)}
          title="Go to Tape Calendar to create a new booking"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Booking
        </button>

        {/* User account menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary hover:bg-primary/25 transition-colors">
              {initials}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-64 rounded-lg border border-border bg-surface shadow-lg py-1"
            >
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground truncate capitalize mt-0.5">{org.name}</p>
              </div>
              <DropdownMenu.Item
                onSelect={() => router.push(`/${org.slug}/settings/property`)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
                Settings
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
              >
                <LogOut className="w-4 h-4 text-muted-foreground" />
                Sign Out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
