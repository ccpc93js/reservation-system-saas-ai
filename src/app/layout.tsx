import type { Metadata } from "next";
import { Cormorant_Garamond, Hanken_Grotesk } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { rtlLocales } from "@/i18n/routing";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hostmagsmart.com";
const siteName = "HostMagSmart";
const siteDescription =
  "HostMagSmart is smart property-management software for independent hostels — reservations, tape calendar, channel manager, guest self check-in, housekeeping and analytics in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "HostMagSmart — Hostel Management Software (PMS)",
    template: "%s | HostMagSmart",
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    "HostMagSmart",
    "hostel management software",
    "hostel PMS",
    "property management system",
    "hostel reservation system",
    "channel manager",
    "hostel booking software",
    "guest check-in",
    "hostel front desk software",
    "tape calendar",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  alternates: { canonical: "/" },
  category: "business software",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: "HostMagSmart — Hostel Management Software (PMS)",
    description: siteDescription,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "HostMagSmart — Hostel Management Software (PMS)",
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
    <html lang={locale} dir={dir} className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
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
