# Multi-Rate-Plan Support — Implementation Plan

> **For AI agents working this plan:** Required sub-skill: use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement task-by-task. Steps use checkbox
> (`- [ ]`) syntax to track progress.

**Goal:** Let a room type have multiple named, independently-priced and
independently-restricted rate plans (e.g. "Best Available Rate", "Bed &
Breakfast"), each mapped to its own Channex rate plan, instead of today's
1:1 room-type-is-the-rate-plan model. Also fix restriction pushes to send
only the fields an edit actually touched instead of a full snapshot.

**Architecture:** New `rate_plans` table (FK to `room_types`) carries
price/restrictions; `room_types` keeps only physical attributes.
`room_type_rate_overrides` re-keys from `room_type_id` to `rate_plan_id`.
Provisioning, the Channex push path, and the Rates & Restrictions page's
room-type picker all become rate-plan-aware. Rate plan CRUD (add/edit/
rename/delete) lives in the existing room-type dialog, next to the physical
attributes it already edits — not a new surface. Availability and booking
creation are untouched (shared inventory pool, no rate-plan reference).

**Tech stack:** Next.js API routes, Supabase/Postgres, Vitest + the
project's `FakeSupabaseClient` test fixture, yup validation, react-hook-form.

**Design doc:** `docs/superpowers/specs/2026-10-11-multi-rate-plan-support-design.md`

---

## File structure

**Created:**
- `supabase/migrations/20261011_rate_plans.sql` — schema
- `src/lib/validations/rate-plan.ts` — rate-plan CRUD payload validation
- `src/app/api/room-types/[id]/rate-plans/route.ts` — POST create
- `src/app/api/room-types/[id]/rate-plans/[rateplanId]/route.ts` — PATCH, DELETE
- `src/app/api/room-types/[id]/rate-plans/route.test.ts`
- `src/app/api/room-types/[id]/rate-plans/[rateplanId]/route.test.ts`
- `src/lib/channels/channex-provision.test.ts`

**Modified:**
- `src/lib/rate-overrides.ts` — `roomTypeIds` → `ratePlanIds`, keyed by `rate_plan_id`
- `src/lib/rate-overrides.test.ts`
- `src/lib/validations/rate-override.ts` — rename
- `src/lib/validations/room.ts` — narrow to physical attributes only
- `src/lib/channels/channex-outbox.ts` — `touched_fields` column + union-on-coalesce
- `src/lib/channels/channex-outbox.test.ts`
- `src/lib/channels/channex-rates.ts` — group by `rate_plan_id`, sparse payload mode
- `src/lib/channels/channex-rates.test.ts`
- `src/lib/channels/channex-provision.ts` — provision rate plans, not room types
- `src/app/api/room-types/rate-overrides/route.ts` — rename body field
- `src/app/api/room-types/rate-overrides/route.test.ts`
- `src/app/api/room-types/rate-overrides/[id]/route.ts` — unchanged logic, type import rename
- `src/app/api/room-types/create/route.ts` — create default rate plan too; fix unscoped membership lookup
- `src/app/api/room-types/[id]/route.ts` — drop pricing/restriction fields from PATCH; fix unscoped membership lookup
- `src/components/rooms/room-types-dialog.tsx` — rate-plans list sub-section
- `src/app/[locale]/[slug]/rates/page.tsx` — fetch rate plans, pass to client
- `src/components/rates/rate-overrides-client.tsx` — rate-plan sub-picker
- `messages/en.json` (+ 10 other locale files, English placeholder text — matches existing precedent for this feature area)

---

## Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/20261011_rate_plans.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Multi-rate-plan support. Splits room_types' pricing/restriction columns
-- into a new rate_plans table (one room type -> many rate plans), re-keys
-- room_type_rate_overrides onto rate_plan_id, and adds touched_fields to
-- channex_outbox for sparse (partial) restriction pushes. See
-- docs/superpowers/specs/2026-10-11-multi-rate-plan-support-design.md.
--
-- room_types' own base_price/stop_sell/closed_to_arrival/closed_to_departure/
-- min_stay_arrival/min_stay_through/max_stay columns are left in place
-- (read-only from here on) — dropped in a follow-up cleanup migration once
-- this has run in production for a while.

create table public.rate_plans (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_type_id uuid not null references public.room_types(id) on delete cascade,
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

create unique index rate_plans_one_default_per_room_type
  on public.rate_plans (room_type_id) where is_default;

create index idx_rate_plans_org on public.rate_plans (organization_id);
create index idx_rate_plans_room_type on public.rate_plans (room_type_id);

alter table public.rate_plans enable row level security;

create policy rate_plans_org_access on public.rate_plans
  for all
  using (organization_id in (
    select memberships.organization_id from memberships where memberships.user_id = auth.uid()
  ));

comment on table public.rate_plans is 'Named, independently-priced/restricted ways to sell a room type (e.g. "Best Available Rate", "Bed & Breakfast"). Each maps to its own Channex rate plan via channel_provider_links.';

-- Backfill: every existing room type gets exactly one default rate plan,
-- carrying its current standing values verbatim.
insert into public.rate_plans (
  organization_id, room_type_id, name, base_price, stop_sell,
  min_stay_arrival, min_stay_through, max_stay,
  closed_to_arrival, closed_to_departure, is_default
)
select
  organization_id, id, 'Standard Rate', base_price, stop_sell,
  min_stay_arrival, min_stay_through, max_stay,
  closed_to_arrival, closed_to_departure, true
from public.room_types;

-- room_type_rate_overrides: re-key from room_type_id to rate_plan_id.
alter table public.room_type_rate_overrides
  add column rate_plan_id uuid references public.rate_plans(id) on delete cascade;

update public.room_type_rate_overrides o
  set rate_plan_id = rp.id
  from public.rate_plans rp
  where rp.room_type_id = o.room_type_id and rp.is_default;

alter table public.room_type_rate_overrides
  alter column rate_plan_id set not null;

alter table public.room_type_rate_overrides
  drop constraint room_type_rate_overrides_unique;

alter table public.room_type_rate_overrides
  add constraint room_type_rate_overrides_unique unique (rate_plan_id, date);

create index if not exists idx_room_type_rate_overrides_rate_plan_lookup
  on public.room_type_rate_overrides (rate_plan_id, date);

comment on column public.room_type_rate_overrides.rate_plan_id is 'The specific rate plan this override applies to. room_type_id is kept (denormalized) so existing room-type-scoped queries keep working without a join.';

-- channex_outbox: track which restriction fields an edit touched, so the
-- worker can send a sparse (partial) payload instead of a full snapshot.
-- Null = unknown/everything (every pre-existing row, and availability rows
-- which don't use this column at all).
alter table public.channex_outbox add column touched_fields text[];

comment on column public.channex_outbox.touched_fields is 'Restriction field names this edit touched (rate, stop_sell, min_stay_arrival, etc). Null = send every field (full sync). Only meaningful for kind=restrictions rows.';

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply the migration to the Supabase project**

Use the `mcp__supabase__apply_migration` tool with `name: "rate_plans"` and
the SQL above, or `supabase db push` if working from the Supabase CLI
locally. Verify with a read query:

```sql
select rt.name, rp.name, rp.is_default, rp.base_price
from room_types rt join rate_plans rp on rp.room_type_id = rt.id
order by rt.name;
```

Expected: exactly one row per existing room type, `is_default = true`,
`rp.name = 'Standard Rate'`, `rp.base_price` matching `room_types.base_price`.

```sql
select count(*) from room_type_rate_overrides where rate_plan_id is null;
```

Expected: `0`.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `mcp__supabase__generate_typescript_types` (or
`supabase gen types typescript` locally), write the result to
`src/lib/types/database.ts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261011_rate_plans.sql src/lib/types/database.ts
git commit -m "feat: add rate_plans table, re-key overrides onto it, add outbox touched_fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `lib/rate-overrides.ts` — rate-plan-scoped, touched-fields threaded through

**Files:**
- Modify: `src/lib/rate-overrides.ts`
- Modify: `src/lib/rate-overrides.test.ts`

- [ ] **Step 1: Update the failing/changed tests first**

Replace the full contents of `src/lib/rate-overrides.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channels/channex-outbox", () => ({
  enqueueRestrictions: vi.fn().mockResolvedValue(undefined),
}));

import { enqueueRestrictions } from "./channels/channex-outbox";
import { applyRateOverrides, clearRateOverrideField } from "./rate-overrides";

const orgId = "org-1";

describe("applyRateOverrides", () => {
  it("writes one row per rate plan per date in range, touching only the given fields", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(result).toEqual({ ok: true, rowsWritten: 1, skippedRatePlanIds: [] });
    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({
      rate_plan_id: "rp-1",
      date: "2026-11-21",
      rate: 333,
    });
    expect(db.tables.room_type_rate_overrides[0]).not.toHaveProperty("min_stay_arrival");
    expect(enqueueRestrictions).toHaveBeenCalledWith(
      db, orgId, "2026-11-21", "2026-11-22", ["rp-1"], ["rate"]
    );
  });

  it("preserves untouched fields on an existing row", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, rate_plan_id: "rp-1", date: "2026-11-21", rate: 100, min_stay_arrival: 2, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ rate: 333, min_stay_arrival: 2 });
  });

  it("expands a multi-date range into one row per date", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);

    await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-03",
      fields: { stop_sell: true },
    });

    expect(db.tables.room_type_rate_overrides.map((r: any) => r.date).sort()).toEqual([
      "2026-11-01", "2026-11-02", "2026-11-03",
    ]);
  });

  it("rejects rate plans that don't belong to the org", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "other-org", room_type_id: "rt-1" }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-01",
      fields: { rate: 100 },
    });

    expect(result.ok).toBe(false);
    expect(result.skippedRatePlanIds).toEqual(["rp-1"]);
    expect(db.tables.room_type_rate_overrides ?? []).toHaveLength(0);
  });

  it("skips rate plans that don't belong to the org but still writes the valid ones", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1", "rp-invalid"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(result.ok).toBe(true);
    expect(result.skippedRatePlanIds).toEqual(["rp-invalid"]);
    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ rate_plan_id: "rp-1" });
  });

  it("passes the exact set of touched field keys to enqueueRestrictions", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: orgId, room_type_id: "rt-1" }]);

    await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333, stop_sell: true },
    });

    expect(enqueueRestrictions).toHaveBeenCalledWith(
      db, orgId, "2026-11-21", "2026-11-22", ["rp-1"], ["rate", "stop_sell"]
    );
  });
});

describe("clearRateOverrideField", () => {
  it("nulls just the given field and enqueues a push for that date with that one touched field", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, rate_plan_id: "rp-1", date: "2026-11-21", rate: 333, min_stay_arrival: 2, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    const result = await clearRateOverrideField(db as unknown as SupabaseClient, orgId, "ov-1", "rate");

    expect(result.ok).toBe(true);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ rate: null, min_stay_arrival: 2 });
    expect(enqueueRestrictions).toHaveBeenCalledWith(
      db, orgId, "2026-11-21", "2026-11-22", ["rp-1"], ["rate"]
    );
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run src/lib/rate-overrides.test.ts`
Expected: FAIL — `applyRateOverrides` still expects `roomTypeIds`/queries
`room_types`, `enqueueRestrictions` call signature doesn't match.

- [ ] **Step 3: Rewrite `src/lib/rate-overrides.ts`**

Replace the full file contents:

```ts
// Business logic behind the "Rates & Restrictions" bulk-edit form: writes
// per-date overrides for one or more rate plans over a date range, merging
// only the fields the caller actually touched, then enqueues a single
// Channex restrictions push covering the whole scope of the edit, tagged
// with which fields were touched (so the push can be sparse).

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO } from "./channels/channex-rates";
import { enqueueRestrictions } from "./channels/channex-outbox";

export interface RateOverrideFields {
  rate?: number;
  min_stay_arrival?: number;
  min_stay_through?: number;
  max_stay?: number;
  stop_sell?: boolean;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
}

export interface ApplyRateOverridesInput {
  ratePlanIds: string[];
  dateFrom: string; // inclusive
  dateTo: string; // inclusive
  fields: RateOverrideFields;
}

export interface ApplyRateOverridesResult {
  ok: boolean;
  rowsWritten: number;
  skippedRatePlanIds: string[];
  error?: string;
}

export const OVERRIDE_FIELD_KEYS = [
  "rate",
  "min_stay_arrival",
  "min_stay_through",
  "max_stay",
  "stop_sell",
  "closed_to_arrival",
  "closed_to_departure",
] as const;
export type OverrideFieldKey = (typeof OVERRIDE_FIELD_KEYS)[number];

function dateRangeInclusive(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) dates.push(d);
  return dates;
}

export async function applyRateOverrides(
  supabase: SupabaseClient,
  orgId: string,
  input: ApplyRateOverridesInput
): Promise<ApplyRateOverridesResult> {
  const { ratePlanIds, dateFrom, dateTo, fields } = input;
  const touchedKeys = OVERRIDE_FIELD_KEYS.filter((k) => fields[k] !== undefined);
  if (ratePlanIds.length === 0 || touchedKeys.length === 0 || dateTo < dateFrom) {
    return { ok: false, rowsWritten: 0, skippedRatePlanIds: [], error: "invalid input" };
  }

  // Only touch rate plans that actually belong to this org.
  const { data: owned } = await supabase
    .from("rate_plans")
    .select("id")
    .eq("organization_id", orgId)
    .in("id", ratePlanIds);
  const ownedIds = new Set(((owned as { id: string }[]) ?? []).map((r) => r.id));
  const validRatePlanIds = ratePlanIds.filter((id) => ownedIds.has(id));
  const skippedRatePlanIds = ratePlanIds.filter((id) => !ownedIds.has(id));
  if (validRatePlanIds.length === 0) {
    return { ok: false, rowsWritten: 0, skippedRatePlanIds: ratePlanIds, error: "no matching rate plans" };
  }

  const dates = dateRangeInclusive(dateFrom, dateTo);

  // Partial upsert: each row carries only the primary-key columns plus the
  // fields actually touched by this edit. PostgREST upsert only SETs the
  // columns present in the payload on conflict, so untouched columns on an
  // existing row are left alone.
  const upsertRows: Record<string, unknown>[] = [];
  for (const ratePlanId of validRatePlanIds) {
    for (const date of dates) {
      const row: Record<string, unknown> = {
        organization_id: orgId,
        rate_plan_id: ratePlanId,
        date,
        updated_at: new Date().toISOString(),
      };
      for (const key of touchedKeys) row[key] = fields[key];
      upsertRows.push(row);
    }
  }

  const { error } = await supabase
    .from("room_type_rate_overrides")
    .upsert(upsertRows, { onConflict: "rate_plan_id,date" });
  if (error) return { ok: false, rowsWritten: 0, skippedRatePlanIds, error: error.message };

  await enqueueRestrictions(supabase, orgId, dateFrom, addDaysISO(dateTo, 1), validRatePlanIds, touchedKeys as string[]);

  return { ok: true, rowsWritten: upsertRows.length, skippedRatePlanIds };
}

