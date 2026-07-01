import { defineRouting } from "next-intl/routing";

export const locales = ["en", "zh", "hi", "es", "fr", "ar", "bn", "pt", "ru", "ja", "sr"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const rtlLocales: Locale[] = ["ar"];

export const routing = defineRouting({
  locales,
  defaultLocale,
});
