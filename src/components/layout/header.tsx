"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { User } from "@supabase/supabase-js";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus, Menu, Search as SearchIcon, Settings, LogOut, X, Globe, Check } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import NotificationBell from "./notification-bell";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  hi: "हिन्दी",
  es: "Español",
  fr: "Français",
  ar: "العربية",
  bn: "বাংলা",
  pt: "Português",
  ru: "Русский",
  ja: "日本語",
  sr: "Srpski",
};

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
  const t = useTranslations("header");
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const initials = user.email?.slice(0, 2).toUpperCase() ?? "??";

  const switchLocale = (next: Locale) => {
    router.replace(pathname, { locale: next });
    // root layout.tsx sits above the [locale] segment, so it isn't re-run by
    // the client-side transition above — refresh() forces it to, keeping
    // <html lang> in sync too.
    router.refresh();
  };

  const [query, setQuery] = useState("");
  const [guestResults, setGuestResults] = useState<GuestResult[]>([]);
  const [reservationResults, setReservationResults] = useState<ReservationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Strip leading /{slug} prefix to get the route segment
  const routeSegment = pathname.replace(new RegExp(`^/${org.slug}`), "") || "/dashboard";

  const pageTitles: Record<string, string> = {
    "/dashboard": t("pageTitles.dashboard"),
    "/calendar": t("pageTitles.calendar"),
    "/reservations": t("pageTitles.reservations"),
    "/check-in-pending": t("pageTitles.checkInPending"),
    "/checkin-history": t("pageTitles.checkinHistory"),
    "/analytics": t("pageTitles.analytics"),
    "/guests": t("pageTitles.guests"),
    "/rooms": t("pageTitles.rooms"),
    "/channels": t("pageTitles.channels"),
    "/housekeeping": t("pageTitles.housekeeping"),
    "/help": t("pageTitles.help"),
    "/settings/property": t("pageTitles.settingsProperty"),
    "/settings/team": t("pageTitles.settingsTeam"),
    "/settings/billing": t("pageTitles.settingsBilling"),
  };
  const title = pageTitles[routeSegment]
    ?? (routeSegment.startsWith("/settings") ? t("pageTitles.settings") : t("pageTitles.dashboard"));

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
    <header className="h-16 bg-surface border-b border-border px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-muted rounded-lg transition-colors shrink-0"
          title={t("toggleMenu")}
        >
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>
        <h2 className="font-serif text-xl font-semibold text-foreground truncate">{title}</h2>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
        {/* Search */}
        <div className="relative hidden sm:block" ref={searchRef}>
          <form onSubmit={handleSearchSubmit}>
            <SearchIcon className="w-5 h-5 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => hasResults && setShowDropdown(true)}
              placeholder={t("searchPlaceholder")}
              className="pl-10 pr-9 py-2.5 bg-background border border-border rounded-lg text-sm w-64 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                title={t("clearSearch")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {showDropdown && (
            <div className="absolute z-50 mt-1 w-80 rounded-lg border border-border bg-surface shadow-lg overflow-hidden right-0">
              {searching && (
                <p className="px-4 py-3 text-xs text-muted-foreground">{t("searching")}</p>
              )}
              {!searching && !hasResults && (
                <p className="px-4 py-3 text-xs text-muted-foreground">{t("noResults")}</p>
              )}
              {!searching && guestResults.length > 0 && (
                <div className="py-1">
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("guestsLabel")}</p>
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
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("reservationsLabel")}</p>
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

        {/* Language switcher */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              title={t("language")}
            >
              <Globe className="w-5 h-5" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-52 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg py-1"
            >
              {locales.map((l) => (
                <DropdownMenu.Item
                  key={l}
                  onSelect={() => switchLocale(l)}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
                >
                  {LOCALE_NAMES[l]}
                  {l === locale && <Check className="w-4 h-4 text-primary shrink-0" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Notifications */}
        <NotificationBell userId={user.id} orgSlug={org.slug} />

        {/* New Booking Button */}
        <button
          onClick={() => router.push(`/${org.slug}/calendar`)}
          title={t("newBookingTooltip")}
          className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t("newBooking")}</span>
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
                {t("settingsMenuItem")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
              >
                <LogOut className="w-4 h-4 text-muted-foreground" />
                {t("signOut")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