export async function clearRateOverrideField(
  supabase: SupabaseClient,
  orgId: string,
  overrideId: string,
  field: OverrideFieldKey
): Promise<{ ok: boolean; error?: string }> {
  const { data: row, error: fetchError } = await supabase
    .from("room_type_rate_overrides")
    .select("id, rate_plan_id, date")
    .eq("id", overrideId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (fetchError || !row) return { ok: false, error: "not found" };

  const { error } = await supabase
    .from("room_type_rate_overrides")
    .update({ [field]: null, updated_at: new Date().toISOString() })
    .eq("id", overrideId);
  if (error) return { ok: false, error: error.message };

  const date = (row as any).date;
  await enqueueRestrictions(supabase, orgId, date, addDaysISO(date, 1), [(row as any).rate_plan_id], [field]);
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests, confirm failure mode changes to `enqueueRestrictions` signature**

Run: `npx vitest run src/lib/rate-overrides.test.ts`
Expected: still FAIL at this point (Task 4 hasn't updated
`enqueueRestrictions`'s real signature yet) — that's fine, this task's
tests mock `enqueueRestrictions` entirely, so the failure should actually
be gone already. If it still fails, re-check the mock's call assertions
match exactly.
Expected after this step: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-overrides.ts src/lib/rate-overrides.test.ts
git commit -m "feat: rate-overrides.ts operates on rate plans, threads touched fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `lib/validations/rate-override.ts` — rename

**Files:**
- Modify: `src/lib/validations/rate-override.ts`

- [ ] **Step 1: Edit the schema**

In `src/lib/validations/rate-override.ts`, change:

```ts
room_type_ids: yup.array().of(yup.string().required()).min(1, "Select at least one room type").required(),
```

to:

```ts
rate_plan_ids: yup.array().of(yup.string().required()).min(1, "Select at least one rate plan").required(),
```

No other changes needed in this file — `OVERRIDE_FIELD_KEYS` import and the
rest of the shape are unaffected.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `src/app/api/room-types/rate-overrides/route.ts`
(still references `body.room_type_ids`) — fixed in Task 7. Confirm no
errors in this file itself.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/rate-override.ts
git commit -m "feat: rename rate-override validation field to rate_plan_ids

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `lib/channels/channex-outbox.ts` — touched-fields tracking

**Files:**
- Modify: `src/lib/channels/channex-outbox.ts`
- Modify: `src/lib/channels/channex-outbox.test.ts`

- [ ] **Step 1: Add the new test cases**

Add to `src/lib/channels/channex-outbox.test.ts`, inside the existing
`describe("enqueueAvailability / enqueueRestrictions", ...)` block:

```ts
  it("stores touched_fields on the inserted row when enqueueRestrictions is given one", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    await enqueueRestrictions(db as unknown as SupabaseClient, orgId, "2026-07-01", "2026-07-02", ["rp-1"], ["rate", "stop_sell"]);
    expect(db.tables.channex_outbox[0]).toMatchObject({ touched_fields: ["rate", "stop_sell"] });
  });

  it("leaves touched_fields null when enqueueRestrictions isn't given any", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    await enqueueRestrictions(db as unknown as SupabaseClient, orgId, "2026-07-01", "2026-07-02", ["rp-1"]);
    expect(db.tables.channex_outbox[0].touched_fields).toBeUndefined();
  });
```

Add a new `describe` block for the grouping behavior, after the existing
`describe("processOutbox", ...)` block closes:

```ts
describe("processOutbox — touched_fields union on coalesced groups", () => {
  beforeEach(() => {
    vi.mocked(pushRatesForOrg).mockReset().mockResolvedValue({ ok: true, propertyId: "p", ratePlansPushed: 1, entries: 1 });
  });

  function restrictionsRow(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: overrides.id ?? "row-1",
      organization_id: orgId,
      kind: "restrictions",
      from_date: "2026-07-01",
      to_date: "2026-07-02",
      room_type_ids: ["rp-1"],
      status: "pending",
      attempts: 0,
      next_attempt_at: null,
      created_at: "2026-01-01T00:00:00Z",
      touched_fields: null,
      ...overrides,
    };
  }

  it("passes a single group's touched_fields through unchanged", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [restrictionsRow({ touched_fields: ["rate"] })]);

    await processOutbox(db as unknown as SupabaseClient);

    const [, , opts] = vi.mocked(pushRatesForOrg).mock.calls[0];
    expect(opts?.touchedFields).toEqual(new Set(["rate"]));
  });

  it("unions touched_fields across coalesced rows in the same group", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [
      restrictionsRow({ id: "a", touched_fields: ["rate"] }),
      restrictionsRow({ id: "b", touched_fields: ["stop_sell"] }),
    ]);

    await processOutbox(db as unknown as SupabaseClient);

    const [, , opts] = vi.mocked(pushRatesForOrg).mock.calls[0];
    expect(opts?.touchedFields).toEqual(new Set(["rate", "stop_sell"]));
  });

  it("falls back to no filter (full snapshot) if any coalesced row has touched_fields: null", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [
      restrictionsRow({ id: "a", touched_fields: ["rate"] }),
      restrictionsRow({ id: "b", touched_fields: null }),
    ]);

    await processOutbox(db as unknown as SupabaseClient);

    const [, , opts] = vi.mocked(pushRatesForOrg).mock.calls[0];
    expect(opts?.touchedFields).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run src/lib/channels/channex-outbox.test.ts`
Expected: FAIL — `enqueueRestrictions` doesn't accept a 6th argument yet,
`processOutbox` doesn't pass `touchedFields` to `pushRatesForOrg`.

- [ ] **Step 3: Update `enqueueRestrictions` and `processOutbox`**

In `src/lib/channels/channex-outbox.ts`:

Change the `enqueue` helper and `enqueueRestrictions` export:

```ts
async function enqueue(
  supabase: SupabaseClient,
  orgId: string,
  kind: OutboxKind,
  from?: string,
  to?: string,
  roomTypeIds?: string[],
  touchedFields?: string[]
): Promise<void> {
  if (!from || !to) return;
  // Skip orgs that aren't connected to Channex — no junk rows for iCal-only or
  // unprovisioned tenants.
  if (!(await isProvisioned(supabase, orgId))) return;
  await supabase.from("channex_outbox").insert({
    organization_id: orgId,
    kind,
    from_date: from,
    to_date: to,
    room_type_ids: roomTypeIds && roomTypeIds.length ? roomTypeIds : null,
    ...(touchedFields && touchedFields.length ? { touched_fields: touchedFields } : {}),
  });
}

/** Enqueue an availability delta (e.g. after a booking create/cancel/move). */
export function enqueueAvailability(supabase: SupabaseClient, orgId: string, from?: string, to?: string, roomTypeIds?: string[]) {
  return enqueue(supabase, orgId, "availability", from, to, roomTypeIds);
}

/** Enqueue a rate/restriction delta (e.g. after a base_price change). roomTypeIds here holds rate_plan ids. */
export function enqueueRestrictions(supabase: SupabaseClient, orgId: string, from?: string, to?: string, roomTypeIds?: string[], touchedFields?: string[]) {
  return enqueue(supabase, orgId, "restrictions", from, to, roomTypeIds, touchedFields);
}
```

Note: the outbox row's `room_type_ids` column keeps its existing name (no
migration needed) but now holds rate-plan ids for `kind='restrictions'`
rows, and still holds room-type ids for `kind='availability'` rows — same
column, different meaning per `kind`, matching how the column was already
untyped/dual-purpose before this feature (it was never actually
"room type ids" at the SQL level, just a generic `text[]` scope filter).

Update the `Group` interface and `processOutbox`:

```ts
interface Group {
  orgId: string;
  kind: OutboxKind;
  from: string;
  to: string;
  rtIds: Set<string> | null; // null = all provisioned room types/rate plans
  ids: string[];
  attempts: number;
  touchedFields: Set<string> | null; // null = unknown row seen, or any row's touched_fields was null -> full snapshot
  touchedFieldsKnown: boolean; // becomes false the moment we need a fallback
}
```

In the grouping loop, where a new `Group` is created and where an existing
one is widened, add touched-fields tracking:

```ts
  const rows = (due as any[]) ?? [];
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const key = `${row.organization_id}:${row.kind}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        orgId: row.organization_id,
        kind: row.kind,
        from: row.from_date,
        to: row.to_date,
        rtIds: row.room_type_ids ? new Set<string>(row.room_type_ids) : null,
        ids: [],
        attempts: 0,
        touchedFields: row.touched_fields ? new Set<string>(row.touched_fields) : null,
        touchedFieldsKnown: !!row.touched_fields,
      };
      groups.set(key, g);
    } else {
      if (row.from_date < g.from) g.from = row.from_date;
      if (row.to_date > g.to) g.to = row.to_date;
      // A "null = all room types" row widens the group to all.
      if (g.rtIds === null || row.room_type_ids === null) g.rtIds = null;
      else for (const id of row.room_type_ids) g.rtIds.add(id);

      if (!row.touched_fields) {
        g.touchedFields = null;
        g.touchedFieldsKnown = false;
      } else if (g.touchedFieldsKnown) {
        for (const f of row.touched_fields) g.touchedFields!.add(f);
      }
    }
    g.ids.push(row.id);
    g.attempts = Math.max(g.attempts, row.attempts ?? 0);
  }
```

Where `pushRatesForOrg` is called inside the push loop, pass `touchedFields`:

```ts
      if (g.kind === "availability") {
        await pushAvailabilityForOrg(supabase, g.orgId, { from: g.from, to: g.to, roomTypeLocalIds: rtIds });
      } else {
        await pushRatesForOrg(supabase, g.orgId, {
          from: g.from,
          to: g.to,
          roomTypeLocalIds: rtIds,
          // channex-outbox.ts stores touched_fields as opaque strings — it has
          // no reason to import rate-overrides.ts's OverrideFieldKey union just
          // for this field's type. Cast at this one call site instead, where
          // we hand off into the module that actually defines and checks
          // against that literal union.
          touchedFields: g.touchedFieldsKnown && g.touchedFields
            ? (g.touchedFields as unknown as Set<import("../rate-overrides").OverrideFieldKey>)
            : undefined,
        });
      }
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/lib/channels/channex-outbox.test.ts`
Expected: PASS, all tests including the 5 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/channex-outbox.ts src/lib/channels/channex-outbox.test.ts
git commit -m "feat: track touched_fields through the outbox for sparse restriction pushes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `lib/channels/channex-rates.ts` — rate-plan grouping + sparse payloads

**Files:**
- Modify: `src/lib/channels/channex-rates.ts`
- Modify: `src/lib/channels/channex-rates.test.ts`

- [ ] **Step 1: Rewrite the test file**

Replace the full contents of `src/lib/channels/channex-rates.test.ts`:

```ts
// src/lib/channels/channex-rates.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./channex")>();
  return {
    ...actual,
    channex: { ...actual.channex, pushRestrictions: vi.fn().mockResolvedValue(undefined) },
  };
});

import { channex } from "./channex";
import { pushRatesForOrg } from "./channex-rates";

const orgId = "org-1";

