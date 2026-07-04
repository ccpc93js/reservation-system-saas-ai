"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { X, CalendarDays, Plus, BarChart3, Wifi, Users, ArrowRight } from "lucide-react";

const STORAGE_KEY = "demo_welcome_dismissed";

const SUGGESTION_KEYS = ["tapeCalendar", "createBooking", "analytics", "channelManager", "guestDirectory"] as const;
const suggestions = [
  { key: "tapeCalendar", icon: CalendarDays, href: "calendar", color: "#5f7048" },
  { key: "createBooking", icon: Plus, href: null, color: "#8b5cf6" },
  { key: "analytics", icon: BarChart3, href: "analytics", color: "#7f8a58" },
  { key: "channelManager", icon: Wifi, href: "channels", color: "#5f7048" },
  { key: "guestDirectory", icon: Users, href: "guests", color: "#4c6b4a" },
] satisfies { key: typeof SUGGESTION_KEYS[number]; icon: typeof CalendarDays; href: string | null; color: string }[];

interface Props {
  slug: string;
}

export default function DemoWelcomeModal({ slug }: Props) {
  const t = useTranslations("demoWelcome");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setOpen(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: "calc(100vh - 32px)", boxShadow: "0 32px 80px rgba(95,112,72,0.2), 0 8px 32px rgba(0,0,0,0.1)" }}>

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 shrink-0"
          style={{ background: "linear-gradient(135deg, #5f7048 0%, #7f8a58 100%)", borderRadius: "1rem 1rem 0 0" }}>
          <button onClick={dismiss}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-surface/20 hover:bg-surface/30 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="inline-flex items-center gap-1.5 bg-surface/20 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full mb-2">
            {t("demoModeBadge")}
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{t("welcomeTitle")}</h2>
          <p className="text-purple-100 text-sm">
            {t("welcomeSubtitle")}
          </p>
        </div>

        {/* Suggestions — scrollable */}
        <div className="px-5 py-4 space-y-1.5 overflow-y-auto flex-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t("suggestedThings")}</p>
          {suggestions.map((s) => (
            <div key={s.key}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border hover:border-purple-200 hover:bg-purple-50/50 transition-all group cursor-pointer"
              onClick={() => {
                if (s.href) window.location.href = `/${locale}/${slug}/${s.href}`;
                dismiss();
              }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: s.color + "15" }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{t(`suggestions.${s.key}.title`)}</p>
                <p className="text-xs text-muted-foreground truncate">{t(`suggestions.${s.key}.desc`)}</p>
              </div>
              {s.href && (
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-border shrink-0">
          <button onClick={dismiss}
            className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
            style={{ background: "linear-gradient(135deg, #5f7048, #7f8a58)", boxShadow: "0 4px 16px rgba(95,112,72,0.3)" }}>
            {t("startExploring")}
          </button>
          <p className="text-center text-xs text-muted-foreground mt-2.5">
            {t("wantThisForYourHostel")}{" "}
            <a href="/signup" className="text-purple-600 font-medium hover:underline">
              {t("createFreeAccount")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
