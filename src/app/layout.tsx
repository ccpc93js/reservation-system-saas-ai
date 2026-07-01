import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = (rtlLocales as string[]).includes(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
