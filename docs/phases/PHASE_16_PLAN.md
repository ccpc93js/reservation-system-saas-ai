# Phase 16 Plan — Multi-Language Support (i18n)

## Understanding Summary
- Full internationalization of the entire app: staff dashboard (calendar, reservations, guests, settings, analytics — 60+ components) and guest-facing pages (self check-in, guest portal).
- Why: serve an international user base — both hostel staff and the guests who self-check-in — in their own language.
- Languages (top 10 by total speakers): English, Mandarin, Hindi, Spanish, French, Arabic, Bengali, Portuguese, Russian, Japanese.
- Routing: URL-prefixed locale, `/{locale}/{org-slug}/...`.
- Translation content: AI-machine-translated now (not professionally reviewed); refine later.
- Non-goal: no translation QA/review pipeline in this pass, no per-user manual translation-editing UI, public landing page (Phase 12) not in scope unless requested separately.

## Assumptions
- Library: `next-intl` (Server Component support, built-in routing, ICU plurals/dates, RTL-friendly).
- Arabic requires a dedicated RTL layout pass (`dir="rtl"`, flex-direction, icon mirroring) — separate effort from string extraction.
- Persistence: locale lives in the URL; cookie remembers it for the next visit.
- Staff and guests can pick independent languages (a guest checking in in Spanish doesn't change what language staff see).
- Fallback locale: English, for any missing translation key.

## Resolved Risk (confirmed at Phase 16 start, 2026-07-01)
- `src/app/(dashboard)/*` is a legacy route group whose `layout.tsx` unconditionally redirects to `/{slug}/...` before any child `page.tsx` renders (comment: "Legacy route group — redirect all old /(dashboard)/* routes to /{slug}/*"). Its page.tsx files are dead code by design, not a real duplicate. **Decision: leave `(dashboard)/*` outside `[locale]` entirely** — it doesn't need translation since it never renders content, only needs its redirect target updated to go through the locale-aware default (next-intl's middleware will add the default locale prefix on the redirect target automatically).
- Translations are AI-generated, unreviewed. Known and accepted risk — flagged here for future reference, not hidden.

## Decision Log
| Decision | Alternatives considered | Why |
|---|---|---|
| Scope: whole app | Guest-facing only | User chose broader scope |
| Languages: top 10 by total speakers | Hotel-relevant subset (en/es/pt/de/fr/it/zh) | User chose broader set |
| Routing: URL-prefixed locale | Cookie-only, no URL change | Shareable/bookmarkable, SEO-friendly |
| Translation source: AI-generated now | Stub 8 languages, hand-translate 2 | Ship faster, accepted quality tradeoff |
| Library: `next-intl` | `react-i18next`, hand-rolled dictionary | Server Component support; built-in RTL/plural/ICU handling avoids reimplementing locale-formatting rules |
| Timing: separate Phase 16 | Fold into Phase 15 navbar work | Too large (~100+ files, routing restructure) to bundle safely |
| Design review depth | Multi-agent cloud review | User opted to skip, proceed with single-session design |

## Execution Plan

### Stage 1 — Scaffolding (do first, own session)
- Install `next-intl`.
- Compose `next-intl` middleware in front of existing `src/middleware.ts` tenant/auth logic.
- Move every route under `src/app/[slug]/` to `src/app/[locale]/[slug]/` (directory move, no logic changes).
- Move `src/app/guest-portal/` to `src/app/[locale]/guest-portal/`.
- Move root `src/app/layout.tsx` to `src/app/[locale]/layout.tsx`, wrap in `NextIntlClientProvider`, set `dir="rtl"` conditionally for `locale === "ar"`.
- Resolve the `(dashboard)` vs `[slug]` duplicate-route ambiguity before this step.
- Create `messages/en.json` (empty/skeleton) plus empty skeletons for the other 9 locales.
- Ship with English-only content under `/en/...`; verify the app still runs end-to-end before extracting any strings.

### Stage 2 — Component string extraction, in order
1. Shared layout: header, sidebar.
2. Auth pages (login, signup, reset-password).
3. Dashboard + calendar (highest-traffic staff pages).
4. Reservations, guests, rooms.
5. Settings (property, team, billing).
6. Guest-portal (self check-in) — highest priority for real translation quality since actual international guests use it.
7. Analytics, check-in-history (lowest traffic, last).

For each section: extract strings to `messages/en.json` under a namespaced key (e.g. `header.searchPlaceholder`), replace hardcoded text with `useTranslations()` / `getTranslations()`, then generate the other 9 languages' values for just those new keys. Ship and verify each section before moving to the next.

### Stage 3 — RTL pass (last)
- Once real Arabic strings exist on screen, do a dedicated layout pass on shared components: flex-direction, icon mirroring, logical padding/margin properties (`ps-`/`pe-` instead of `pl-`/`pr-`).
- This is layout work, not translation work — easiest to verify visually once Arabic text is actually rendering.

## Testing / Verification
- No test framework in this repo — verification is manual/browser-driven, consistent with existing project convention.
- Edge cases to verify: missing translation key falls back to English (never shows a raw key like `header.searchPlaceholder` to a user); unsupported locale in URL redirects to English; RTL layout checked visually per shared component once Arabic is live.

## Status
Design locked and documented 2026-07-01. Not started — begin with Stage 1 in a dedicated session.
