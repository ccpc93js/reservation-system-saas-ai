# Test infrastructure + src/lib unit tests (Phase 1)

## Problem

This repo has zero test infrastructure: no Vitest/Jest, no test script, no
test files anywhere (confirmed by search). `package.json` only has `dev`,
`build`, `start`, `lint`, `typecheck`. Verification of the recent Channex
restrictions feature relied on `tsc --noEmit`, a production build, and a
manual DB readback via the Supabase MCP — there is no automated regression
net for business logic.

The user asked for unit tests across "the whole app." That's too large a
scope for one spec: `src/lib` has 37 files, `src/app/api` has 72 route
handlers, `src/components` has 46 files — 155 files total, spanning several
architecturally distinct testing problems (pure functions, DB-touching
logic, HTTP route handlers, React components). This spec covers only
**Phase 1**: test infrastructure plus unit tests for the highest-risk, most
mechanically testable logic in `src/lib`. Later phases (API routes, React
components, and the deferred `src/lib` files below) get their own
spec → plan → implementation cycles.

## Framework

**Vitest** (`vitest`, `@vitest/coverage-v8`, `vite-tsconfig-paths`). Rationale:
- Standard modern choice for Next.js/TS projects; no Jest config to migrate
  from since none exists.
- Native ESM + TS support with no separate transpile step (`ts-jest`,
  `babel-jest`) to configure.
- `vite-tsconfig-paths` resolves the `@/*` alias already declared in
  `tsconfig.json`, so test files import the same way source files do — no
  parallel alias config to keep in sync.

`package.json` gets a `"test": "vitest run"` script (and `"test:watch":
"vitest"` for local dev) alongside the existing `dev`/`build`/`lint`/
`typecheck` scripts. `vitest.config.ts` at the repo root configures the
`@/` alias and a `node` test environment (no `jsdom` needed for Phase 1 —
that's a React-testing-tier concern for a later phase).

## Supabase mocking

Every function under test in `src/lib` takes a `SupabaseClient` as an
explicit parameter rather than importing a module-level singleton — that's
what makes this code unit-testable without a real database.

`src/lib/test/fake-supabase.ts` provides a hand-rolled fake implementing
only the chainable subset actually used by the code under test:
`.from(table).select().eq().single()/.maybeSingle()`, `.insert()`,
`.update()`, `.upsert()`, `.delete()`, `.in()`, `.or()`, `.order()`,
`.limit()`, and `.rpc(name, args)`. Each test seeds it with canned
per-table rows and (for `.rpc`) canned per-function-name return values;
assertions can inspect what was written by reading the fake's in-memory
table state after the call.

This is deliberately NOT a full Postgrest emulator — it implements exactly
the method surface the code under test calls today, typed against
`@supabase/supabase-js`'s `SupabaseClient` so a call to an unimplemented
method is a compile error, not a silent runtime gap. If a later phase's
code needs a method this fake doesn't have, extend the fake at that point
rather than speculatively building out the full query-builder API now.

## Phase 1 test scope

One test file per source file, colocated as `<name>.test.ts` next to the
source (Vitest's default discovery pattern, no separate `__tests__` tree):

| Source file | What's tested |
|---|---|
| `validations/room.ts` | yup schema accept/reject cases for create/update room type, including the min-stay/boolean restriction fields added in the prior session |
| `validations/guest.ts` | yup schema accept/reject cases |
| `validations/reservation.ts` | yup schema accept/reject cases |
| `channels/channex.ts` | `toChannexMinor` (major→minor unit conversion, string and number input), `unwrapOptions` (attributes-flattening) |
| `channels/channex-rates.ts` | `pushRatesForOrg`: rate + all five restriction fields map onto the pushed `RestrictionValue`; null min-stay omitted (not sent as `null`); constant values compress to one entry per rate plan; past dates excluded; unprovisioned org short-circuits |
| `channels/channex-availability.ts` | availability push mapping: overbooked/negative clamps to 0, cancelled bookings excluded, holds counted as occupied |
| `channels/channex-outbox.ts` | `enqueueAvailability`/`enqueueRestrictions` skip unprovisioned orgs; `processOutbox` groups pending rows per (org, kind), widens date ranges and room-type sets correctly, applies exponential backoff on transient errors, parks permanent (4xx) errors as `error` status |
| `channels/channex-bookings.ts` | `applyRevision`: new booking creates a reservation; cancellation of a known booking cancels it; cancellation of an unknown booking is skipped; modification of a held booking is parked in `channex_pending_mods` and does NOT mutate the reservation; overbooking (no free bed/room) still ingests as a flagged, unassigned reservation rather than being dropped; dedupe by `external_id` |
| `permissions.ts` | role/permission check logic |
| `plan.ts` | plan-limit logic |
| `countries.ts` | lookup/formatting logic |
| `utils.ts` | pure utility functions |

## Explicitly deferred (later phases, not this spec)

- `channels/channex-connect.ts`, `channex-doctor.ts`, `channex-mods.ts`,
  `channex-recovery.ts`, `channex-provision.ts` — secondary Channex admin
  flows (channel mapping, health checks, recovery sweep); same mocking
  approach applies, deferred only for scope, not because they're untestable.
- `stripe.ts`, `email.ts`, `billing-reconcile.ts`, `indexnow.ts`,
  `seo-faq.ts`, `help/articles.ts`, `qr-code.ts`, `site-url.ts`,
  `analytics-metrics.ts`, `metrics.ts`, `checkout.ts` — external-integration
  glue or lower-risk code; worth testing eventually but not in this pass.
- `hooks/*` — React hooks need `@testing-library/react-hooks`-style
  rendering (a `jsdom` environment), which is a React-testing-tier decision
  bundled with the later component-testing phase, not this one.
- `supabase/client.ts`, `server.ts`, `session.ts` — thin client factories
  wrapping `@supabase/ssr`; nothing meaningful to unit test.
- `types/*` — generated/declaration files, no logic.
- `src/app/api/**` (72 route handlers) and `src/components/**` (46 files) —
  separate phases per the phase ordering agreed with the user; each needs
  its own mocking/rendering strategy decision.

## Out of scope

- Integration/E2E tests against a real (or local) Supabase instance.
- CI wiring (a GitHub Actions step running `npm test`) — not requested;
  flag as a natural follow-up once Phase 1 lands.
- Coverage thresholds/enforcement — install the coverage tool so `npm run
  test -- --coverage` works, but don't gate on a percentage in this pass.
