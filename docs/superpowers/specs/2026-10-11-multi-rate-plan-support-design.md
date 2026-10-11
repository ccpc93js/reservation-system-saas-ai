# Multi-Rate-Plan Support — Design

**Date:** 2026-10-11
**Status:** Approved for implementation planning
**Driven by:** Channex PMS certification rejection — their test property
(`Test Property - (HostMagSmart)`) has 2 rate plans per room type (Best
Available Rate + Bed & Breakfast), and our data model can only represent
one. Separately, the rejection also flagged that our restriction pushes
always send every field instead of only the ones an edit actually touched.

## Problem

`room_types` conflates two concerns in one row: physical attributes (name,
capacity, gender — what the room *is*) and commercial attributes (base
price, stop sell, min/max stay, CTA/CTD — how it's *sold*). Real hotels sell
one physical room type under several commercial terms ("Best Available
Rate" vs. "Bed & Breakfast", often at different prices and with different
restrictions). Our system has no way to represent that: `room_type` and
`rate_plan` are the same local entity, 1:1, and `channel_provider_links`
only ever maps one Channex rate plan per room type.

Separately: `pushRatesForOrg` computes an *effective value* for every
restriction field (override merged with standing default) and sends all of
them on every push. Channex's `/restrictions` endpoint is a genuine partial
update — an omitted field is left untouched on their side, not reset — so a
"change the rate" edit should produce a payload containing only `rate`, not
every field re-stated. Channex's cert flagged this explicitly ("update
should contain only rates, but also contains restriction(s): ...").

## Scope

**In scope:** rate plans as a pricing/restriction/distribution concept.
Provisioning, the Rates & Restrictions page, and the Channex push path all
become `(room_type, rate_plan)`-aware instead of `room_type`-only. Sparse
(touched-fields-only) outbox-driven pushes; full-snapshot behavior is kept
for explicit full-sync calls, where it's correct.

**Out of scope:** reservation creation. Booking a bed/room keeps setting
`price_per_night` directly, exactly as today — it does not reference a rate
plan. This is a deliberate v1 boundary (confirmed with the user), not an
oversight; wiring rate plans into the booking flow is a separate, later
feature if wanted.

**Explicitly untouched:** availability. A room type's available unit count
is shared across all its rate plans (same physical inventory) — this is
real hotel semantics, not a corner cut. `pushAvailabilityForOrg` and
`enqueueAvailability` are unchanged.

## Data model

New table, one row per sellable rate plan:

```sql
create table public.rate_plans (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  room_type_id uuid not null references room_types(id) on delete cascade,
  name text not null,
  base_price numeric not null,
  stop_sell boolean not null default false,
  min_stay_arrival integer check (min_stay_arrival is null or min_stay_arrival > 0),
  min_stay_through integer check (min_stay_through is null or min_stay_through > 0),
  max_stay integer check (max_stay is null or max_stay > 0),
  closed_to_arrival boolean not null default false,
  closed_to_departure boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one default rate plan per room type (the one existing
-- bookings/UI implicitly meant before this feature existed).
create unique index rate_plans_one_default_per_room_type
  on public.rate_plans (room_type_id) where is_default;
```

RLS mirrors `room_types`' existing org-membership policy.

`room_type_rate_overrides` changes its grain from `(room_type_id, date)` to
`(rate_plan_id, date)`:

```sql
alter table public.room_type_rate_overrides
  add column rate_plan_id uuid references rate_plans(id) on delete cascade;

-- Backfill: every existing override row points at its room type's
-- (newly-created) default rate plan.
update public.room_type_rate_overrides o
  set rate_plan_id = rp.id
  from public.rate_plans rp
  where rp.room_type_id = o.room_type_id and rp.is_default;

alter table public.room_type_rate_overrides
  alter column rate_plan_id set not null,
  drop constraint room_type_rate_overrides_unique,
  add constraint room_type_rate_overrides_unique unique (rate_plan_id, date);

-- room_type_id kept (denormalized, not dropped) — every current query that
-- filters/joins by room type keeps working without a join through
-- rate_plans, and availability logic never needs to change.
```

**Migration order** (one migration file, run in order):
1. Create `rate_plans`.
2. Insert one default rate plan per existing room type, copying
   `base_price`/`stop_sell`/`min_stay_arrival`/`min_stay_through`/`max_stay`/
   `closed_to_arrival`/`closed_to_departure` verbatim, `name = 'Standard Rate'`.
3. Add + backfill + constrain `room_type_rate_overrides.rate_plan_id` as above.
4. Leave `room_types`' pricing/restriction columns in place for this
   migration (read-only going forward, all writes move to `rate_plans`) —
   dropped in a follow-up cleanup migration once this has run in production
   for a while. Keeping them avoids a two-way sync bug risk during rollout
   and costs nothing (they're just stale after this ships).

This means **zero behavior change** for every existing org until someone
adds a second rate plan to a room type: one room type → one rate plan,
same price, same restrictions, same Channex mapping as before.

## Provisioning (`src/lib/channels/channex-provision.ts`)

Loop over `rate_plans` (joined to their room type for `occ_adults`/Channex
room type id) instead of synthesizing one `"Standard Rate"` per room type.
Each rate plan gets its own `channel_provider_links` row
(`kind='rate_plan', local_id=rate_plans.id`) — this table already supports
N rows per room type structurally (it's keyed by `local_id`, not
`room_type_id`); today it just happens to receive exactly one per room type
because that's all `provisionOrg` creates.

`title` sent to Channex becomes the rate plan's own `name` (was the literal
string `"Standard Rate"`).

## Push logic (`src/lib/channels/channex-rates.ts`)

`pushRatesForOrg` groups by `rate_plan_id` directly (was `room_type_id`,
then fanned out to that room type's — usually singular — mapped rate
plans). Reads standing values from `rate_plans` instead of `room_types`;
reads overrides keyed by `rate_plan_id`. Availability's room-type grouping
in `channex-availability.ts` is untouched.

**Sparse payloads.** `toRestrictionFields` takes an optional
`touchedFields?: Set<OverrideFieldKey>`:

```ts
function toRestrictionFields(
  v: EffectiveValues,
  touchedFields?: Set<OverrideFieldKey>
): Omit<RestrictionValue, "property_id" | "rate_plan_id" | "date_from" | "date_to"> {
  const include = (k: OverrideFieldKey) => !touchedFields || touchedFields.has(k);
  return {
    ...(include("rate") ? { rate: toChannexMinor(v.rate) } : {}),
    ...(include("stop_sell") ? { stop_sell: v.stop_sell } : {}),
    ...(include("closed_to_arrival") ? { closed_to_arrival: v.closed_to_arrival } : {}),
    ...(include("closed_to_departure") ? { closed_to_departure: v.closed_to_departure } : {}),
    ...(include("min_stay_arrival") && v.min_stay_arrival != null ? { min_stay_arrival: v.min_stay_arrival } : {}),
    ...(include("min_stay_through") && v.min_stay_through != null ? { min_stay_through: v.min_stay_through } : {}),
    ...(include("max_stay") && v.max_stay != null ? { max_stay: v.max_stay } : {}),
  };
}
```

`touchedFields` omitted (`undefined`) → today's behavior, every field
included. This is the correct behavior for a full sync (cert Test #1
explicitly wants every field for every date) and is what direct
`pushRatesForOrg` calls from the manual "Sync availability" button and the
nightly reconcile cron keep doing — they don't pass `touchedFields`.

`run-length compression` (`sameValues`) still compares only the fields in
`touchedFields` when it's provided, so two consecutive nights that differ
only in an untouched field still merge into one compressed entry.

`PushRatesOptions` gains `touchedFields?: Set<OverrideFieldKey>`, threaded
through from the outbox worker (below).

## Outbox (`src/lib/channels/channex-outbox.ts`)

`channex_outbox` gains a nullable column:

```sql
alter table public.channex_outbox add column touched_fields text[];
```

`null` = "unknown / everything" (matches every existing row and any future
caller that doesn't track it — e.g. availability rows, which don't use
this column at all).

`enqueueRestrictions(supabase, orgId, from, to, roomTypeIds, touchedFields?)`
takes the touched-field list from `applyRateOverrides`/
`clearRateOverrideField`'s `touchedKeys` and stores it on the inserted row.

`processOutbox`'s grouping already coalesces same-`(org, kind)` rows into
one push; it now also unions each group's `touched_fields` — if every
coalesced row shares the same touched fields (the overwhelmingly common
case: one save = one outbox row = one group), the group pushes exactly
those fields. If rows in a group disagree (two different edits landing in
the same ~1-minute drain window, or any row has `null`), the group falls
back to sending everything for that push — correct, just not maximally
sparse; a rare case and not worth the complexity of per-row-sparse batching
within one push.

## Rates & Restrictions page

Room type selection gains a second step: once a room type is checked, its
rate plans appear as a sub-list (checkboxes), defaulting to that room
type's single rate plan pre-checked when only one exists — **today's UI
flow is pixel-identical for every org that hasn't added a second rate
plan**. `applyRateOverrides`'s `roomTypeIds` parameter becomes
`ratePlanIds`; the API route (`/api/room-types/rate-overrides`) and its
validation schema follow the same rename.

A new, small "Rate Plans" management section lives on the Rates &
Restrictions page itself (not `room-types-dialog.tsx`, which stays focused
on physical attributes only — name/capacity/gender — consistent with the
split this feature is making). Per room type: list its rate plans, add a
new named one with its own base price, edit/rename, delete (blocked if it's
the `is_default` one or has existing overrides — require reassigning or
clearing first). Adding a rate plan triggers provisioning for that one
plan via the existing `provisionOrg` (idempotent, safe to call for a
single new row).

## Testing

- `rate_plans` migration: apply to a Supabase branch, verify the backfill
  produces exactly one default rate plan per existing room type with
  matching values, verify `room_type_rate_overrides.rate_plan_id` backfills
  correctly and the new unique constraint holds.
- `channex-provision.test.ts` (new): one rate plan in → one
  `channel_provider_links` row; two rate plans on one room type → two rows,
  two separate Channex rate-plan creations.
- `channex-rates.test.ts` (extend): grouping by `rate_plan_id` with two
  plans on one room type produces two independent `RestrictionValue`
  streams with independently-compressed runs; `toRestrictionFields` with a
  `touchedFields` set omits untouched fields; without it, includes
  everything (regression — existing full-sync tests must keep passing
  unchanged).
- `channex-outbox.test.ts` (extend): touched-fields union on coalesced
  groups; single-row groups pass their exact touched-fields through.
- `rate-overrides.test.ts` (extend): `ratePlanIds` rename; touched-fields
  passed through to `enqueueRestrictions`.
- API route tests (`rate-overrides/route.test.ts`): payload shape rename.

## Rollout

1. Migration ships first, alone, verified against production data shape
   (every room type gets exactly one default rate plan) before any code
   that reads `rate_plans` ships.
2. Provisioning + push logic ship next — existing orgs keep working
   unchanged (one rate plan each), verified via the existing cert test
   suite re-run against `hostel-downtown-inn` (single-rate-plan org) before
   touching the Channex cert property.
3. UI ships last. Until it ships, a manager has no way to create a second
   rate plan — safe, incremental exposure.
4. Only then: add the second ("Bed & Breakfast") rate plan to Twin Room and
   Double Room on `test-property-hostmagsmart-channex`, and re-run every
   certification test against the literal values in Channex's own doc
   table (not improvised ones), through the real UI.
