# Phase 2a: `src/app/api/reservations/` route tests

## Problem

Phase 1 (merged, commit `3dc3660`) set up Vitest and unit-tested 12 `src/lib`
files. Explicitly deferred: the remaining `src/lib` files, all 72 API route
handlers under `src/app/api`, and all 46 React components. "Phase 2" as a
single spec would cover all of that — too large and architecturally mixed
(routes need a different mocking strategy than `src/lib`; components need a
third, `jsdom`/RTL-based tier) to execute as one plan.

This spec covers only **Phase 2a**: the 13 route handlers under
`src/app/api/reservations/`. It was chosen over the alternatives (a smaller
`room-types/`+`rooms/`+`beds/` slice, or the larger `channels/` directory)
because it's the single largest route category and the core business logic
of the app — booking creation, cancellation, checkout, date changes — where
a regression does the most damage and is easiest to introduce silently.

## Why routes need a different approach than `src/lib`

Every function tested in Phase 1 took its `SupabaseClient` as an explicit
parameter. Route handlers don't: they call `createServerClient()` from
`@/lib/supabase/server` as a module-level import, then
`supabase.auth.getUser()` before touching any table. This repeats
byte-for-byte across essentially every route in the directory (confirmed by
reading `cancel`, `checkout`, `[id]` GET/PATCH/DELETE, and the list route in
full).

The second difference: `src/lib`'s Channex functions queried single tables
with simple `.eq()` chains. Route handlers routinely `.select()` with
relational embeds — `guests(first_name, last_name)`,
`reservation_items(bed_id, beds(id, name, rooms(id, name)))` — and use
comparison operators the Phase 1 fake client never needed: `.gte()`,
`.lte()`, `.lt()`, `.gt()`, `.is()`, `.not()`, `.range()`. This isn't
specific to one complex route (`create`) — it's the norm across the
directory (the plain list route alone uses `.in()`, `.gte()`, `.lte()`,
`.order()`, `.range()`, and a three-level nested embed).

## Fake-client extensions

All additive to `src/lib/test/fake-supabase.ts` — nothing from Phase 1
changes behavior, per that file's own header comment ("extend this file...
if a later test needs a method that isn't here yet").

**Auth.** `FakeSupabaseClient` gets a `setUser(user: {id: string} | null)`
method and an `auth` property: `{ getUser: async () => ({ data: { user:
this.currentUser }, error: this.currentUser ? null : { message: "not
authenticated" } }) }`. Defaults to no user (so a test that forgets to call
`setUser` fails loudly with a 401 assertion, not a silent pass).

**Relational embeds.** `.select("col1, col2, table_name(nested_col,
nested_table(...))")` gets parsed for embed clauses and each embed resolved
against the fake's other seeded tables via a **declared** foreign-key map —
not schema introspection. A small static map in the fake client (or passed
per-call) states `{ reservation_items: { beds: "bed_id" }, beds: { rooms:
"room_id" }, reservations: { guests: "guest_id" }, ... }` for exactly the
relationships exercised by seeded fixtures in this phase's tests. This is a
join **resolver**, not a query planner: it only resolves embeds the test
actually requests, doesn't validate the embed syntax exhaustively, and new
relationships get added to the map only when a test needs them — matching
the "extend when needed" philosophy already established.

**New filter operators.** `.gte(col, val)`, `.lte(col, val)`, `.lt(col,
val)`, `.gt(col, val)`, `.is(col, val)` (for `is null`/`is not null`),
`.not(col, op, val)` (the subset used: `.not("reservations.status", "in",
"(...)")`), `.range(from, to)` (pagination — slices the filtered result).

**Real `.order()`.** Phase 1's `.order()` is a no-op (documented as such,
harmless there since no test depended on row order). List-route tests in
this phase assert on sort order, so `.order(col, {ascending})` needs a real
implementation: sort the filtered result by the given column.

## Route-handler test approach

`vi.mock("@/lib/supabase/server")` replaces `createServerClient` (and
`createServiceClient`, used by a few routes) with a factory returning a
`FakeSupabaseClient` instance the test controls — no source changes to any
route file. Route handlers are plain exported async functions
(`GET`/`POST`/`PATCH`/`DELETE`) taking a `Request` and (for dynamic routes)
`{ params: Promise<{id: string}> }` — tests call them directly:

```ts
const res = await PATCH(
  new Request("http://test/api/reservations/res-1/cancel", {
    method: "PATCH",
    body: JSON.stringify({ cancellation_reason: "guest_request" }),
  }),
  { params: Promise.resolve({ id: "res-1" }) }
);
expect(res.status).toBe(200);
```

**External side-effect modules are mocked wholesale**, the same pattern
Phase 1 used for `@/lib/notifications`: `@/lib/email` (sends real email —
not this phase's concern, and doing so in a test would be a live side
effect), `@/lib/notifications`, `@/lib/channels/channex-outbox`, and
`@/lib/checkout` (its `finalizeCheckout` touches beds/housekeeping tables
and sends email — mocked here; testing `checkout.ts` itself is separate,
deferred `src/lib` work). Each route test asserts these were *called* with
the right arguments where that's part of the route's contract (e.g.,
cancel enqueues availability for the freed date range) without asserting
on what happens inside them.

**Auth fixture convention**: a small per-test-file helper seeds the
"logged-in user + org membership" scenario every route needs:

```ts
function authedDb(role = "manager") {
  const db = new FakeSupabaseClient();
  db.setUser({ id: "user-1" });
  db.seed("memberships", [{ organization_id: orgId, user_id: "user-1", role }]);
  return db;
}
```

Each route's own resource-ownership check (e.g., cancel's "does this
reservation belong to the caller's org" via a second `memberships` lookup
keyed off the reservation's `organization_id`) is exercised per test on top
of this base fixture, not hidden inside the helper.

## Scope: all 13 routes

| Route | What's tested |
|---|---|
| `reservations/route.ts` (GET, list) | auth/membership gate; status/date-range/channel filters; pagination (`range`); sort order; relational embed shape in the response |
| `reservations/create/route.ts` (POST) | auth/membership gate; guest create-or-reuse; multi-bed conflict detection (the `.in().lt().gt().not()` chain) rejects overlapping bookings; rollback (reservation deleted) on items-insert failure and on a stale conflict; total price computation across bed count × nights; `enqueueAvailability`/`notifyOrg` called with the booked date range |
| `reservations/[id]/route.ts` (GET/PATCH/DELETE) | ownership gate; partial update semantics; `reservation_guests` primary-guest sync on guest change; checkout side-trigger on `status: "checked_out"` |
| `reservations/[id]/cancel/route.ts` (PATCH) | ownership gate; reason validation; status transition + notes text; availability re-enqueued for the freed range |
| `reservations/[id]/checkout/route.ts` (PATCH) | ownership gate; payment amount validation; status transition; `finalizeCheckout` called |
| `reservations/[id]/extend/route.ts` | ownership gate; date-extension validation and conflict check |
| `reservations/[id]/update-dates/route.ts` | ownership gate; date validation; conflict check on the new range |
| `reservations/[id]/guests/route.ts` | ownership gate; guest attach/detach on a reservation |
| `reservations/[id]/items/route.ts` | ownership gate; reservation-item read/mutation |
| `reservations/[id]/payment/route.ts` | ownership gate; payment amount recorded |
| `reservations/[id]/registry/route.ts` | ownership gate; checkin-registry read |
| `reservations/[id]/segment-rate/route.ts` | ownership gate; segment-rate calculation |
| `reservations/availability/route.ts` (GET) | auth/membership gate; availability query shape |

Exact per-route test cases (edge cases, specific assertions) are determined
per-task in the implementation plan after reading each route's actual
source — this table states what's in scope, not the final assertion list
(matching how Phase 1's plan was written after reading every source file,
not guessed from a summary).

## Out of scope (this spec)

- `@/lib/checkout.ts`, `@/lib/email.ts`, `@/lib/notifications.ts`,
  `@/lib/channels/channex-outbox.ts` internals — mocked, not tested here.
  (`channex-outbox.ts` already has direct unit tests from Phase 1.)
- Every other `src/app/api/*` directory (channels/, guests/, settings/,
  beds/, rooms/, room-types/, billing/, staff/, onboarding/,
  notifications/, invitations/, guest-portal/, webhooks/, etc.) — a later
  phase, each getting its own scoping pass since route complexity varies
  (webhooks/ likely needs signature-verification mocking; billing/ likely
  needs Stripe mocking; neither pattern is designed here).
- React components (`src/components/`) — needs a `jsdom`/React Testing
  Library tier, a separate infrastructure decision from route testing.
- Any change to route source files. Same rule as Phase 1: extend the fake
  client and mocks, never the code under test, unless a genuine source bug
  is found (in which case: stop, report, don't fix silently).
