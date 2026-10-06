# Channex restriction fields: stop_sell, min_stay, closed_to_arrival/departure

## Problem

Channex PMS Certification requires reporting which ARI restrictions the
PMS supports (`docs.channex.io/api-v.1-documentation/pms-certification-tests`).
Today only `availability` and `rate` are pushed — `RestrictionValue` in
[src/lib/channels/channex.ts](../../../src/lib/channels/channex.ts) declares
`min_stay_arrival`, `min_stay_through`, `stop_sell`, `closed_to_arrival`,
`closed_to_departure` as TypeScript fields, but nothing in the codebase ever
sets or pushes them, and `max_stay` isn't modeled at all. There's no schema,
no UI, and no push wiring for any of the five.

This spec covers implementing those five fields end-to-end so the
certification answer can honestly include them. `max_stay` is out of scope —
it doesn't exist in Channex's `RestrictionValue` shape either (confirmed
against `references/api.md` in the channex-pms-integration skill and the
live docs), so there's nothing to certify there regardless.

## Data model

Flat columns on `room_types`, mirroring how `base_price` already works —
one standing value per room type, no date-range table:

- `stop_sell boolean not null default false`
- `min_stay_arrival integer` — nights required if arriving on a given date;
  `null` = no restriction
- `min_stay_through integer` — nights required to stay through a given
  date; `null` = no restriction
- `closed_to_arrival boolean not null default false`
- `closed_to_departure boolean not null default false`

These are **standing policy toggles**, not calendar-scoped: e.g. "this room
type always requires a 2-night minimum" or "temporarily closed to new
arrivals" (an admin flips `stop_sell`/`closed_to_arrival` off when ready).
This intentionally does not model Channex's native date-ranged restrictions
— it's the simplest thing that lets the PMS report real, non-fabricated
support for these fields. A date-ranged version is a possible future
iteration, not part of this spec.

Migration file: `supabase/migrations/<date>_channex_restrictions.sql`,
following the plain-`.sql`-file convention already used for every other
Channex migration in this repo (there's no `supabase/config.toml` or CLI
wiring — migrations are written here for history and applied directly
against the remote project via the Supabase MCP).

## UI

Add the five fields to the room type edit form (the page at
`src/app/(dashboard)/rooms/page.tsx` / `src/app/[locale]/[slug]/rooms/page.tsx`,
backed by `src/app/api/room-types/[id]/route.ts`), grouped under a
"Channel restrictions" section:

- Stop sell (toggle)
- Closed to arrival (toggle)
- Closed to departure (toggle)
- Min stay on arrival (nights, optional number input)
- Min stay through (nights, optional number input)

`src/app/api/room-types/[id]/route.ts` (PATCH/PUT) accepts and persists the
five new fields alongside existing room type fields.

## Outbound push

Extend `pushRatesForOrg` in
[src/lib/channels/channex-rates.ts](../../../src/lib/channels/channex-rates.ts)
to read the five columns per room type and include them in the same
`RestrictionValue` object already built for `rate`:

```ts
values.push({
  property_id: propertyId,
  rate_plan_id: ratePlanId,
  date_from: from,
  date_to: lastNight,
  rate: toChannexMinor(rt.base_price ?? 0),
  stop_sell: rt.stop_sell,
  closed_to_arrival: rt.closed_to_arrival,
  closed_to_departure: rt.closed_to_departure,
  ...(rt.min_stay_arrival != null ? { min_stay_arrival: rt.min_stay_arrival } : {}),
  ...(rt.min_stay_through != null ? { min_stay_through: rt.min_stay_through } : {}),
});
```

Still one partial-update payload per rate plan per push, still
range-compressed (constant values over the whole horizon collapse to one
entry, as today) — no new compression logic needed since these are
standing values, not per-date. Because `/restrictions` is a partial
update, omitting a `null` min-stay field leaves whatever Channex already
has for that field untouched rather than clearing it — so a room type that
has never set a min-stay won't accidentally blank out a manually-set value
on the Channex side. Editing a room type's restriction fields should
enqueue the same outbox push path a price edit already triggers (via
`enqueueAvailability`/the existing outbox debounce — same trigger surface
as `base_price` edits today).

## Testing

Unit tests for `channex-rates.ts`:
- all five fields map onto the pushed `RestrictionValue` correctly
- `null` min-stay fields are omitted from the payload, not sent as `null`
  (partial-update semantics preserved)
- booleans default to `false` and are always sent (no partial-omit
  ambiguity for booleans — Channex has no notion of "unset boolean")
- existing `rate`-only behavior (range compression, past-date exclusion)
  is unaffected

## Out of scope

- `max_stay` — not part of Channex's restriction shape.
- Date-ranged/seasonal restrictions — flat columns only, per the approved
  design.
- Automatic `stop_sell` derivation from availability reaching zero —
  `stop_sell` here is a manual admin override, independent of the existing
  availability push.
