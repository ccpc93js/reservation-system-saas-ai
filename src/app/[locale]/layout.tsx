import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

// Nested inside the [locale] segment on purpose: Next.js only re-runs layouts
// that sit within the segment that actually changed on client-side navigation.
// Keeping the provider here (rather than in the root layout) means switching
// locales via router.replace(pathname, { locale }) gives client components
// fresh messages instead of the stale ones from the first page load.
export default async function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
