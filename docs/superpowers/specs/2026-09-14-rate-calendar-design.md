# Per-date rate & restriction calendar

## Problem

Channex PMS certification tests 2–8 each require changing a *specific*
rate or restriction for a *specific* date or date range "in the PMS UI"
and verifying the resulting Channex push. Today `room_types` only has
flat standing columns (`base_price`, `stop_sell`, `min_stay_arrival`,
`min_stay_through`, `closed_to_arrival`, `closed_to_departure`) —
one value per room type, applied uniformly across the whole push
horizon (see
[2026-08-29-channex-restrictions-design.md](2026-08-29-channex-restrictions-design.md),
which deliberately scoped restrictions to standing values and left
date-ranged restrictions as "a possible future iteration"). There is no
way to say "$333 on Nov 22 only" anywhere in the app. This spec is that
future iteration.

It also corrects a fact from the prior spec: that spec concluded
`max_stay` "isn't part of Channex's `RestrictionValue` shape" and
scoped it out. Re-checked against the live docs
(`docs.channex.io/api-v.1-documentation/ari.md`) for this spec:
`POST /restrictions` **does** accept `max_stay` (`Non-negative Integer`,
optional), alongside `min_stay_arrival`, `min_stay_through`,
`closed_to_arrival`, `closed_to_departure`, `stop_sell`. `max_stay` is
in scope here.

Scope decision (confirmed with the user): keep the local model at **one
rate plan per room type** (no real multi-rate-plan feature). The second
Channex rate plan created for certification (Bed & Breakfast) receives
the same per-date values as the primary rate plan when both are mapped
— see "Outbound push" below.

## Data model

New table, one row per `(room_type, date)` that has an override:

```sql
create table room_type_rate_overrides (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  room_type_id uuid not null references room_types(id),
  date date not null,
  rate numeric,                 -- null = inherit room_types.base_price
  min_stay_arrival integer,     -- null = inherit room_types.min_stay_arrival
  min_stay_through integer,     -- null = inherit room_types.min_stay_through
  max_stay integer,             -- null = inherit room_types.max_stay (new column, see below)
  stop_sell boolean,            -- null = inherit room_types.stop_sell
  closed_to_arrival boolean,    -- null = inherit room_types.closed_to_arrival
  closed_to_departure boolean,  -- null = inherit room_types.closed_to_departure
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_type_id, date)
);
```

RLS mirrors every other org-scoped table (membership-based policy via
`organization_id`).

`room_types` gains one new standing column for parity with the other
five restriction fields:

- `max_stay integer` — nullable, `null` = no restriction (Channex
  `max_stay: 0` also means unlimited, so a `null` standing value is
  simply omitted from the push, same as the existing min-stay
  omit-when-null behavior).

Every override field is independently nullable — a row can override
just `rate` for a date and leave every restriction field inheriting
from the room type's standing values, or vice versa. This is per-*date*
row storage (not stored ranges), matching the existing convention on
the availability side (`free_beds_ranges` computes ranges from
per-night state at query/push time) — so creating, editing, and
overlapping date ranges from the UI is a set of simple per-date
upserts, and range-compression only happens once, at push time.

Migration file:
`supabase/migrations/20260914_channex_rate_overrides.sql`, following
the existing plain-`.sql` convention (applied directly against the
remote project; no local Supabase CLI/config.toml in this repo).

## Outbound push

`pushRatesForOrg` in
[src/lib/channels/channex-rates.ts](../../../src/lib/channels/channex-rates.ts)
changes from "one standing value sent flat across the whole window" to:

1. For each room type in scope, fetch its standing defaults (existing
   `room_types` columns, now including `max_stay`) and every
   `room_type_rate_overrides` row with `date` in `[from, lastNight]`.
2. Build the effective per-night value for each of the six fields:
   override value if the row exists and the field is non-null on it,
   else the room type's standing value.
3. Run-length compress consecutive nights with identical effective
   values (across all six fields as one tuple — a change to any one
   field starts a new run) into `{date_from, date_to, ...}` entries.
   Same technique `pushAvailabilityForOrg` already uses for
   availability, reimplemented here in TS (small n — at most 500
   nights per room type) rather than a SQL RPC, since the source rows
   already live in two small, already-fetched tables rather than
   being computed from bookings.
