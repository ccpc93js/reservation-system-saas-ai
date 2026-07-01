import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { rtlLocales } from "@/i18n/routing";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HostMagSmart",
    template: "%s | HostMagSmart",
  },
  description: "Smart reservation management for independent hostels",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Best-effort on client-side locale-only transitions (this layout sits above
  // the [locale] segment, so Next.js won't re-run it then) — router.refresh()
  // in the language switcher forces a fresh fetch so this stays correct.
  const locale = await getLocale();
  const dir = (rtlLocales as string[]).includes(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(var(--surface))",
              color: "hsl(var(--text))",
              border: "1px solid hsl(var(--border))",
            },
          }}
        />
      </body>
    </html>
  );
}