function seedProvisioned(db: FakeSupabaseClient, ratePlans: any[]) {
  db.seed("channel_provider_links", [
    { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
    ...ratePlans.map((rp) => ({
      kind: "rate_plan",
      local_id: rp.id,
      channex_id: `channex-${rp.id}`,
      organization_id: orgId,
    })),
  ]);
  db.seed("rate_plans", ratePlans.map((rp) => ({ ...rp, organization_id: orgId })));
}

describe("pushRatesForOrg", () => {
  beforeEach(() => {
    vi.mocked(channex.pushRestrictions).mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("skips a non-provisioned org", async () => {
    const db = new FakeSupabaseClient();
    const result = await pushRatesForOrg(db as unknown as SupabaseClient, orgId);
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe("org not provisioned");
    expect(channex.pushRestrictions).not.toHaveBeenCalled();
  });

  it("pushes rate in minor units plus every restriction field", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      {
        id: "rp-1",
        room_type_id: "rt-1",
        base_price: "25.00",
        stop_sell: false,
        closed_to_arrival: true,
        closed_to_departure: false,
        min_stay_arrival: 2,
        min_stay_through: null,
      },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-03" });

    expect(channex.pushRestrictions).toHaveBeenCalledTimes(1);
    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toEqual([
      {
        property_id: "prop-1",
        rate_plan_id: "channex-rp-1",
        date_from: "2026-07-01",
        date_to: "2026-07-02",
        rate: 2500,
        stop_sell: false,
        closed_to_arrival: true,
        closed_to_departure: false,
        min_stay_arrival: 2,
      },
    ]);
  });

  it("omits null min-stay fields rather than sending null", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: "25.00", stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).not.toHaveProperty("min_stay_arrival");
    expect(values[0]).not.toHaveProperty("min_stay_through");
  });

  it("only pushes rate plans that have a mapped Channex id", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      { kind: "rate_plan", local_id: "rp-mapped", channex_id: "channex-mapped", organization_id: orgId },
    ]);
    db.seed("rate_plans", [
      { id: "rp-mapped", organization_id: orgId, room_type_id: "rt-1", base_price: 10, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null },
      { id: "rp-unmapped", organization_id: orgId, room_type_id: "rt-1", base_price: 10, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toHaveLength(1);
    expect(values[0].rate_plan_id).toBe("channex-mapped");
  });

  it("an override's rate wins over the rate plan's base_price for its date; other dates fall back", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, rate_plan_id: "rp-1", date: "2026-07-02", rate: 333, min_stay_arrival: null, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-04" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toEqual([
      { property_id: "prop-1", rate_plan_id: "channex-rp-1", date_from: "2026-07-01", date_to: "2026-07-01", rate: 10000, stop_sell: false, closed_to_arrival: false, closed_to_departure: false },
      { property_id: "prop-1", rate_plan_id: "channex-rp-1", date_from: "2026-07-02", date_to: "2026-07-02", rate: 33300, stop_sell: false, closed_to_arrival: false, closed_to_departure: false },
      { property_id: "prop-1", rate_plan_id: "channex-rp-1", date_from: "2026-07-03", date_to: "2026-07-03", rate: 10000, stop_sell: false, closed_to_arrival: false, closed_to_departure: false },
    ]);
  });

  it("compresses consecutive identical nights into one entry per rate plan", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
      { id: "rp-2", room_type_id: "rt-2", base_price: 200, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-11" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toHaveLength(2);
    expect(values.find((v: any) => v.rate_plan_id === "channex-rp-1")).toMatchObject({ date_from: "2026-07-01", date_to: "2026-07-10", rate: 10000 });
    expect(values.find((v: any) => v.rate_plan_id === "channex-rp-2")).toMatchObject({ date_from: "2026-07-01", date_to: "2026-07-10", rate: 20000 });
  });

  it("two rate plans on the same room type push independently with their own prices", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-bar", room_type_id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
      { id: "rp-bnb", room_type_id: "rt-1", base_price: 120, stop_sell: false, closed_to_arrival: true, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toHaveLength(2);
    expect(values.find((v: any) => v.rate_plan_id === "channex-rp-bar")).toMatchObject({ rate: 10000, closed_to_arrival: false });
    expect(values.find((v: any) => v.rate_plan_id === "channex-rp-bnb")).toMatchObject({ rate: 12000, closed_to_arrival: true });
  });

  it("with touchedFields, includes only those fields even though others have effective values", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: 100, stop_sell: true, closed_to_arrival: true, closed_to_departure: true, min_stay_arrival: 3, min_stay_through: null, max_stay: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, {
      from: "2026-07-01", to: "2026-07-02",
      touchedFields: new Set(["rate"]),
    });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).toEqual({
      property_id: "prop-1", rate_plan_id: "channex-rp-1",
      date_from: "2026-07-01", date_to: "2026-07-01",
      rate: 10000,
    });
  });

  it("with touchedFields, omits min/max stay even when a value is set, if not in the touched set", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: 5, min_stay_through: null, max_stay: 14 },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, {
      from: "2026-07-01", to: "2026-07-02",
      touchedFields: new Set(["stop_sell"]),
    });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).toEqual({
      property_id: "prop-1", rate_plan_id: "channex-rp-1",
      date_from: "2026-07-01", date_to: "2026-07-01",
      stop_sell: false,
    });
  });

  it("without touchedFields (full sync), behavior is unchanged — every field included", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rp-1", room_type_id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).toMatchObject({ rate: 10000, stop_sell: false, closed_to_arrival: false, closed_to_departure: false });
  });
});
```

Note: the old `"pushes the same effective values to every rate plan mapped
to a room type"` test is gone — that was the old fan-out behavior (one
room type, many Channex rate plans, same values on each). It's replaced by
`"two rate plans on the same room type push independently with their own
prices"`, which is the actual feature this whole plan builds.

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run src/lib/channels/channex-rates.test.ts`
Expected: FAIL — `pushRatesForOrg` still reads `room_types`/groups by
room-type fan-out, `toRestrictionFields` doesn't accept `touchedFields`.

- [ ] **Step 3: Rewrite `src/lib/channels/channex-rates.ts`**

Replace the full file contents:

```ts
// Channex rate + restriction push. Reads each rate plan's standing defaults
// (rate, stop_sell, closed_to_arrival/departure, min_stay_arrival/through,
// max_stay) plus any per-date overrides in room_type_rate_overrides, computes
// the effective value per night, and run-length compresses consecutive
// nights with identical values into the fewest possible /restrictions
// entries. /restrictions is a partial update: a field omitted from an entry
// leaves whatever Channex already has for that date untouched rather than
// clearing it. When `touchedFields` is given (outbox-driven incremental
// pushes), only those fields are ever included — this is what makes an
// edit's Channex payload a sparse delta instead of a full snapshot. Omitted
// (full-sync callers), every field is included, same as before this mattered.
// Each local rate plan maps to exactly one Channex rate plan. Never sends
// past dates.

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex, toChannexMinor, type RestrictionValue } from "./channex";
import type { OverrideFieldKey } from "../rate-overrides";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface PushRatesOptions {
  from?: string; // inclusive, clamped to today
  to?: string; // exclusive (checkout-style); nights are [from, to)
  horizonDays?: number; // default 500 (certification full-sync horizon)
  roomTypeLocalIds?: string[]; // rate_plans.id values, despite the name (kept for outbox call-site symmetry with availability)
  touchedFields?: Set<OverrideFieldKey>; // omitted = every field (full sync)
}

export interface PushRatesResult {
  ok: boolean;
  propertyId: string | null;
  ratePlansPushed: number;
  entries: number;
  skipped?: string;
  channexTaskIds?: string[];
}

interface EffectiveValues {
  rate: number; // major units
  stop_sell: boolean;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  min_stay_arrival: number | null;
  min_stay_through: number | null;
  max_stay: number | null;
}

const COMPARE_KEYS = [
  "rate", "stop_sell", "closed_to_arrival", "closed_to_departure",
  "min_stay_arrival", "min_stay_through", "max_stay",
] as const satisfies readonly (keyof EffectiveValues)[];

