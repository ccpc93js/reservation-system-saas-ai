import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);

// Routes not yet moved under [locale] (Phase 16 is incremental — see docs/phases/PHASE_16_PLAN.md).
// Single-segment names must match exactly (an org slug is always the *only* top-level segment too,
// so a prefix match would risk colliding with a real org named e.g. "settings").
const UNLOCALIZED_EXACT = [
  "/dashboard", "/calendar", "/reservations", "/channels",
  "/check-in-pending", "/guests", "/rooms", "/analytics",
];
const UNLOCALIZED_PREFIX = ["/demo", "/invite", "/onboarding", "/auth", "/settings"];

// Matches the original (pre-locale) publicRoutes list, minus routes now locale-managed
// (login, signup, reset-password, guest-portal).
const PUBLIC_PREFIXES = ["/register", "/scan", "/invite", "/auth", "/demo"];

// Public within the locale-managed branch — no auth required.
const LOCALE_PUBLIC_PREFIXES = ["/guest-portal", "/login", "/signup", "/reset-password"];

async function refreshSupabaseSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do NOT remove this
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Prefetch requests (router hover-prefetch) only warm the RSC cache — no need to
  // hit Supabase Auth (a network round-trip) for each one. The real navigation that
  // follows still runs the full session refresh + auth gate below.
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";

  // API routes handle auth/authorization themselves, must return JSON, and are never locale-prefixed.
  if (pathname.startsWith("/api/")) {
    const apiResponse = NextResponse.next({ request });
    await refreshSupabaseSession(request, apiResponse);
    return apiResponse;
  }

  const isUnlocalized =
    pathname === "/" ||
    UNLOCALIZED_EXACT.includes(pathname) ||
    UNLOCALIZED_PREFIX.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isUnlocalized) {
    const response = NextResponse.next({ request });
    if (isPrefetch) return response;
    const user = await refreshSupabaseSession(request, response);

    const isPublic =
      pathname === "/" ||
      PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

    if (!user && !isPublic) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  // Locale-managed routes: [locale]/[slug]/* (org dashboard), [locale]/guest-portal/*,
  // and [locale]/{login,signup,reset-password}
  const intlResponse = handleI18nRouting(request);
  if (isPrefetch) return intlResponse;
  const user = await refreshSupabaseSession(request, intlResponse);

  const segments = pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];
  const hasLocalePrefix = (routing.locales as readonly string[]).includes(maybeLocale);
  const pathWithoutLocale = hasLocalePrefix ? "/" + segments.slice(1).join("/") : pathname;

  const isPublic = LOCALE_PUBLIC_PREFIXES.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + "/")
  );

  // "/login" itself isn't locale-prefixed here — the redirect target gets picked up by the
  // locale-managed branch on the next request and gains its /{locale} prefix there.
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from login; root page.tsx sends them to their org dashboard.
  if (user && pathWithoutLocale === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