4. For each compressed entry, still omit a field from the payload
   rather than sending `null` when neither the override row nor the
   room type standing column sets it (preserves the existing
   partial-update-safety behavior for min-stay, now extended to
   `max_stay`; boolean fields keep being sent always, same as today,
   since Channex has no "unset boolean").
5. Push against **every** rate plan mapped for that room type (today:
   one `channel_provider_links` row of kind `rate_plan` per room type;
   if a second is ever linked — e.g. the certification B&B plan — the
   same compressed entries are sent for it too, each with its own
   `rate_plan_id`). This is what satisfies "Double B&B $456.23 on 29
   Nov" in Test 3 without a real local multi-rate-plan model: the
   *same* per-date value the UI sets for a room type goes to every
   Channex rate plan mapped to it.
6. All entries across all room types/rate plans for the push's scope
   go in **one** `channex.pushRestrictions(values)` call — `values` is
   already an array, so a single outbox group naturally becomes one
   POST regardless of how many room types, date ranges, or fields were
   touched by the triggering edit(s).

`channex.ts`: add `max_stay?: number` to `RestrictionValue`.

No changes needed to the outbox coalescing logic itself
([src/lib/channels/channex-outbox.ts](../../../src/lib/channels/channex-outbox.ts))
— it already groups same-tick `restrictions` rows per org into one
`pushRatesForOrg` call over the merged date window; it just starts
mattering more once that call reflects real per-date variation.

Test 1 (full 500-day sync, "should vary by date, not uniform
placeholders") is satisfied as a side effect once Tests 2–8 have
written override rows across a spread of dates — the full-sync push
reads the same per-date data as every other push path.

## UI

New page — **Rates & Restrictions** — alongside the existing Room
Types / Rooms pages (`/[locale]/[slug]/rates`, client component
pattern matching `room-types-list-client.tsx`).

**Bulk-edit form:**
- Room type(s) — multi-select checkboxes
- Date range — from/to date pickers (a single date = `from == to`)
- Fields, each with its own apply-toggle so a save can touch only
  what's intended: Rate, Min stay (arrival), Min stay (through), Max
  stay, Stop sell, Closed to arrival, Closed to departure

Save → new API route `POST /api/room-types/rate-overrides` (manager+
role, same auth pattern as `src/app/api/room-types/[id]/route.ts`):
for each `(room_type_id × date)` in the selected scope, upsert
`room_type_rate_overrides` touching only the toggled-on fields (existing
values for untouched fields on that row are preserved). Then calls
`enqueueRestrictions(orgId, from, to, roomTypeIds)` **once** for the
full scope of the save.

**Overrides list** below the form: table of upcoming overrides in the
viewed date range (date, room type, field, value), each row with a
"clear" action that sets that one field back to `null` on the override
row (the row itself is never deleted, even if every field ends up
`null` — it's harmless and avoids a separate cleanup path) — lets staff
audit/undo, and lets certification scenarios be re-run cleanly without
stale test data lingering.

## Testing

Unit tests, `channex-rates.test.ts`:
- an override row's `rate` wins over `base_price` for its date; dates
  without a row fall back to standing values
- a field left `null` on an override row inherits the standing value
  for that field specifically (mixed override: rate overridden,
  restrictions inherited)
- run-length compression: multiple room types with different change
  patterns in the same window produce the minimum number of entries
  (verifies "batched into 1 API call" isn't accidentally one call per
  night)
- `max_stay` round-trips through `RestrictionValue` and is omitted
  when neither override nor standing value sets it
- multiple mapped rate plans for one room type each receive their own
  `rate_plan_id` with the same compressed values
- existing flat-value behavior (no overrides in range) is unchanged
  from before this spec — regression coverage for
  2026-08-29-channex-restrictions-design.md's existing tests

Unit tests, new `rate-overrides` API route: upsert merge semantics
(existing fields preserved when a save only toggles a subset), auth/role
gate, enqueue called exactly once per save with the correct scope.

## Out of scope

- Real multi-rate-plan modeling (independently priced products per
  room type) — explicitly deferred; see scope decision above.
- Seasonal/recurring rate rules (e.g. "weekends +20%") — this spec is
  explicit per-date overrides only.
- A visual calendar-grid UI — bulk-edit form only, per the approved
  design.