function sameValues(a: EffectiveValues, b: EffectiveValues, touchedFields?: Set<OverrideFieldKey>): boolean {
  for (const key of COMPARE_KEYS) {
    if (touchedFields && !touchedFields.has(key)) continue;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

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

export async function pushRatesForOrg(
  supabase: SupabaseClient,
  orgId: string,
  opts: PushRatesOptions = {}
): Promise<PushRatesResult> {
  const { data: links } = await supabase
    .from("channel_provider_links")
    .select("kind, local_id, channex_id")
    .eq("organization_id", orgId)
    .in("kind", ["property", "rate_plan"]);
  const rows = (links as { kind: string; local_id: string; channex_id: string }[]) ?? [];
  const property = rows.find((r) => r.kind === "property");
  if (!property) return { ok: false, propertyId: null, ratePlansPushed: 0, entries: 0, skipped: "org not provisioned" };
  const propertyId = property.channex_id;

  // local rate_plans.id -> its one mapped Channex rate_plan_id.
  const rpMap = new Map<string, string>();
  for (const r of rows) {
    if (r.kind !== "rate_plan") continue;
    rpMap.set(r.local_id, r.channex_id);
  }
  if (rpMap.size === 0) return { ok: false, propertyId, ratePlansPushed: 0, entries: 0, skipped: "no mapped rate plans" };

  const from = opts.from && opts.from > todayISO() ? opts.from : todayISO();
  const toExclusive = opts.to ?? addDaysISO(from, opts.horizonDays ?? 500);
  const lastNight = addDaysISO(toExclusive, -1);
  if (lastNight < from) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "empty window" };

  const { data: ratePlans } = await supabase
    .from("rate_plans")
    .select("id, base_price, stop_sell, closed_to_arrival, closed_to_departure, min_stay_arrival, min_stay_through, max_stay")
    .eq("organization_id", orgId);

  const filter = opts.roomTypeLocalIds ? new Set(opts.roomTypeLocalIds) : null;
  const ratePlanRows = ((ratePlans as any[]) ?? []).filter((rp) => rpMap.has(rp.id) && (!filter || filter.has(rp.id)));
  if (ratePlanRows.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  const { data: overrides } = await supabase
    .from("room_type_rate_overrides")
    .select("rate_plan_id, date, rate, min_stay_arrival, min_stay_through, max_stay, stop_sell, closed_to_arrival, closed_to_departure")
    .eq("organization_id", orgId)
    .in("rate_plan_id", ratePlanRows.map((rp) => rp.id))
    .gte("date", from)
    .lte("date", lastNight);

  const overrideMap = new Map<string, any>(); // `${rate_plan_id}:${date}` -> row
  for (const o of (overrides as any[]) ?? []) overrideMap.set(`${o.rate_plan_id}:${o.date}`, o);

  const values: RestrictionValue[] = [];
  const touchedFields = opts.touchedFields;

  for (const rp of ratePlanRows) {
    let runStart: string | null = null;
    let runValues: EffectiveValues | null = null;

    const flush = (endExclusive: string) => {
      if (runStart == null || runValues == null) return;
      const fields = toRestrictionFields(runValues, touchedFields);
      values.push({
        property_id: propertyId,
        rate_plan_id: rpMap.get(rp.id)!,
        date_from: runStart,
        date_to: addDaysISO(endExclusive, -1),
        ...fields,
      });
    };

    let cursor = from;
    while (cursor <= lastNight) {
      const o = overrideMap.get(`${rp.id}:${cursor}`);
      const effective: EffectiveValues = {
        rate: o?.rate ?? rp.base_price ?? 0,
        stop_sell: o?.stop_sell ?? rp.stop_sell ?? false,
        closed_to_arrival: o?.closed_to_arrival ?? rp.closed_to_arrival ?? false,
        closed_to_departure: o?.closed_to_departure ?? rp.closed_to_departure ?? false,
        min_stay_arrival: o?.min_stay_arrival ?? rp.min_stay_arrival ?? null,
        min_stay_through: o?.min_stay_through ?? rp.min_stay_through ?? null,
        max_stay: o?.max_stay ?? rp.max_stay ?? null,
      };

      if (runValues && sameValues(runValues, effective, touchedFields)) {
        cursor = addDaysISO(cursor, 1);
        continue;
      }
      flush(cursor);
      runStart = cursor;
      runValues = effective;
      cursor = addDaysISO(cursor, 1);
    }
    flush(cursor);
  }
  const ratePlansPushed = ratePlanRows.length;

  if (values.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  const response = await channex.pushRestrictions(values);
  const channexTaskIds = Array.isArray(response)
    ? response.map((r: any) => r?.id).filter((id: unknown): id is string => typeof id === "string")
    : undefined;
  return { ok: true, propertyId, ratePlansPushed, entries: values.length, channexTaskIds };
}
```

Note the `import type { OverrideFieldKey } from "../rate-overrides"` — this
is a type-only import (erased at compile time), so it does not create a
runtime circular dependency even though `rate-overrides.ts` also imports
from `channex-outbox.ts`, which this file's sibling imports from too.

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/lib/channels/channex-rates.test.ts`
Expected: PASS, all 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/channex-rates.ts src/lib/channels/channex-rates.test.ts
git commit -m "feat: pushRatesForOrg groups by rate plan, supports sparse touched-field payloads

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `lib/channels/channex-provision.ts` — provision rate plans

**Files:**
- Modify: `src/lib/channels/channex-provision.ts`
- Create: `src/lib/channels/channex-provision.test.ts`

- [ ] **Step 1: Write the new test file**

```ts
// src/lib/channels/channex-provision.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./channex")>();
  return {
    ...actual,
    channex: {
      ...actual.channex,
      createProperty: vi.fn().mockResolvedValue({ id: "prop-1" }),
      updateProperty: vi.fn().mockResolvedValue({ id: "prop-1" }),
      createRoomType: vi.fn().mockResolvedValue({ id: "channex-rt-1" }),
      updateRoomType: vi.fn().mockResolvedValue({ id: "channex-rt-1" }),
      createRatePlan: vi.fn().mockImplementation((attrs: any) => Promise.resolve({ id: `channex-${attrs.title}` })),
      updateRatePlan: vi.fn().mockImplementation((id: string) => Promise.resolve({ id })),
    },
  };
});

import { channex } from "./channex";
import { provisionOrg } from "./channex-provision";

const orgId = "org-1";

function seedOrgAndRoom(db: FakeSupabaseClient) {
  db.seed("organizations", [{ id: orgId, name: "Test Hotel", currency: "USD", timezone: "UTC" }]);
  db.seed("room_types", [{ id: "rt-1", organization_id: orgId, name: "Twin Room", type: "private", capacity: 2, base_price: 100 }]);
  db.seed("rooms", [{ id: "room-1", organization_id: orgId, room_type_id: "rt-1" }]);
}

describe("provisionOrg — rate plans", () => {
  beforeEach(() => {
    vi.mocked(channex.createRatePlan).mockClear();
    vi.mocked(channex.updateRatePlan).mockClear();
  });

  it("creates one Channex rate plan per local rate_plans row, not per room type", async () => {
    const db = new FakeSupabaseClient();
    seedOrgAndRoom(db);
    db.seed("rate_plans", [
      { id: "rp-bar", organization_id: orgId, room_type_id: "rt-1", name: "Best Available Rate", base_price: 100, is_default: true },
      { id: "rp-bnb", organization_id: orgId, room_type_id: "rt-1", name: "Bed & Breakfast", base_price: 120, is_default: false },
    ]);

    const result = await provisionOrg(db as unknown as SupabaseClient, orgId);

    expect(channex.createRatePlan).toHaveBeenCalledTimes(2);
    expect(channex.createRatePlan).toHaveBeenCalledWith(expect.objectContaining({ title: "Best Available Rate" }));
    expect(channex.createRatePlan).toHaveBeenCalledWith(expect.objectContaining({ title: "Bed & Breakfast" }));
    expect(result.rows.filter((r) => r.kind === "rate_plan")).toHaveLength(2);

    const links = db.tables.channel_provider_links.filter((l: any) => l.kind === "rate_plan");
    expect(links.map((l: any) => l.local_id).sort()).toEqual(["rp-bar", "rp-bnb"]);
  });

  it("uses the rate plan's own base_price, not the room type's", async () => {
    const db = new FakeSupabaseClient();
    seedOrgAndRoom(db);
    db.seed("rate_plans", [
      { id: "rp-1", organization_id: orgId, room_type_id: "rt-1", name: "Standard Rate", base_price: 150, is_default: true },
    ]);

    await provisionOrg(db as unknown as SupabaseClient, orgId);

    const call = vi.mocked(channex.createRatePlan).mock.calls[0][0];
    expect(call.options?.[0].rate).toBe(15000); // minor units
  });

  it("re-runs idempotently — an already-linked rate plan is updated, not re-created", async () => {
    const db = new FakeSupabaseClient();
    seedOrgAndRoom(db);
    db.seed("rate_plans", [
      { id: "rp-1", organization_id: orgId, room_type_id: "rt-1", name: "Standard Rate", base_price: 100, is_default: true },
    ]);
    db.seed("channel_provider_links", [
      { organization_id: orgId, kind: "property", local_id: orgId, channex_id: "prop-1" },
      { organization_id: orgId, kind: "room_type", local_id: "rt-1", channex_id: "channex-rt-1" },
      { organization_id: orgId, kind: "rate_plan", local_id: "rp-1", channex_id: "channex-existing" },
    ]);

    await provisionOrg(db as unknown as SupabaseClient, orgId);

    expect(channex.createRatePlan).not.toHaveBeenCalled();
    expect(channex.updateRatePlan).toHaveBeenCalledWith("channex-existing", expect.anything());
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run src/lib/channels/channex-provision.test.ts`
Expected: FAIL — `provisionOrg` still synthesizes one `"Standard Rate"` per
room type from `room_types.base_price`.

- [ ] **Step 3: Update `provisionOrg` in `src/lib/channels/channex-provision.ts`**

Replace the room-type/rate-plan loop (step "3 + 4" in the existing file)
with one that provisions room types (unchanged — still one per
`room_types` row) and then, separately, loops over `rate_plans`:

```ts
  // 3. Room types (physical attributes only).
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, room_type_id")
    .eq("organization_id", orgId);

  const { data: beds } = await supabase
    .from("beds")
    .select("id, room_id, is_active, rooms(room_type_id)")
    .eq("organization_id", orgId);

  // Count sellable units per room type.
  const roomCount = new Map<string, number>();
  for (const r of (rooms as { id: string; room_type_id: string }[]) ?? []) {
    roomCount.set(r.room_type_id, (roomCount.get(r.room_type_id) ?? 0) + 1);
  }
  const bedCount = new Map<string, number>();
  for (const b of (beds as any[]) ?? []) {
    if (b.is_active === false) continue;
    const rtId = b.rooms?.room_type_id;
    if (rtId) bedCount.set(rtId, (bedCount.get(rtId) ?? 0) + 1);
  }

  const channexRoomTypeIds = new Map<string, string>(); // local room_type id -> channex id, for rate plans below

  for (const rt of (roomTypes as { id: string; name: string; type: string; capacity: number }[]) ?? []) {
    const isDorm = rt.type === "dorm";
    const capacity = Math.max(1, rt.capacity || 1);
    const countOfRooms = isDorm ? (bedCount.get(rt.id) ?? 0) : (roomCount.get(rt.id) ?? 0);
    const occAdults = isDorm ? 1 : capacity;

    if (countOfRooms < 1) {
      rows.push({ name: rt.name, kind: "room_type", action: "skipped", warning: isDorm ? "no active beds" : "no rooms" });
      continue;
    }

    try {
      const existing = await getLink(supabase, orgId, "room_type", rt.id);
      const attrs = {
        property_id: propId,
        title: rt.name,
        count_of_rooms: countOfRooms,
        occ_adults: occAdults,
        occ_children: 0,
        occ_infants: 0,
        default_occupancy: occAdults,
        room_kind: (isDorm ? "dorm" : "room") as "dorm" | "room",
      };
      const res = existing ? await channex.updateRoomType(existing, attrs) : await channex.createRoomType(attrs);
      channexRoomTypeIds.set(rt.id, res.id);
      await saveLink(supabase, orgId, "room_type", rt.id, res.id);
      rows.push({ name: rt.name, kind: "room_type", action: existing ? "updated" : "created", channexId: res.id });
    } catch (err) {
      rows.push({ name: rt.name, kind: "room_type", action: "error", warning: errMsg(err) });
    }
  }

  // 4. Rate plans — one Channex rate plan per local rate_plans row.
  const { data: ratePlans } = await supabase
    .from("rate_plans")
    .select("id, room_type_id, name, base_price")
    .eq("organization_id", orgId);

  for (const rp of (ratePlans as { id: string; room_type_id: string; name: string; base_price: number }[]) ?? []) {
    const channexRoomTypeId = channexRoomTypeIds.get(rp.room_type_id);
    if (!channexRoomTypeId) {
      rows.push({ name: rp.name, kind: "rate_plan", action: "skipped", warning: "room type not provisioned" });
      continue;
    }
    const roomType = ((roomTypes as any[]) ?? []).find((rt) => rt.id === rp.room_type_id);
    const isDorm = roomType?.type === "dorm";
    const occAdults = isDorm ? 1 : Math.max(1, roomType?.capacity || 1);

    try {
      const existing = await getLink(supabase, orgId, "rate_plan", rp.id);
      const attrs = {
        property_id: propId,
        room_type_id: channexRoomTypeId,
        title: rp.name,
        currency,
        sell_mode: "per_room" as const,
        rate_mode: "manual" as const,
        options: [{ occupancy: occAdults, is_primary: true, rate: toChannexMinor(rp.base_price ?? 0) }],
      };
      const res = existing ? await channex.updateRatePlan(existing, attrs) : await channex.createRatePlan(attrs);
      await saveLink(supabase, orgId, "rate_plan", rp.id, res.id);
      rows.push({ name: rp.name, kind: "rate_plan", action: existing ? "updated" : "created", channexId: res.id });
    } catch (err) {
      rows.push({ name: rp.name, kind: "rate_plan", action: "error", warning: errMsg(err) });
    }
  }
```

This replaces the old single loop (which fetched `room_types` including
`base_price` and created one `"Standard Rate"` per room type inline).
Remove `base_price` from the `roomTypes` select at the top of the function
(step 1 in the existing file) since it's no longer read there:

```ts
  const { data: roomTypes } = await supabase
    .from("room_types")
    .select("id, name, type, capacity")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/lib/channels/channex-provision.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npx vitest run`
Expected: PASS. (No existing `channex-provision` tests existed before this
task, so no prior-test regressions to check there — but `channex.test.ts`,
if it references `provisionOrg`, should still pass; it doesn't per the
file list already read in this session.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/channels/channex-provision.ts src/lib/channels/channex-provision.test.ts
git commit -m "feat: provisionOrg creates one Channex rate plan per local rate plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Rate-overrides API routes — rename to `rate_plan_ids`

**Files:**
- Modify: `src/app/api/room-types/rate-overrides/route.ts`
- Modify: `src/app/api/room-types/rate-overrides/route.test.ts`

- [ ] **Step 1: Update the test file**

In `src/app/api/room-types/rate-overrides/route.test.ts`, replace every
`room_type_ids` with `rate_plan_ids` in request bodies, and update the
`applyRateOverrides` mock assertion:

```ts
  it("calls applyRateOverrides with only the touched fields for a manager", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    vi.mocked(applyRateOverrides).mockResolvedValue({ ok: true, rowsWritten: 2, skippedRatePlanIds: [] });

    const res = await POST(jsonRequest({ rate_plan_ids: ["rp-1"], date_from: "2026-11-01", date_to: "2026-11-02", rate: 333 }));

    expect(res.status).toBe(200);
    expect(applyRateOverrides).toHaveBeenCalledWith(expect.anything(), "org-1", {
      ratePlanIds: ["rp-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-02",
      fields: { rate: 333 },
    });
  });
```

Apply the same `room_type_ids` → `rate_plan_ids` rename to the other test
bodies in that file (`returns 403 for a staff member`, `returns 400 when
the payload fails validation`).

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run src/app/api/room-types/rate-overrides/route.test.ts`
Expected: FAIL — the route still reads `body.room_type_ids`.

- [ ] **Step 3: Update the route**

In `src/app/api/room-types/rate-overrides/route.ts`, in the `POST` handler:

```ts
    const result = await applyRateOverrides(supabase, membership.organizationId, {
      ratePlanIds: body.rate_plan_ids,
      dateFrom: body.date_from,
      dateTo: body.date_to,
      fields,
    });

    if (!result.ok) return Response.json({ error: result.error || "Failed to apply overrides" }, { status: 400 });
    return Response.json({ success: true, rows_written: result.rowsWritten, skipped_rate_plan_ids: result.skippedRatePlanIds });
```

(Only the two lines referencing `room_type_ids`/`skipped_room_type_ids`
change — everything else in the file is untouched.)

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/app/api/room-types/rate-overrides/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in this route or `[id]/route.ts` (that file doesn't
reference `room_type_ids` at all — it already operates purely on an
override row id, so Task 2's rename needs no change there beyond what
TypeScript already caught via the `OverrideFieldKey` type, which is
unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/room-types/rate-overrides/route.ts src/app/api/room-types/rate-overrides/route.test.ts
git commit -m "feat: rate-overrides POST endpoint takes rate_plan_ids

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: New rate-plan CRUD API routes

**Files:**
- Create: `src/lib/validations/rate-plan.ts`
- Create: `src/app/api/room-types/[id]/rate-plans/route.ts`
- Create: `src/app/api/room-types/[id]/rate-plans/[rateplanId]/route.ts`
- Create: `src/app/api/room-types/[id]/rate-plans/route.test.ts`
- Create: `src/app/api/room-types/[id]/rate-plans/[rateplanId]/route.test.ts`

- [ ] **Step 1: Write the validation schema**

```ts
// src/lib/validations/rate-plan.ts
import * as yup from "yup";

const optionalNumber = () =>
  yup
    .number()
    .transform((value, original) =>
      original === "" || original === null || original === undefined || Number.isNaN(value) ? null : value
    )
    .nullable()
    .optional();

export const createRatePlanSchema = yup.object().shape({
  name: yup.string().min(1, "Name is required").max(100, "Name must be at most 100 characters").required("Name is required"),
  base_price: yup.number().min(0.01, "Price must be greater than 0").required("Base price is required"),
  stop_sell: yup.boolean().optional(),
  closed_to_arrival: yup.boolean().optional(),
  closed_to_departure: yup.boolean().optional(),
  min_stay_arrival: optionalNumber().min(1, "Min stay must be at least 1 night"),
  min_stay_through: optionalNumber().min(1, "Min stay must be at least 1 night"),
  max_stay: optionalNumber().min(1, "Max stay must be at least 1 night"),
});

export const updateRatePlanSchema = createRatePlanSchema.shape({
  name: yup.string().min(1, "Name is required").max(100, "Name must be at most 100 characters").optional(),
  base_price: yup.number().min(0.01, "Price must be greater than 0").optional(),
});
```

- [ ] **Step 2: Write the test for the create/list route**

```ts
// src/app/api/room-types/[id]/rate-plans/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

vi.mock("@/lib/channels/channex-provision", () => ({
  provisionOrg: vi.fn().mockResolvedValue({ ok: true, rows: [], warnings: [], propertyId: "prop-1" }),
}));

import { provisionOrg } from "@/lib/channels/channex-provision";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/rt-1/rate-plans", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function params(id = "rt-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/room-types/[id]/rate-plans", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    vi.mocked(provisionOrg).mockClear();
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(jsonRequest({ name: "BAR", base_price: 100 }), params());
    expect(res.status).toBe(401);
  });

  it("returns 403 for a staff member", async () => {
    db.seed("room_types", [{ id: "rt-1", organization_id: "org-1" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await POST(jsonRequest({ name: "BAR", base_price: 100 }), params());
    expect(res.status).toBe(403);
  });

  it("returns 404 when the room type doesn't belong to the manager's org", async () => {
    db.seed("room_types", [{ id: "rt-1", organization_id: "other-org" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(jsonRequest({ name: "BAR", base_price: 100 }), params());
    expect(res.status).toBe(404);
  });

  it("creates a non-default rate plan and provisions it", async () => {
    db.seed("room_types", [{ id: "rt-1", organization_id: "org-1" }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await POST(jsonRequest({ name: "Bed & Breakfast", base_price: 120 }), params());
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(db.tables.rate_plans).toHaveLength(1);
    expect(db.tables.rate_plans[0]).toMatchObject({
      room_type_id: "rt-1", organization_id: "org-1", name: "Bed & Breakfast", base_price: 120, is_default: false,
    });
    expect(data.rate_plan.id).toBe(db.tables.rate_plans[0].id);
    expect(provisionOrg).toHaveBeenCalledWith(db, "org-1");
  });
});
```

- [ ] **Step 3: Write the test for the update/delete route**

```ts
// src/app/api/room-types/[id]/rate-plans/[rateplanId]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));
vi.mock("@/lib/channels/channex-provision", () => ({
  provisionOrg: vi.fn().mockResolvedValue({ ok: true, rows: [], warnings: [], propertyId: "prop-1" }),
}));

import { PATCH, DELETE } from "./route";

function params(rateplanId = "rp-1") {
  return { params: Promise.resolve({ id: "rt-1", rateplanId }) };
}
function patchRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/rt-1/rate-plans/rp-1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/room-types/[id]/rate-plans/[rateplanId]", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
  });

  it("updates only the fields sent", async () => {
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", base_price: 100, is_default: false }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await PATCH(patchRequest({ base_price: 150 }), params());

    expect(res.status).toBe(200);
    expect(db.tables.rate_plans[0]).toMatchObject({ base_price: 150, name: "BAR" });
  });
});

describe("DELETE /api/room-types/[id]/rate-plans/[rateplanId]", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
  });

  function del(rateplanId = "rp-1") {
    return DELETE(new Request("http://localhost", { method: "DELETE" }), params(rateplanId));
  }

  it("deletes a non-default rate plan with no overrides", async () => {
    db.seed("rate_plans", [
      { id: "rp-default", organization_id: "org-1", room_type_id: "rt-1", name: "Standard Rate", is_default: true },
      { id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", is_default: false },
    ]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await del();

    expect(res.status).toBe(200);
    expect(db.tables.rate_plans.find((r: any) => r.id === "rp-1")).toBeUndefined();
  });

  it("refuses to delete the default rate plan", async () => {
    db.seed("rate_plans", [
      { id: "rp-default", organization_id: "org-1", room_type_id: "rt-1", name: "Standard Rate", is_default: true },
    ]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await del("rp-default");

    expect(res.status).toBe(409);
    expect(db.tables.rate_plans).toHaveLength(1);
  });

  it("refuses to delete a rate plan that has existing overrides", async () => {
    db.seed("rate_plans", [
      { id: "rp-default", organization_id: "org-1", room_type_id: "rt-1", name: "Standard Rate", is_default: true },
      { id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", is_default: false },
    ]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: "org-1", rate_plan_id: "rp-1", date: "2026-11-01", rate: 100 },
    ]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await del();

    expect(res.status).toBe(409);
    expect(db.tables.rate_plans.find((r: any) => r.id === "rp-1")).toBeDefined();
  });
});
```

- [ ] **Step 4: Run the tests, confirm they fail**

Run: `npx vitest run src/app/api/room-types/[id]/rate-plans/`
Expected: FAIL — the route files don't exist yet.

- [ ] **Step 5: Write the create/list route**

```ts
// src/app/api/room-types/[id]/rate-plans/route.ts
import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { createRatePlanSchema } from "@/lib/validations/rate-plan";
import { provisionOrg } from "@/lib/channels/channex-provision";
import { getPrimaryMembership } from "@/lib/org-membership";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomTypeId } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership || !isManager(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: roomType } = await supabase
      .from("room_types")
      .select("id")
      .eq("id", roomTypeId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (!roomType) return Response.json({ error: "Room type not found" }, { status: 404 });

    const body = await request.json();
    try {
      await createRatePlanSchema.validate(body);
    } catch (validationError: any) {
      return Response.json({ error: validationError.message }, { status: 400 });
    }

    const { data: ratePlan, error } = await (supabase.from("rate_plans") as any)
      .insert({
        organization_id: membership.organizationId,
        room_type_id: roomTypeId,
        name: body.name,
        base_price: body.base_price,
        stop_sell: body.stop_sell ?? false,
        closed_to_arrival: body.closed_to_arrival ?? false,
        closed_to_departure: body.closed_to_departure ?? false,
        min_stay_arrival: body.min_stay_arrival ?? null,
        min_stay_through: body.min_stay_through ?? null,
        max_stay: body.max_stay ?? null,
        is_default: false,
      })
      .select()
      .single();

    if (error) return Response.json({ error: "Failed to create rate plan" }, { status: 400 });

    // Provision it on Channex immediately — safe to no-op if the org isn't connected.
    await provisionOrg(supabase, membership.organizationId);

    return Response.json({ rate_plan: ratePlan }, { status: 201 });
  } catch (error) {
    console.error("Error creating rate plan:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Write the update/delete route**

```ts
// src/app/api/room-types/[id]/rate-plans/[rateplanId]/route.ts
import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { updateRatePlanSchema } from "@/lib/validations/rate-plan";
import { getPrimaryMembership } from "@/lib/org-membership";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rateplanId: string }> }
) {
  try {
    const { rateplanId } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership || !isManager(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: ratePlan } = await supabase
      .from("rate_plans")
      .select("id")
      .eq("id", rateplanId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (!ratePlan) return Response.json({ error: "Rate plan not found" }, { status: 404 });

    const body = await request.json();
    try {
      await updateRatePlanSchema.validate(body);
    } catch (validationError: any) {
      return Response.json({ error: validationError.message }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ["name", "base_price", "stop_sell", "closed_to_arrival", "closed_to_departure", "min_stay_arrival", "min_stay_through", "max_stay"] as const) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    const { error } = await (supabase.from("rate_plans") as any).update(updateData).eq("id", rateplanId);
    if (error) return Response.json({ error: "Failed to update rate plan" }, { status: 400 });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating rate plan:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; rateplanId: string }> }
) {
  try {
    const { rateplanId } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership || !isManager(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: ratePlan } = await supabase
      .from("rate_plans")
      .select("id, is_default")
      .eq("id", rateplanId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (!ratePlan) return Response.json({ error: "Rate plan not found" }, { status: 404 });
    if ((ratePlan as any).is_default) {
      return Response.json({ error: "Can't delete a room type's only (default) rate plan" }, { status: 409 });
    }

    const { data: overrides } = await supabase
      .from("room_type_rate_overrides")
      .select("id")
      .eq("rate_plan_id", rateplanId)
      .limit(1);
    if (overrides && overrides.length > 0) {
      return Response.json({ error: "This rate plan has date-specific overrides — clear them first" }, { status: 409 });
    }

    const { error } = await supabase.from("rate_plans").delete().eq("id", rateplanId);
    if (error) return Response.json({ error: "Failed to delete rate plan" }, { status: 400 });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting rate plan:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 7: Run the tests, confirm they pass**

Run: `npx vitest run src/app/api/room-types/[id]/rate-plans/`
Expected: PASS, all 8 tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/validations/rate-plan.ts "src/app/api/room-types/[id]/rate-plans"
git commit -m "feat: add rate plan CRUD API routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `room-types/create` — also create the default rate plan

**Files:**
- Modify: `src/app/api/room-types/create/route.ts`
- Modify: `src/lib/validations/room.ts`
- Create: `src/app/api/room-types/create/route.test.ts`

No test file exists for this route today (confirmed: the directory holds
only `route.ts`). The spec's Testing section calls for one explicitly
("creating a room type also creates its default rate plan with the
submitted price/restrictions"), so this task writes it from scratch,
test-first.

- [ ] **Step 1: Write the test file**

```ts
// src/app/api/room-types/create/route.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

const db = new FakeSupabaseClient();

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/room-types/create", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(jsonRequest({ name: "Twin Room", type: "private", capacity: 2, base_price: 100 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user has no membership", async () => {
    db.tables.memberships = [];
    const res = await POST(jsonRequest({ name: "Twin Room", type: "private", capacity: 2, base_price: 100 }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when the payload fails validation", async () => {
    const res = await POST(jsonRequest({ name: "T", type: "private", capacity: 2, base_price: 100 }));
    expect(res.status).toBe(400);
  });

  it("creates the room type (physical attributes only) and a matching default rate plan", async () => {
    const res = await POST(jsonRequest({
      name: "Twin Room", type: "private", capacity: 2, base_price: 100,
      stop_sell: false, closed_to_arrival: true, min_stay_arrival: 2,
    }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(db.tables.room_types).toHaveLength(1);
    expect(db.tables.room_types[0]).toMatchObject({
      organization_id: "org-1", name: "Twin Room", type: "private", capacity: 2, base_price: 100,
    });

    expect(db.tables.rate_plans).toHaveLength(1);
    expect(db.tables.rate_plans[0]).toMatchObject({
      organization_id: "org-1",
      room_type_id: data.room_type_id,
      name: "Standard Rate",
      base_price: 100,
      stop_sell: false,
      closed_to_arrival: true,
      min_stay_arrival: 2,
      is_default: true,
    });
  });

  it("defaults unset restriction fields to false/null on both the room type and its rate plan", async () => {
    const res = await POST(jsonRequest({ name: "Twin Room", type: "private", capacity: 2, base_price: 100 }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(db.tables.rate_plans[0]).toMatchObject({
      room_type_id: data.room_type_id,
      stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
      min_stay_arrival: null, min_stay_through: null, max_stay: null,
    });
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/app/api/room-types/create/route.test.ts`
Expected: FAIL — the route still has the unscoped `.single()` membership
lookup (so the 403 test either throws or returns the wrong status) and
never inserts into `rate_plans` at all.

- [ ] **Step 3: Narrow `createRoomTypeSchema` to physical attributes**

In `src/lib/validations/room.ts`, split the schema. Replace
`createRoomTypeSchema` and `updateRoomTypeSchema`:

```ts
// Room Type Schemas — physical attributes only. Pricing/restrictions moved
// to rate_plans (see src/lib/validations/rate-plan.ts); create requests
// still accept them here (to seed the auto-created default rate plan in
// one request) but update requests for an existing room type no longer do
// — edit the default rate plan via its own endpoint instead.
export const createRoomTypeSchema = yup.object().shape({
  name: yup.string().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters").required("Room type name is required"),
  type: yup.string().oneOf(["dorm", "private"], "Type must be either dorm or private").required("Room type is required"),
  gender: yup.string().oneOf(["", "mixed", "female", "male"], "Invalid gender selection").nullable(),
  capacity: yup.number().min(1, "Capacity must be at least 1").max(20, "Capacity must be at most 20").required("Capacity is required"),
  base_price: yup.number().min(0.01, "Price must be greater than 0").required("Base price is required"),
  description: yup.string().max(500, "Description must be at most 500 characters").nullable().optional(),
  stop_sell: yup.boolean().optional(),
  closed_to_arrival: yup.boolean().optional(),
  closed_to_departure: yup.boolean().optional(),
  min_stay_arrival: optionalNumber().min(1, "Min stay must be at least 1 night"),
  min_stay_through: optionalNumber().min(1, "Min stay must be at least 1 night"),
  max_stay: optionalNumber().min(1, "Max stay must be at least 1 night"),
});

export const updateRoomTypeSchema = yup.object().shape({
  name: yup.string().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters").optional(),
  type: yup.string().oneOf(["dorm", "private"], "Type must be either dorm or private").optional(),
  gender: yup.string().oneOf(["", "mixed", "female", "male"], "Invalid gender selection").nullable(),
  capacity: yup.number().min(1, "Capacity must be at least 1").max(20, "Capacity must be at most 20").optional(),
  description: yup.string().max(500, "Description must be at most 500 characters").nullable().optional(),
});
```

`base_price`/`stop_sell`/CTA/CTD/min-max-stay are gone from
`updateRoomTypeSchema` entirely — those now live on `rate_plans` and go
through the Task 8 endpoints.

- [ ] **Step 4: Update the create route**

Replace `src/app/api/room-types/create/route.ts` in full:

```ts
import { createServerClient } from "@/lib/supabase/server";
import { createRoomTypeSchema } from "@/lib/validations/room";
import { getPrimaryMembership } from "@/lib/org-membership";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    const body = await request.json();

    try {
      await createRoomTypeSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const { data: newRoomType, error: roomTypeError } = await (supabase
      .from("room_types") as any)
      .insert({
        organization_id: membership.organizationId,
        name: body.name,
        type: body.type,
        gender: body.gender || null,
        capacity: body.capacity,
        base_price: body.base_price,
        description: body.description || null,
        stop_sell: body.stop_sell ?? false,
        closed_to_arrival: body.closed_to_arrival ?? false,
        closed_to_departure: body.closed_to_departure ?? false,
        min_stay_arrival: body.min_stay_arrival ?? null,
        min_stay_through: body.min_stay_through ?? null,
        max_stay: body.max_stay ?? null,
      })
      .select("id")
      .single();

    if (roomTypeError) {
      console.error("Room type creation error:", roomTypeError);
      return Response.json(
        { error: "Failed to create room type" },
        { status: 400 }
      );
    }

    const roomTypeId = (newRoomType as any).id;

    const { error: ratePlanError } = await (supabase.from("rate_plans") as any).insert({
      organization_id: membership.organizationId,
      room_type_id: roomTypeId,
      name: "Standard Rate",
      base_price: body.base_price,
      stop_sell: body.stop_sell ?? false,
      closed_to_arrival: body.closed_to_arrival ?? false,
      closed_to_departure: body.closed_to_departure ?? false,
      min_stay_arrival: body.min_stay_arrival ?? null,
      min_stay_through: body.min_stay_through ?? null,
      max_stay: body.max_stay ?? null,
      is_default: true,
    });
    if (ratePlanError) {
      console.error("Default rate plan creation error:", ratePlanError);
      // Room type was created; surface this but don't fail the whole
      // request — the room-type dialog's rate-plans list will show it
      // missing and the manager can add one manually.
    }

    return Response.json(
      { success: true, room_type_id: roomTypeId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating room type:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

(Also fixes the pre-existing unscoped `.single()` membership lookup bug
along the way — same bug pattern fixed elsewhere in this codebase.)

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npx vitest run src/app/api/room-types/create/route.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in these two files. Expect errors in
`room-types-dialog.tsx` (still references the old schema shape, including
`base_price` on `updateRoomTypeSchema`) — fixed in Task 11.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/room-types/create/route.ts src/app/api/room-types/create/route.test.ts src/lib/validations/room.ts
git commit -m "feat: room type creation also creates its default rate plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: `room-types/[id]` PATCH — drop pricing/restriction fields

**Files:**
- Modify: `src/app/api/room-types/[id]/route.ts`
- Create: `src/app/api/room-types/[id]/route.test.ts`

No test file exists for this route today either. Write it test-first,
covering the three behavior changes this task makes: GET now includes
`rate_plans`, PATCH silently drops any pricing/restriction field sent in
the body instead of writing it, and DELETE's existing room-check-first
behavior is unchanged.

- [ ] **Step 1: Write the test file**

```ts
// src/app/api/room-types/[id]/route.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

import { GET, PATCH, DELETE } from "./route";

function params(id = "rt-1") {
  return { params: Promise.resolve({ id }) };
}
function patchRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/rt-1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("room-types/[id] route", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    db.seed("room_types", [{ id: "rt-1", organization_id: "org-1", name: "Twin Room", type: "private", capacity: 2, base_price: 100 }]);
  });

  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      db.setUser(null);
      const res = await GET(new Request("http://localhost"), params());
      expect(res.status).toBe(401);
    });

    it("includes the room type's rate plans", async () => {
      db.seed("rate_plans", [
        { id: "rp-1", room_type_id: "rt-1", name: "Standard Rate", base_price: 100, is_default: true },
        { id: "rp-2", room_type_id: "rt-1", name: "Bed & Breakfast", base_price: 120, is_default: false },
      ]);

      const res = await GET(new Request("http://localhost"), params());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.rate_plans).toHaveLength(2);
      expect(data.rate_plans.map((rp: any) => rp.name).sort()).toEqual(["Bed & Breakfast", "Standard Rate"]);
    });

    it("returns 404 for a room type belonging to another org", async () => {
      db.seed("room_types", [{ id: "rt-2", organization_id: "other-org", name: "X", type: "private", capacity: 1, base_price: 50 }]);
      const res = await GET(new Request("http://localhost"), params("rt-2"));
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH", () => {
    it("updates physical attributes", async () => {
      const res = await PATCH(patchRequest({ name: "Deluxe Twin" }), params());
      expect(res.status).toBe(200);
      expect(db.tables.room_types[0]).toMatchObject({ name: "Deluxe Twin" });
    });

    it("silently drops pricing/restriction fields instead of writing them", async () => {
      const res = await PATCH(patchRequest({ name: "Deluxe Twin", base_price: 999, stop_sell: true }), params());
      expect(res.status).toBe(200);
      expect(db.tables.room_types[0]).toMatchObject({ name: "Deluxe Twin", base_price: 100 });
      expect(db.tables.room_types[0]).not.toHaveProperty("stop_sell");
    });

    it("returns 404 for a room type belonging to another org", async () => {
      db.seed("room_types", [{ id: "rt-2", organization_id: "other-org", name: "X", type: "private", capacity: 1, base_price: 50 }]);
      const res = await PATCH(patchRequest({ name: "Y" }), params("rt-2"));
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("blocks deletion when rooms exist", async () => {
      db.seed("rooms", [{ id: "room-1", room_type_id: "rt-1", organization_id: "org-1" }]);
      const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), params());
      expect(res.status).toBe(409);
      expect(db.tables.room_types).toHaveLength(1);
    });

    it("deletes a room type with no rooms", async () => {
      const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), params());
      expect(res.status).toBe(200);
      expect(db.tables.room_types).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run "src/app/api/room-types/[id]/route.test.ts"`
Expected: FAIL — the route doesn't query `rate_plans` in `GET` yet, and
`PATCH` still writes `base_price`/`stop_sell` straight onto `room_types`.

- [ ] **Step 3: Update the GET, PATCH, and DELETE handlers**

Replace the full file contents:

```ts
import { createServerClient } from "@/lib/supabase/server";
import { updateRoomTypeSchema } from "@/lib/validations/room";
import { getPrimaryMembership } from "@/lib/org-membership";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    const { data: roomType, error: roomTypeError } = await supabase
      .from("room_types")
      .select("*")
      .eq("id", id)
      .eq("organization_id", membership.organizationId)
      .single();

    if (roomTypeError || !roomType) {
      return Response.json({ error: "Room type not found" }, { status: 404 });
    }

    const { count: roomCount } = await supabase
      .from("rooms")
      .select("*", { count: "exact", head: true })
      .eq("room_type_id", id);

    const { data: ratePlans } = await supabase
      .from("rate_plans")
      .select("id, name, base_price, stop_sell, closed_to_arrival, closed_to_departure, min_stay_arrival, min_stay_through, max_stay, is_default")
      .eq("room_type_id", id)
      .order("is_default", { ascending: false });

    return Response.json({
      ...(roomType as any),
      room_count: roomCount || 0,
      rate_plans: ratePlans ?? [],
    });
  } catch (error) {
    console.error("Error fetching room type:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    const { data: roomType, error: roomTypeError } = await supabase
      .from("room_types")
      .select("id")
      .eq("id", id)
      .eq("organization_id", membership.organizationId)
      .single();

    if (roomTypeError || !roomType) {
      return Response.json({ error: "Room type not found" }, { status: 404 });
    }

    const body = await request.json();

    try {
      await updateRoomTypeSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name || null;
    if (body.type !== undefined) updateData.type = body.type || null;
    if (body.gender !== undefined) updateData.gender = body.gender || null;
    if (body.capacity !== undefined) updateData.capacity = body.capacity || null;
    if (body.description !== undefined) updateData.description = body.description || null;
    updateData.updated_at = new Date().toISOString();

    const { error: updateError } = await (supabase
      .from("room_types") as any)
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Update error:", updateError);
      return Response.json(
        { error: updateError.message || "Failed to update room type" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating room type:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    const { data: roomType, error: roomTypeError } = await supabase
      .from("room_types")
      .select("id")
      .eq("id", id)
      .eq("organization_id", membership.organizationId)
      .single();

    if (roomTypeError || !roomType) {
      return Response.json({ error: "Room type not found" }, { status: 404 });
    }

    const { data: rooms, error: checkError } = await supabase
      .from("rooms")
      .select("id")
      .eq("room_type_id", id);

    if (checkError) {
      console.error("Check error:", checkError);
      return Response.json(
        { error: "Failed to check rooms" },
        { status: 400 }
      );
    }

    if (rooms && rooms.length > 0) {
      return Response.json(
        {
          error:
            "Cannot delete room type with existing rooms. Please delete all rooms first.",
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabase
      .from("room_types")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return Response.json(
        { error: "Failed to delete room type" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting room type:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

Key changes from the original: `GET` now also returns `rate_plans` for
that room type; `PATCH` drops every pricing/restriction field from
`updateData` and the now-unneeded `enqueueRestrictions` call+import (rate
plan edits enqueue their own push via Task 8's PATCH endpoint →
`applyRateOverrides`'s sibling path isn't used here at all — a direct
`rate_plans` edit doesn't go through the override system; add a
`enqueueRestrictions` call in Task 8's `PATCH .../rate-plans/[rateplanId]`
instead, see Step 4 below). All three handlers also get the unscoped
`.single()` → `getPrimaryMembership` fix, consistent with the rest of the
codebase.

- [ ] **Step 4: Run the Task 10 test file, confirm it passes**

Run: `npx vitest run "src/app/api/room-types/[id]/route.test.ts"`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Revisit Task 8's rate-plan PATCH route — enqueue a push on standing-value edits**

Go back to `src/app/api/room-types/[id]/rate-plans/[rateplanId]/route.ts`
(written in Task 8) and add a push enqueue after a successful update,
mirroring what the old `room-types/[id]/route.ts` PATCH used to do for
restriction fields:

Add the import:

```ts
import { enqueueRestrictions } from "@/lib/channels/channex-outbox";
```

After the successful `update` call in `PATCH`, before `return
Response.json({ success: true })`:

```ts
    const restrictionFieldsChanged = [
      "base_price", "stop_sell", "closed_to_arrival", "closed_to_departure",
      "min_stay_arrival", "min_stay_through", "max_stay",
    ].some((field) => body[field] !== undefined);
    if (restrictionFieldsChanged) {
      const today = new Date().toISOString().slice(0, 10);
      const horizon = new Date(Date.now() + 500 * 86400000).toISOString().slice(0, 10);
      await enqueueRestrictions(supabase, membership.organizationId, today, horizon, [rateplanId]);
    }
```

No `touchedFields` passed here — a standing-value edit affects every
future date from today onward, which is exactly the full-snapshot case
`pushRatesForOrg` already handles correctly when `touchedFields` is
`undefined`.

Add one more test to
`src/app/api/room-types/[id]/rate-plans/[rateplanId]/route.test.ts`
(mock `enqueueRestrictions` first):

```ts
vi.mock("@/lib/channels/channex-outbox", () => ({
  enqueueRestrictions: vi.fn().mockResolvedValue(undefined),
}));
```

(add this mock near the top of the file, alongside the existing
`channex-provision` mock) and:

```ts
  it("enqueues a restrictions push when a priced/restricted field changes", async () => {
    const { enqueueRestrictions } = await import("@/lib/channels/channex-outbox");
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", base_price: 100, is_default: false }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    await PATCH(patchRequest({ base_price: 150 }), params());

    expect(enqueueRestrictions).toHaveBeenCalledWith(db, "org-1", expect.any(String), expect.any(String), ["rp-1"]);
  });

  it("does not enqueue a push when only the name changes", async () => {
    const { enqueueRestrictions } = await import("@/lib/channels/channex-outbox");
    vi.mocked(enqueueRestrictions).mockClear();
    db.seed("rate_plans", [{ id: "rp-1", organization_id: "org-1", room_type_id: "rt-1", name: "BAR", base_price: 100, is_default: false }]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    await PATCH(patchRequest({ name: "Best Available Rate" }), params());

    expect(enqueueRestrictions).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Run the full room-types route test suite**

Run: `npx vitest run src/app/api/room-types/`
Expected: PASS, including the Task 10 test file and the 2 new tests added
to the Task 8 rate-plan PATCH test file just above.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors remaining only in `room-types-dialog.tsx` (Task 11) and
`rate-overrides-client.tsx`/`rates/page.tsx` (Task 12).

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/room-types/[id]/route.ts" "src/app/api/room-types/[id]/route.test.ts" "src/app/api/room-types/[id]/rate-plans/[rateplanId]/route.ts" "src/app/api/room-types/[id]/rate-plans/[rateplanId]/route.test.ts"
git commit -m "feat: room-types PATCH drops pricing/restriction fields, GET includes rate_plans

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: `room-types-dialog.tsx` — rate plans list

**Files:**
- Modify: `src/components/rooms/room-types-dialog.tsx`

This is a UI component; this codebase has no component-level unit tests
(confirmed by the existing test suite's scope — only `lib/` and API
`route.test.ts` files exist). Verify this task by running the dev server
and exercising the dialog in a browser, per the project's standard UI
verification practice, rather than by writing component tests.

- [ ] **Step 1: Split the form state — physical attributes vs. rate plans list**

The dialog currently has one `react-hook-form` instance covering both
concerns. Replace it with: the same form, now scoped to physical
attributes only (name/type/gender/capacity/description), plus independent
local state for the rate-plans list (fetched once the dialog opens in edit
mode, each row separately editable/saveable).

Replace the full contents of `src/components/rooms/room-types-dialog.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createRoomTypeSchema, updateRoomTypeSchema } from "@/lib/validations/room";

interface RoomTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTypeId?: string | null;
  onRoomTypeCreated?: () => void;
  onRoomTypeUpdated?: () => void;
}

interface RatePlan {
  id: string;
  name: string;
  base_price: number;
  stop_sell: boolean;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  min_stay_arrival: number | null;
  min_stay_through: number | null;
  max_stay: number | null;
  is_default: boolean;
}

const ROOM_TYPE_VALUES = ["dorm", "private"] as const;
const GENDER_VALUES = ["", "mixed", "male", "female"] as const;

const emptyNewRatePlanForm = {
  name: "", base_price: "", stop_sell: false, closed_to_arrival: false,
  closed_to_departure: false, min_stay_arrival: "", min_stay_through: "", max_stay: "",
};

export default function RoomTypeDialog({
  open,
  onOpenChange,
  roomTypeId,
  onRoomTypeCreated,
  onRoomTypeUpdated,
}: RoomTypeDialogProps) {
  const t = useTranslations("rooms.types.dialog");
  const isEditing = !!roomTypeId;
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [editingRatePlanId, setEditingRatePlanId] = useState<string | null>(null);
  const [ratePlanDrafts, setRatePlanDrafts] = useState<Record<string, any>>({});
  const [savingRatePlanId, setSavingRatePlanId] = useState<string | null>(null);
  const [deletingRatePlanId, setDeletingRatePlanId] = useState<string | null>(null);
  const [addingRatePlan, setAddingRatePlan] = useState(false);
  const [newRatePlan, setNewRatePlan] = useState<typeof emptyNewRatePlanForm>(emptyNewRatePlanForm);
  const [savingNewRatePlan, setSavingNewRatePlan] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: yupResolver(isEditing ? updateRoomTypeSchema : createRoomTypeSchema),
    defaultValues: isEditing
      ? { name: "", type: "dorm", gender: "", capacity: 1, description: "" }
      : {
          name: "", type: "dorm", gender: "", capacity: 1, base_price: 0, description: "",
          stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
          min_stay_arrival: null, min_stay_through: null, max_stay: null,
        },
  });

  useEffect(() => {
    if (open && isEditing) {
      fetchRoomType();
    } else if (open) {
      reset({
        name: "", type: "dorm", gender: "", capacity: 1, base_price: 0, description: "",
        stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
        min_stay_arrival: null, min_stay_through: null, max_stay: null,
      });
      setRatePlans([]);
    }
  }, [open, isEditing]);

  const fetchRoomType = async () => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}`);
      const roomType = await res.json();

      if (!res.ok) {
        toast.error(t("toastLoadFailed"));
        return;
      }

      reset({
        name: roomType.name,
        type: roomType.type,
        gender: roomType.gender || "",
        capacity: roomType.capacity,
        description: roomType.description || "",
      });
      setRatePlans(roomType.rate_plans ?? []);
    } catch (error) {
      toast.error(t("toastLoadFailed"));
      console.error(error);
    } finally {
      setLoadingData(false);
    }
  };

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing
        ? `/api/room-types/${roomTypeId}`
        : "/api/room-types/create";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        body: JSON.stringify(data),
      });

      const responseData = await res.json();

      if (!res.ok) {
        toast.error(responseData.error || t("toastSaveFailed"));
        return;
      }

      toast.success(isEditing ? t("toastUpdated") : t("toastCreated"));
      onOpenChange(false);
      reset();

      if (isEditing && onRoomTypeUpdated) {
        onRoomTypeUpdated();
      } else if (!isEditing && onRoomTypeCreated) {
        onRoomTypeCreated();
      }
    } catch (error) {
      toast.error(t("toastSaveFailed"));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirmDialog(t("confirmDelete")))) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("toastDeleteFailed"));
        return;
      }

      toast.success(t("toastDeleted"));
      onOpenChange(false);
      reset();
      if (onRoomTypeUpdated) onRoomTypeUpdated();
    } catch (error) {
      toast.error(t("toastDeleteFailed"));
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditRatePlan = (rp: RatePlan) => {
    setEditingRatePlanId(rp.id);
    setRatePlanDrafts((prev) => ({
      ...prev,
      [rp.id]: {
        name: rp.name,
        base_price: String(rp.base_price),
        stop_sell: rp.stop_sell,
        closed_to_arrival: rp.closed_to_arrival,
        closed_to_departure: rp.closed_to_departure,
        min_stay_arrival: rp.min_stay_arrival ?? "",
        min_stay_through: rp.min_stay_through ?? "",
        max_stay: rp.max_stay ?? "",
      },
    }));
  };

  const saveRatePlan = async (rateplanId: string) => {
    const draft = ratePlanDrafts[rateplanId];
    setSavingRatePlanId(rateplanId);
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}/rate-plans/${rateplanId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          base_price: Number(draft.base_price),
          stop_sell: draft.stop_sell,
          closed_to_arrival: draft.closed_to_arrival,
          closed_to_departure: draft.closed_to_departure,
          min_stay_arrival: draft.min_stay_arrival === "" ? null : Number(draft.min_stay_arrival),
          min_stay_through: draft.min_stay_through === "" ? null : Number(draft.min_stay_through),
          max_stay: draft.max_stay === "" ? null : Number(draft.max_stay),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("ratePlans.toastSaveFailed"));
        return;
      }
      toast.success(t("ratePlans.toastSaved"));
      setEditingRatePlanId(null);
      fetchRoomType();
    } catch (error) {
      toast.error(t("ratePlans.toastSaveFailed"));
      console.error(error);
    } finally {
      setSavingRatePlanId(null);
    }
  };

  const deleteRatePlan = async (rateplanId: string) => {
    if (!(await confirmDialog(t("ratePlans.confirmDelete")))) return;
    setDeletingRatePlanId(rateplanId);
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}/rate-plans/${rateplanId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("ratePlans.toastDeleteFailed"));
        return;
      }
      toast.success(t("ratePlans.toastDeleted"));
      fetchRoomType();
    } catch (error) {
      toast.error(t("ratePlans.toastDeleteFailed"));
      console.error(error);
    } finally {
      setDeletingRatePlanId(null);
    }
  };

  const addRatePlan = async () => {
    if (!newRatePlan.name || !newRatePlan.base_price) {
      toast.error(t("ratePlans.errorNameAndPriceRequired"));
      return;
    }
    setSavingNewRatePlan(true);
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}/rate-plans`, {
        method: "POST",
        body: JSON.stringify({
          name: newRatePlan.name,
          base_price: Number(newRatePlan.base_price),
          stop_sell: newRatePlan.stop_sell,
          closed_to_arrival: newRatePlan.closed_to_arrival,
          closed_to_departure: newRatePlan.closed_to_departure,
          min_stay_arrival: newRatePlan.min_stay_arrival === "" ? null : Number(newRatePlan.min_stay_arrival),
          min_stay_through: newRatePlan.min_stay_through === "" ? null : Number(newRatePlan.min_stay_through),
          max_stay: newRatePlan.max_stay === "" ? null : Number(newRatePlan.max_stay),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("ratePlans.toastAddFailed"));
        return;
      }
      toast.success(t("ratePlans.toastAdded"));
      setNewRatePlan(emptyNewRatePlanForm);
      setAddingRatePlan(false);
      fetchRoomType();
    } catch (error) {
      toast.error(t("ratePlans.toastAddFailed"));
      console.error(error);
    } finally {
      setSavingNewRatePlan(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-surface border border-border rounded-lg shadow-lg p-6 max-w-lg w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto z-50">
          {loadingData && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/80 rounded-lg">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-serif text-2xl font-semibold">
              {isEditing ? t("editTitle") : t("createTitle")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-muted rounded transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("nameLabel")}</label>
              <input
                type="text"
                placeholder={t("namePlaceholder")}
                {...register("name")}
                className={`w-full px-3 py-2 border rounded-lg ${errors.name ? "border-red-500" : "border-border"} disabled:opacity-50`}
                disabled={isLoading || isDeleting}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("typeLabel")}</label>
                <select
                  {...register("type")}
                  className={`w-full px-3 py-2 border rounded-lg ${errors.type ? "border-red-500" : "border-border"} disabled:opacity-50`}
                  disabled={isLoading || isDeleting}
                >
                  <option value="">{t("selectType")}</option>
                  {ROOM_TYPE_VALUES.map((rt) => (
                    <option key={rt} value={rt}>{t(`type_${rt}`)}</option>
                  ))}
                </select>
                {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t("genderLabel")}</label>
                <select
                  {...register("gender")}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
                  disabled={isLoading || isDeleting}
                >
                  {GENDER_VALUES.map((g) => (
                    <option key={g} value={g}>{t(`gender_${g || "none"}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("capacityLabel")}</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  {...register("capacity", { valueAsNumber: true })}
                  className={`w-full px-3 py-2 border rounded-lg ${errors.capacity ? "border-red-500" : "border-border"} disabled:opacity-50`}
                  disabled={isLoading || isDeleting}
                />
                {errors.capacity && <p className="text-red-500 text-sm mt-1">{errors.capacity.message}</p>}
              </div>

              {!isEditing && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t("basePriceLabel")}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("base_price", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-border rounded-lg disabled:opacity-50"
                    disabled={isLoading || isDeleting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t("basePriceHintCreatesDefaultPlan")}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t("descriptionLabel")}</label>
              <textarea
                placeholder={t("descriptionPlaceholder")}
                {...register("description")}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
                disabled={isLoading || isDeleting}
              />
            </div>

            {!isEditing && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium mb-3">{t("channelRestrictionsHeading")}</p>
                <div className="space-y-2 mb-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register("stop_sell")} disabled={isLoading} />
                    {t("stopSellLabel")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register("closed_to_arrival")} disabled={isLoading} />
                    {t("closedToArrivalLabel")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register("closed_to_departure")} disabled={isLoading} />
                    {t("closedToDepartureLabel")}
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t("minStayArrivalLabel")}</label>
                    <input type="number" min="1" {...register("min_stay_arrival", { valueAsNumber: true })} className="w-full px-2 py-1.5 border border-border rounded-lg text-sm" disabled={isLoading} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t("minStayThroughLabel")}</label>
                    <input type="number" min="1" {...register("min_stay_through", { valueAsNumber: true })} className="w-full px-2 py-1.5 border border-border rounded-lg text-sm" disabled={isLoading} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t("maxStayLabel")}</label>
                    <input type="number" min="1" {...register("max_stay", { valueAsNumber: true })} className="w-full px-2 py-1.5 border border-border rounded-lg text-sm" disabled={isLoading} />
                  </div>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">{t("ratePlans.heading")}</p>
                  <button
                    type="button"
                    onClick={() => setAddingRatePlan((v) => !v)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t("ratePlans.addNew")}
                  </button>
                </div>

                <div className="space-y-3">
                  {ratePlans.map((rp) => {
                    const isRowEditing = editingRatePlanId === rp.id;
                    const draft = ratePlanDrafts[rp.id] ?? {};
                    return (
                      <div key={rp.id} className="border border-border rounded-lg p-3">
                        {!isRowEditing ? (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{rp.name} {rp.is_default && <span className="text-xs text-muted-foreground">({t("ratePlans.defaultBadge")})</span>}</p>
                              <p className="text-xs text-muted-foreground">${rp.base_price}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => startEditRatePlan(rp)} className="text-xs text-primary hover:underline">{t("ratePlans.edit")}</button>
                              {!rp.is_default && (
                                <button
                                  type="button"
                                  onClick={() => deleteRatePlan(rp.id)}
                                  disabled={deletingRatePlanId === rp.id}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={draft.name}
                                onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], name: e.target.value } }))}
                                placeholder={t("ratePlans.namePlaceholder")}
                                className="px-2 py-1.5 border border-border rounded-lg text-sm"
                              />
                              <input
                                type="number"
                                step="0.01"
                                value={draft.base_price}
                                onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], base_price: e.target.value } }))}
                                placeholder={t("basePriceLabel")}
                                className="px-2 py-1.5 border border-border rounded-lg text-sm"
                              />
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs">
                              <label className="flex items-center gap-1"><input type="checkbox" checked={draft.stop_sell} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], stop_sell: e.target.checked } }))} />{t("stopSellLabel")}</label>
                              <label className="flex items-center gap-1"><input type="checkbox" checked={draft.closed_to_arrival} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], closed_to_arrival: e.target.checked } }))} />{t("closedToArrivalLabel")}</label>
                              <label className="flex items-center gap-1"><input type="checkbox" checked={draft.closed_to_departure} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], closed_to_departure: e.target.checked } }))} />{t("closedToDepartureLabel")}</label>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <input type="number" min="1" value={draft.min_stay_arrival} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], min_stay_arrival: e.target.value } }))} placeholder={t("minStayArrivalLabel")} className="px-2 py-1.5 border border-border rounded-lg text-xs" />
                              <input type="number" min="1" value={draft.min_stay_through} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], min_stay_through: e.target.value } }))} placeholder={t("minStayThroughLabel")} className="px-2 py-1.5 border border-border rounded-lg text-xs" />
                              <input type="number" min="1" value={draft.max_stay} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], max_stay: e.target.value } }))} placeholder={t("maxStayLabel")} className="px-2 py-1.5 border border-border rounded-lg text-xs" />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingRatePlanId(null)} className="px-3 py-1 text-xs border border-border rounded-lg">{t("cancel")}</button>
                              <button
                                type="button"
                                onClick={() => saveRatePlan(rp.id)}
                                disabled={savingRatePlanId === rp.id}
                                className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                              >
                                {savingRatePlanId === rp.id ? t("saving") : t("save")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {addingRatePlan && (
                    <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newRatePlan.name}
                          onChange={(e) => setNewRatePlan((p) => ({ ...p, name: e.target.value }))}
                          placeholder={t("ratePlans.namePlaceholder")}
                          className="px-2 py-1.5 border border-border rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={newRatePlan.base_price}
                          onChange={(e) => setNewRatePlan((p) => ({ ...p, base_price: e.target.value }))}
                          placeholder={t("basePriceLabel")}
                          className="px-2 py-1.5 border border-border rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setAddingRatePlan(false); setNewRatePlan(emptyNewRatePlanForm); }} className="px-3 py-1 text-xs border border-border rounded-lg">{t("cancel")}</button>
                        <button
                          type="button"
                          onClick={addRatePlan}
                          disabled={savingNewRatePlan}
                          className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                        >
                          {savingNewRatePlan ? t("saving") : t("ratePlans.addNew")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-border">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isLoading || isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? t("deleting") : t("delete")}
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={isLoading || isDeleting}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    {t("cancel")}
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={isLoading || isDeleting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? t("saving") : t("save")}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Design notes on this rewrite:
- Creating a new room type keeps the single-form flow (name + physical
  attrs + the Standard Rate's price/restrictions in one submit) — matches
  Task 9's create endpoint, which creates both in one request.
- Editing an existing room type shows physical attrs in the main form
  (saved via the main Save button) and the rate-plans list below it, each
  row independently editable/saveable/deletable — no single giant form
  spanning N rate plans, which keeps partial failures from corrupting
  unrelated rows and matches how the create-new-rate-plan sub-form already
  needs to work as its own small unit.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in this file. Confirm remaining errors are only in
Tasks 13-14's files.

- [ ] **Step 3: Manual verification**

Start the dev server (`npm run dev`), open the Room Types page as a
manager, and check:
1. Create a new room type — the form still works exactly as before
   (price/restrictions included), and a check via Supabase (or the Rooms
   list) confirms a `rate_plans` row was created with `is_default: true`.
2. Edit that room type — the dialog shows the rate-plans list with the one
   default plan.
3. Click "Add rate plan", fill name + price, save — a second plan appears
   in the list; `channel_provider_links` gains a new `rate_plan` row for
   the connected org.
4. Edit the new plan's price inline, save — list reflects the new value.
5. Try to delete the default plan — blocked (no delete button shown for
   it). Delete the non-default plan — it disappears from the list.

- [ ] **Step 4: Commit**

```bash
git add src/components/rooms/room-types-dialog.tsx
git commit -m "feat: room type dialog manages a list of rate plans, not one flat price

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Rates & Restrictions page — rate-plan picker

**Files:**
- Modify: `src/app/[locale]/[slug]/rates/page.tsx`
- Modify: `src/components/rates/rate-overrides-client.tsx`

- [ ] **Step 1: Update the page to fetch rate plans grouped by room type**

In `src/app/[locale]/[slug]/rates/page.tsx`, replace the room-types fetch
and the type passed to the client:

```tsx
import { getTranslations } from "next-intl/server";
import { getServerUser } from "@/lib/supabase/session";
import RateOverridesClient from "@/components/rates/rate-overrides-client";
import { canAccessSection } from "@/lib/permissions";
import { redirect } from "next/navigation";

type Membership = { organization_id: string; role: string };
export interface RoomTypeWithRatePlans {
  id: string;
  name: string;
  rate_plans: { id: string; name: string; is_default: boolean }[];
}

export default async function RatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await getServerUser();
  const t = await getTranslations("rates");

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!org) {
    return <div className="text-sm text-muted-foreground">{t("noOrgFound")}</div>;
  }

  const { data: membershipRaw } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();
  const membership = membershipRaw as Membership | null;

  if (!membership) {
    return <div className="text-sm text-muted-foreground">{t("noOrgFound")}</div>;
  }

  if (!canAccessSection(membership.role, "rates")) redirect(`/${slug}/dashboard`);

  const { data: roomTypes = [] } = await supabase
    .from("room_types")
    .select("id, name, rate_plans(id, name, is_default)")
    .eq("organization_id", membership.organizationId)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm mt-0.5 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
        <RateOverridesClient roomTypes={(roomTypes ?? []) as RoomTypeWithRatePlans[]} />
      </div>
    </div>
  );
}
```

(`.select("id, name, rate_plans(id, name, is_default)")` is a PostgREST
embedded-resource select via the FK — Supabase resolves `rate_plans`
through `rate_plans.room_type_id -> room_types.id` automatically.)

- [ ] **Step 2: Update the client component**

Replace the full contents of `src/components/rates/rate-overrides-client.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

interface RatePlanOption {
  id: string;
  name: string;
  is_default: boolean;
}
interface RoomTypeOption {
  id: string;
  name: string;
  rate_plans: RatePlanOption[];
}

interface OverrideRow {
  id: string;
  rate_plan_id: string;
  date: string;
  rate: number | null;
  min_stay_arrival: number | null;
  min_stay_through: number | null;
  max_stay: number | null;
  stop_sell: boolean | null;
  closed_to_arrival: boolean | null;
  closed_to_departure: boolean | null;
}

const FIELD_KEYS = [
  "rate", "min_stay_arrival", "min_stay_through", "max_stay",
  "stop_sell", "closed_to_arrival", "closed_to_departure",
] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

const NUMBER_FIELDS: FieldKey[] = ["rate", "min_stay_arrival", "min_stay_through", "max_stay"];
const BOOLEAN_FIELDS: FieldKey[] = ["stop_sell", "closed_to_arrival", "closed_to_departure"];

const FIELD_LABEL_KEYS: Record<FieldKey, string> = {
  rate: "rateLabel",
  min_stay_arrival: "minStayArrivalLabel",
  min_stay_through: "minStayThroughLabel",
  max_stay: "maxStayLabel",
  stop_sell: "stopSellLabel",
  closed_to_arrival: "closedToArrivalLabel",
  closed_to_departure: "closedToDepartureLabel",
};

interface RateOverridesClientProps {
  roomTypes: RoomTypeOption[];
}

export default function RateOverridesClient({ roomTypes }: RateOverridesClientProps) {
  const t = useTranslations("rates");

  const [selectedRoomTypeIds, setSelectedRoomTypeIds] = useState<string[]>([]);
  const [selectedRatePlanIds, setSelectedRatePlanIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [enabledFields, setEnabledFields] = useState<Record<FieldKey, boolean>>({
    rate: false, min_stay_arrival: false, min_stay_through: false, max_stay: false,
    stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
  });
  const [fieldValues, setFieldValues] = useState<Record<FieldKey, string | boolean>>({
    rate: "", min_stay_arrival: "", min_stay_through: "", max_stay: "",
    stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listFrom, setListFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [listTo, setListTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  });

  const fetchOverrides = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const params = new URLSearchParams({ from: listFrom, to: listTo });
      const res = await fetch(`/api/room-types/rate-overrides?${params}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("toastListFailed"));
        return;
      }
      setOverrides(data.overrides);
    } catch (error) {
      toast.error(t("toastListFailed"));
      console.error(error);
    } finally {
      setIsLoadingList(false);
    }
  }, [listFrom, listTo, t]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  // Selecting a room type auto-selects its rate plans (just the default one
  // if that's all it has — matches today's UX for every org with one plan
  // per room type exactly). Deselecting a room type drops its rate plans
  // from the selection too.
  const toggleRoomType = (id: string) => {
    const roomType = roomTypes.find((rt) => rt.id === id);
    setSelectedRoomTypeIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next;
    });
    setSelectedRatePlanIds((prev) => {
      const planIds = roomType?.rate_plans.map((rp) => rp.id) ?? [];
      const alreadySelected = selectedRoomTypeIds.includes(id);
      if (alreadySelected) {
        return prev.filter((pid) => !planIds.includes(pid));
      }
      return [...prev, ...planIds];
    });
  };

  const toggleRatePlan = (id: string) => {
    setSelectedRatePlanIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleField = (key: FieldKey) => {
    setEnabledFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (selectedRatePlanIds.length === 0) {
      toast.error(t("errorNoRoomTypes"));
      return;
    }
    if (!dateFrom || !dateTo || dateTo < dateFrom) {
      toast.error(t("errorInvalidDates"));
      return;
    }
    const touchedKeys = FIELD_KEYS.filter((k) => enabledFields[k]);
    if (touchedKeys.length === 0) {
      toast.error(t("errorNoFields"));
      return;
    }

    const body: Record<string, unknown> = {
      rate_plan_ids: selectedRatePlanIds,
      date_from: dateFrom,
      date_to: dateTo,
    };
    for (const key of touchedKeys) {
      body[key] = NUMBER_FIELDS.includes(key) ? Number(fieldValues[key]) : !!fieldValues[key];
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/room-types/rate-overrides", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("toastSaveFailed"));
        return;
      }
      toast.success(t("toastSaved", { count: data.rows_written }));
      if (data.skipped_rate_plan_ids?.length > 0) {
        toast.warning(t("toastSkippedRoomTypes", { count: data.skipped_rate_plan_ids.length }));
      }

      const newListFrom = dateFrom < listFrom ? dateFrom : listFrom;
      const newListTo = dateTo > listTo ? dateTo : listTo;
      const windowChanged = newListFrom !== listFrom || newListTo !== listTo;
      if (newListFrom !== listFrom) setListFrom(newListFrom);
      if (newListTo !== listTo) setListTo(newListTo);
      if (!windowChanged) fetchOverrides();

      setEnabledFields({
        rate: false, min_stay_arrival: false, min_stay_through: false, max_stay: false,
        stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
      });
    } catch (error) {
      toast.error(t("toastSaveFailed"));
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearField = async (overrideId: string, field: FieldKey) => {
    try {
      const res = await fetch(`/api/room-types/rate-overrides/${overrideId}`, {
        method: "PATCH",
        body: JSON.stringify({ field }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("toastClearFailed"));
        return;
      }
      fetchOverrides();
    } catch (error) {
      toast.error(t("toastClearFailed"));
      console.error(error);
    }
  };

  const ratePlanLabel = (id: string) => {
    for (const rt of roomTypes) {
      const rp = rt.rate_plans.find((p) => p.id === id);
      if (rp) return rt.rate_plans.length > 1 ? `${rt.name} — ${rp.name}` : rt.name;
    }
    return id;
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">{t("formHeading")}</h2>

        <div>
          <label className="block text-sm font-medium mb-1">{t("roomTypesLabel")}</label>
          <div className="space-y-2">
            {roomTypes.map((rt) => (
              <div key={rt.id} className="border border-border rounded-lg px-3 py-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={selectedRoomTypeIds.includes(rt.id)} onChange={() => toggleRoomType(rt.id)} />
                  {rt.name}
                </label>
                {selectedRoomTypeIds.includes(rt.id) && rt.rate_plans.length > 1 && (
                  <div className="flex flex-wrap gap-3 mt-2 ml-6">
                    {rt.rate_plans.map((rp) => (
                      <label key={rp.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input type="checkbox" checked={selectedRatePlanIds.includes(rp.id)} onChange={() => toggleRatePlan(rp.id)} />
                        {rp.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("dateFromLabel")}</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("dateToLabel")}</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background" />
          </div>
        </div>

        <div className="space-y-3">
          {NUMBER_FIELDS.map((key) => (
            <div key={key} className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm w-44">
                <input type="checkbox" checked={enabledFields[key]} onChange={() => toggleField(key)} />
                {t(FIELD_LABEL_KEYS[key])}
              </label>
              <input
                type="number"
                step={key === "rate" ? "0.01" : "1"}
                min={key === "rate" ? "0" : "1"}
                disabled={!enabledFields[key]}
                value={fieldValues[key] as string}
                onChange={(e) => setFieldValues((p) => ({ ...p, [key]: e.target.value }))}
                className="px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50 w-40"
              />
            </div>
          ))}

          {BOOLEAN_FIELDS.map((key) => (
            <div key={key} className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm w-44">
                <input type="checkbox" checked={enabledFields[key]} onChange={() => toggleField(key)} />
                {t(FIELD_LABEL_KEYS[key])}
              </label>
              <input
                type="checkbox"
                disabled={!enabledFields[key]}
                checked={fieldValues[key] as boolean}
                onChange={(e) => setFieldValues((p) => ({ ...p, [key]: e.target.checked }))}
                className="disabled:opacity-50"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("saveButton")}
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">{t("listHeading")}</h2>
          <div className="flex items-center gap-2">
            <input type="date" value={listFrom} onChange={(e) => setListFrom(e.target.value)} className="px-2 py-1 border border-border rounded-lg bg-background text-sm" />
            <span className="text-sm text-muted-foreground">{t("toLabel")}</span>
            <input type="date" value={listTo} onChange={(e) => setListTo(e.target.value)} className="px-2 py-1 border border-border rounded-lg bg-background text-sm" />
          </div>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colDate")}</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colRoomType")}</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colField")}</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colValue")}</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingList ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  </td>
                </tr>
              ) : (
                overrides.flatMap((row) =>
                  FIELD_KEYS.filter((key) => row[key] !== null).map((key) => (
                    <tr key={`${row.id}-${key}`} className="border-b hover:bg-background">
                      <td className="px-4 py-2 text-sm">{row.date}</td>
                      <td className="px-4 py-2 text-sm">{ratePlanLabel(row.rate_plan_id)}</td>
                      <td className="px-4 py-2 text-sm">{t(FIELD_LABEL_KEYS[key])}</td>
                      <td className="px-4 py-2 text-sm">{String(row[key])}</td>
                      <td className="px-4 py-2 text-sm">
                        <button onClick={() => handleClearField(row.id, key)} className="p-1 hover:bg-red-100 text-red-600 rounded">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              )}
              {!isLoadingList && overrides.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {t("noneYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

Key UX decision: a room type with only its one default rate plan shows no
sub-picker at all (matches today's UI exactly, per the spec); a room type
with 2+ rate plans shows a checkbox row per plan, all pre-checked when the
room type is checked (so the common case — "apply to every rate plan on
this room type" — is still one click).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. This is the last file referencing the old field names.

- [ ] **Step 4: Manual verification**

With the dev server running: open Rates & Restrictions for an org whose
room type now has 2 rate plans (added via Task 11's dialog). Confirm the
sub-picker appears, both plans pre-checked; uncheck one, save with only
"Rate" checked — confirm (via Supabase) only the checked rate plan's
`room_type_rate_overrides` row was written. For an org with only
single-plan room types, confirm the page looks and behaves exactly as
before.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/[slug]/rates/page.tsx" src/components/rates/rate-overrides-client.tsx
git commit -m "feat: Rates & Restrictions page gains a rate-plan sub-picker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: i18n — new translation keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ar.json`, `messages/bn.json`, `messages/es.json`,
  `messages/fr.json`, `messages/hi.json`, `messages/ja.json`,
  `messages/pt.json`, `messages/ru.json`, `messages/sr.json`,
  `messages/zh.json`

- [ ] **Step 1: Add the new keys to `messages/en.json`**

Under the existing `rooms.types.dialog` object, add a `ratePlans` sub-object
and a `basePriceHintCreatesDefaultPlan` key:

```json
"basePriceHintCreatesDefaultPlan": "This creates the room type's first rate plan — add more from the edit screen.",
"ratePlans": {
  "heading": "Rate plans",
  "addNew": "Add rate plan",
  "defaultBadge": "default",
  "edit": "Edit",
  "namePlaceholder": "e.g. Bed & Breakfast",
  "confirmDelete": "Delete this rate plan? This can't be undone.",
  "errorNameAndPriceRequired": "Name and price are required",
  "toastSaved": "Rate plan updated",
  "toastSaveFailed": "Failed to update rate plan",
  "toastAdded": "Rate plan added",
  "toastAddFailed": "Failed to add rate plan",
  "toastDeleted": "Rate plan deleted",
  "toastDeleteFailed": "Failed to delete rate plan"
}
```

Under the existing `rates` namespace, no new keys are needed — the
rate-plan picker reuses existing labels (`roomTypesLabel`, etc.); only the
toast key name changed (`toastSkippedRoomTypes` stays as-is, it's generic
enough to read fine for rate plans too — not worth a rename that touches
every locale file for a cosmetic win).

- [ ] **Step 2: Mirror the same keys (English text) into the other 10 locale files**

For each of `ar.json`, `bn.json`, `es.json`, `fr.json`, `hi.json`,
`ja.json`, `pt.json`, `ru.json`, `sr.json`, `zh.json`: add the identical
`ratePlans` object and `basePriceHintCreatesDefaultPlan` key (English
placeholder text) under that locale's `rooms.types.dialog`. This matches
this feature area's existing precedent — the original rate-calendar PR
added English-only placeholder text across all 11 locales with real
translation deferred as a separate pass.

- [ ] **Step 3: Verify JSON validity**

Run: `for f in messages/*.json; do python3 -c "import json; json.load(open('$f'))" || echo "INVALID: $f"; done`
Expected: no output (every file parses).

- [ ] **Step 4: Commit**

```bash
git add messages/
git commit -m "feat: add rate-plan dialog translation keys (English placeholder across all locales)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, every test file including all new/modified ones from
Tasks 2, 4, 5, 6, 7, 8.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: clean, no errors anywhere.

- [ ] **Step 3: Manual end-to-end smoke test**

With the dev server running, as a manager on an org with a single-plan
room type:
1. Rates & Restrictions page loads and behaves exactly as before.
2. Room Types → edit a room type → add a second rate plan ("Bed &
   Breakfast", a different price) → save.
3. Return to Rates & Restrictions → that room type now shows both plans as
   checkboxes → set a date-specific rate on just the new plan → Apply.
4. Confirm via Supabase: exactly one new `room_type_rate_overrides` row,
   `rate_plan_id` pointing at the new plan, not the default one.
5. Trigger the outbox drain (`POST /api/channels/channex/outbox/process`
   as a manager) and confirm the push payload (via the returned
   `channexTaskIds`, cross-checked with a Channex readback) only contains
   the field that was actually checked.

- [ ] **Step 4: Confirm no regressions in the already-fixed membership-scoping bugs**

Run: `npx vitest run src/app/api/room-types/create/route.test.ts
src/app/api/room-types/[id]/route.test.ts` if those test files exist from
earlier work this session; otherwise this is covered by Step 1's full run.

---

## Next steps (not part of this plan — manual, after this ships)

Per the design spec's rollout plan: once this is live in production,
manually add the second ("Bed & Breakfast") rate plan to Twin Room and
Double Room on `test-property-hostmagsmart-channex` through the real UI
(Task 11's dialog), then re-run every Channex certification test using the
literal values from Channex's own doc table (room/rate-plan/date/amount —
not improvised ones), through the real UI, and update the certification
form with the new task IDs.
