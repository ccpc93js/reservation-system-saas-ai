# Per-date rate & restriction calendar implementation plan

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** Let staff set a rate/restriction override for a specific room type on a specific date (or date range), and have exactly one Channex API call go out per save — the missing piece for Channex certification Tests 2–8.

**架构：** A new `room_type_rate_overrides` table (one row per room-type/date, every field nullable = "inherit the room type's standing value"). `pushRatesForOrg` is rewritten to read standing values + overrides, compute the effective value per night, and run-length compress into the fewest `/restrictions` entries — still one `channex.pushRestrictions()` call per push. A bulk-edit form writes the override rows and enqueues one outbox push; the existing outbox worker does the rest unchanged.

**技术栈：** Next.js App Router, TypeScript, Supabase (Postgres + RLS), Vitest, react-hook-form + yup (existing room type form only — the new bulk-edit form uses plain `useState`, see Task 15), next-intl.

Spec: [docs/superpowers/specs/2026-09-14-rate-calendar-design.md](../specs/2026-09-14-rate-calendar-design.md)

---

## File structure

- **Create** `supabase/migrations/20260914_channex_rate_overrides.sql` — new table + `room_types.max_stay` column
- **Modify** `src/lib/channels/channex.ts` — add `max_stay` to `RestrictionValue`
- **Modify** `src/lib/test/fake-supabase.ts` — add `.gte()`/`.lte()` to the fake query builder
- **Modify** `src/lib/channels/channex-rates.ts` — rewrite `pushRatesForOrg` to read overrides, compute effective per-night values, compress, push to every mapped rate plan
- **Modify** `src/lib/channels/channex-rates.test.ts` — new coverage for overrides/compression/max_stay/multi-rate-plan
- **Create** `src/lib/rate-overrides.ts` — `applyRateOverrides` (bulk upsert + enqueue) and `clearRateOverrideField`
- **Create** `src/lib/rate-overrides.test.ts`
- **Create** `src/lib/validations/rate-override.ts` — yup schema for the bulk-edit payload
- **Modify** `src/lib/validations/room.ts` — add `max_stay` to the room type schemas
- **Modify** `src/app/api/room-types/create/route.ts` — persist `max_stay` on create
- **Modify** `src/app/api/room-types/[id]/route.ts` — persist `max_stay` on update, include it in the restriction-change trigger
- **Modify** `src/components/rooms/room-types-dialog.tsx` — add a Max Stay field
- **Create** `src/app/api/room-types/rate-overrides/route.ts` — `GET` (list) / `POST` (bulk apply)
- **Create** `src/app/api/room-types/rate-overrides/route.test.ts`
- **Create** `src/app/api/room-types/rate-overrides/[id]/route.ts` — `PATCH` (clear one field)
- **Create** `src/app/api/room-types/rate-overrides/[id]/route.test.ts`
- **Modify** `messages/*.json` (all 11 locale files) — new `rates` namespace, `sidebar.nav.rates`, `rooms.types.dialog.maxStayLabel`
- **Modify** `src/lib/permissions.ts` — gate the new `rates` section to managers
- **Modify** `src/components/layout/sidebar.tsx` — nav entry
- **Create** `src/components/rates/rate-overrides-client.tsx` — bulk-edit form + overrides list
- **Create** `src/app/[locale]/[slug]/rates/page.tsx` — SSR wrapper

---

### Task 1: Migration — `room_type_rate_overrides` table + `room_types.max_stay`

**Files:**
- Create: `supabase/migrations/20260914_channex_rate_overrides.sql`
- Modify: `src/lib/types/database.ts` (regenerated, not hand-edited — see Step 4)

- [ ] **Step 1: Write the migration**

```sql
create table if not exists public.room_type_rate_overrides (
  id uuid default uuid_generate_v4() not null,
  organization_id uuid not null,
  room_type_id uuid not null,
  date date not null,
  rate numeric,
  min_stay_arrival integer check (min_stay_arrival is null or min_stay_arrival > 0),
  min_stay_through integer check (min_stay_through is null or min_stay_through > 0),
  max_stay integer check (max_stay is null or max_stay > 0),
  stop_sell boolean,
  closed_to_arrival boolean,
  closed_to_departure boolean,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint room_type_rate_overrides_pkey primary key (id),
  constraint room_type_rate_overrides_org_fkey
    foreign key (organization_id) references organizations(id) on delete cascade,
  constraint room_type_rate_overrides_room_type_fkey
    foreign key (room_type_id) references room_types(id) on delete cascade,
  constraint room_type_rate_overrides_unique
    unique (room_type_id, date)
);

alter table public.room_type_rate_overrides enable row level security;

create policy room_type_rate_overrides_org_access on public.room_type_rate_overrides
  for all
  using (organization_id in (
    select memberships.organization_id from memberships where memberships.user_id = auth.uid()
  ));

create index if not exists idx_room_type_rate_overrides_org
  on public.room_type_rate_overrides (organization_id);
create index if not exists idx_room_type_rate_overrides_lookup
  on public.room_type_rate_overrides (room_type_id, date);

comment on table public.room_type_rate_overrides is 'Per-date rate/restriction overrides. Null field = inherit the room type''s standing value (base_price / stop_sell / etc). Compressed into date ranges only when pushed to Channex.';

alter table public.room_types
  add column max_stay integer check (max_stay is null or max_stay > 0);

comment on column public.room_types.max_stay is 'Channex ARI: maximum nights allowed for a stay. Null = no restriction.';

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply it against the remote project**

This repo has no local Supabase CLI/config — every prior Channex migration was applied directly against the remote project. Use the `mcp__supabase__apply_migration` tool with `name: "channex_rate_overrides"` and the SQL above as `query`.

- [ ] **Step 3: Verify**

Use `mcp__supabase__list_tables` (schemas: `["public"]`) and confirm `room_type_rate_overrides` is listed and `room_types` now has a `max_stay` column.

- [ ] **Step 4: Regenerate TypeScript types**

`src/lib/types/database.ts` is generated — don't hand-edit it. Use `mcp__supabase__generate_typescript_types` and overwrite `src/lib/types/database.ts` with the result.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260914_channex_rate_overrides.sql src/lib/types/database.ts
git commit -m "feat: add room_type_rate_overrides table and room_types.max_stay column"
```

---

### Task 2: `channex.ts` — add `max_stay` to `RestrictionValue`

**Files:**
- Modify: `src/lib/channels/channex.ts:257-270`

- [ ] **Step 1: Add the field**

In the `RestrictionValue` interface, add `max_stay` alongside the other restriction fields:

```ts
export interface RestrictionValue {
  property_id: string;
  rate_plan_id: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  rate?: number; // cents (per_room)
  rates?: { occupancy: number; rate: number }[]; // per_person
  min_stay_arrival?: number;
  min_stay_through?: number;
  max_stay?: number;
  stop_sell?: boolean;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes (this is a pure type addition, nothing consumes it yet).

- [ ] **Step 3: Commit**

```bash
git add src/lib/channels/channex.ts
git commit -m "feat: add max_stay to Channex RestrictionValue"
```

---

### Task 3: `fake-supabase.ts` — add `.gte()`/`.lte()`

**Files:**
- Modify: `src/lib/test/fake-supabase.ts:32-59` (the `FakeQueryBuilder` class)
- Test: `src/lib/test/fake-supabase.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/test/fake-supabase.test.ts`:

```ts
  it("gte/lte filter by comparison", async () => {
    const db = new FakeSupabaseClient();
    db.seed("nights", [{ date: "2026-07-01" }, { date: "2026-07-05" }, { date: "2026-07-10" }]);
    const { data } = await db.from("nights").select("*").gte("date", "2026-07-02").lte("date", "2026-07-08");
    expect(data).toEqual([{ date: "2026-07-05" }]);
  });
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run src/lib/test/fake-supabase.test.ts -t "gte/lte"`
Expected: FAIL — `db.from(...).gte is not a function`

- [ ] **Step 3: Implement**

In `FakeQueryBuilder`, add next to the existing `in()` method:

```ts
  gte(col: string, val: any) {
    this.filters.push((row) => row[col] != null && row[col] >= val);
    return this;
  }
  lte(col: string, val: any) {
    this.filters.push((row) => row[col] != null && row[col] <= val);
    return this;
  }
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run src/lib/test/fake-supabase.test.ts -t "gte/lte"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/test/fake-supabase.ts src/lib/test/fake-supabase.test.ts
git commit -m "test: add gte/lte support to FakeSupabaseClient"
```

---

### Task 4: `channex-rates.ts` — read overrides, compute effective values, compress

**Files:**
- Modify: `src/lib/channels/channex-rates.ts` (whole file rewritten)
- Test: `src/lib/channels/channex-rates.test.ts`

This task changes `pushRatesForOrg` from "one flat value across the whole window" to "per-night effective value, run-length compressed." Existing tests in `channex-rates.test.ts` must keep passing unchanged (no overrides seeded → same flat behavior as before) — that's the regression check before adding new coverage.

- [ ] **Step 1: Run the existing tests, confirm current baseline passes**

Run: `npx vitest run src/lib/channels/channex-rates.test.ts`
Expected: PASS (3 tests) — this is the pre-change baseline.

- [ ] **Step 2: Write the new failing tests**

Add these to `src/lib/channels/channex-rates.test.ts`, inside the existing `describe("pushRatesForOrg", ...)` block (after the last existing `it`):

```ts
  it("an override's rate wins over base_price for its date; other dates fall back", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, room_type_id: "rt-1", date: "2026-07-02", rate: 333, min_stay_arrival: null, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-04" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toEqual([
      { property_id: "prop-1", rate_plan_id: "rp-rt-1", date_from: "2026-07-01", date_to: "2026-07-01", rate: 10000, stop_sell: false, closed_to_arrival: false, closed_to_departure: false },
      { property_id: "prop-1", rate_plan_id: "rp-rt-1", date_from: "2026-07-02", date_to: "2026-07-02", rate: 33300, stop_sell: false, closed_to_arrival: false, closed_to_departure: false },
      { property_id: "prop-1", rate_plan_id: "rp-rt-1", date_from: "2026-07-03", date_to: "2026-07-03", rate: 10000, stop_sell: false, closed_to_arrival: false, closed_to_departure: false },
    ]);
  });

  it("an override that only sets rate leaves restriction fields inherited from the room type", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: true, closed_to_departure: false, min_stay_arrival: 2, min_stay_through: null, max_stay: null },
    ]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, room_type_id: "rt-1", date: "2026-07-01", rate: 333, min_stay_arrival: null, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).toEqual({
      property_id: "prop-1", rate_plan_id: "rp-rt-1", date_from: "2026-07-01", date_to: "2026-07-01",
      rate: 33300, stop_sell: false, closed_to_arrival: true, closed_to_departure: false, min_stay_arrival: 2,
    });
  });

  it("compresses consecutive identical nights into one entry per room type", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
      { id: "rt-2", base_price: 200, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-11" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toHaveLength(2);
    expect(values.find((v: any) => v.rate_plan_id === "rp-rt-1")).toMatchObject({ date_from: "2026-07-01", date_to: "2026-07-10", rate: 10000 });
    expect(values.find((v: any) => v.rate_plan_id === "rp-rt-2")).toMatchObject({ date_from: "2026-07-01", date_to: "2026-07-10", rate: 20000 });
  });

  it("includes max_stay when set (override or standing) and omits it when neither sets it", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: 14 },
    ]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, room_type_id: "rt-1", date: "2026-07-02", rate: null, min_stay_arrival: null, min_stay_through: null, max_stay: 3, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-03" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).toMatchObject({ date_from: "2026-07-01", date_to: "2026-07-01", max_stay: 14 });
    expect(values[1]).toMatchObject({ date_from: "2026-07-02", date_to: "2026-07-02", max_stay: 3 });
  });

  it("omits max_stay entirely when neither override nor standing value sets it", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      { id: "rt-1", base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);
    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });
    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).not.toHaveProperty("max_stay");
  });

  it("pushes the same effective values to every rate plan mapped to a room type", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      { kind: "rate_plan", local_id: "rt-1", channex_id: "rp-bar", organization_id: orgId },
      { kind: "rate_plan", local_id: "rt-1", channex_id: "rp-bnb", organization_id: orgId },
    ]);
    db.seed("room_types", [
      { id: "rt-1", organization_id: orgId, base_price: 100, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null, max_stay: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values.map((v: any) => v.rate_plan_id).sort()).toEqual(["rp-bar", "rp-bnb"]);
    expect(values.every((v: any) => v.date_from === "2026-07-01" && v.date_to === "2026-07-01" && v.rate === 10000)).toBe(true);
  });
```

- [ ] **Step 3: Run the new tests, confirm they fail**

Run: `npx vitest run src/lib/channels/channex-rates.test.ts`
Expected: FAIL — current implementation ignores `room_type_rate_overrides` entirely and only supports one rate plan per room type.

- [ ] **Step 4: Rewrite `pushRatesForOrg`**

Replace the entire contents of `src/lib/channels/channex-rates.ts` with:

```ts
// Channex rate + restriction push. Reads each room type's standing defaults
// (rate, stop_sell, closed_to_arrival/departure, min_stay_arrival/through,
// max_stay) plus any per-date overrides in room_type_rate_overrides, computes
// the effective value per night, and run-length compresses consecutive
// nights with identical values into the fewest possible /restrictions
// entries. /restrictions is a partial update: a field omitted from an entry
// leaves whatever Channex already has for that date untouched rather than
// clearing it, so min-stay/max-stay fields are only included when a value is
// set. Pushed to every rate plan mapped to a room type (usually one; a room
// type mapped to multiple Channex rate plans receives the same values on
// each — see docs/superpowers/specs/2026-09-14-rate-calendar-design.md).
// Never sends past dates.

import type { SupabaseClient } from "@supabase/supabase-js";
import { channex, toChannexMinor, type RestrictionValue } from "./channex";

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
  roomTypeLocalIds?: string[];
}

export interface PushRatesResult {
  ok: boolean;
  propertyId: string | null;
  ratePlansPushed: number;
  entries: number;
  skipped?: string;
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

function sameValues(a: EffectiveValues, b: EffectiveValues): boolean {
  return (
    a.rate === b.rate &&
    a.stop_sell === b.stop_sell &&
    a.closed_to_arrival === b.closed_to_arrival &&
    a.closed_to_departure === b.closed_to_departure &&
    a.min_stay_arrival === b.min_stay_arrival &&
    a.min_stay_through === b.min_stay_through &&
    a.max_stay === b.max_stay
  );
}

function toRestrictionFields(
  v: EffectiveValues
): Omit<RestrictionValue, "property_id" | "rate_plan_id" | "date_from" | "date_to"> {
  return {
    rate: toChannexMinor(v.rate),
    stop_sell: v.stop_sell,
    closed_to_arrival: v.closed_to_arrival,
    closed_to_departure: v.closed_to_departure,
    ...(v.min_stay_arrival != null ? { min_stay_arrival: v.min_stay_arrival } : {}),
    ...(v.min_stay_through != null ? { min_stay_through: v.min_stay_through } : {}),
    ...(v.max_stay != null ? { max_stay: v.max_stay } : {}),
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

  // local room_type id -> ALL mapped channex rate plan ids (usually one).
  const rpMap = new Map<string, string[]>();
  for (const r of rows) {
    if (r.kind !== "rate_plan") continue;
    const list = rpMap.get(r.local_id) ?? [];
    list.push(r.channex_id);
    rpMap.set(r.local_id, list);
  }
  if (rpMap.size === 0) return { ok: false, propertyId, ratePlansPushed: 0, entries: 0, skipped: "no mapped rate plans" };

  const from = opts.from && opts.from > todayISO() ? opts.from : todayISO();
  const toExclusive = opts.to ?? addDaysISO(from, opts.horizonDays ?? 500);
  const lastNight = addDaysISO(toExclusive, -1);
  if (lastNight < from) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "empty window" };

  const { data: roomTypes } = await supabase
    .from("room_types")
    .select("id, base_price, stop_sell, closed_to_arrival, closed_to_departure, min_stay_arrival, min_stay_through, max_stay")
    .eq("organization_id", orgId);

  const filter = opts.roomTypeLocalIds ? new Set(opts.roomTypeLocalIds) : null;
  const roomTypeRows = ((roomTypes as any[]) ?? []).filter((rt) => rpMap.has(rt.id) && (!filter || filter.has(rt.id)));
  if (roomTypeRows.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  const { data: overrides } = await supabase
    .from("room_type_rate_overrides")
    .select("room_type_id, date, rate, min_stay_arrival, min_stay_through, max_stay, stop_sell, closed_to_arrival, closed_to_departure")
    .eq("organization_id", orgId)
    .in("room_type_id", roomTypeRows.map((rt) => rt.id))
    .gte("date", from)
    .lte("date", lastNight);

  const overrideMap = new Map<string, any>(); // `${room_type_id}:${date}` -> row
  for (const o of (overrides as any[]) ?? []) overrideMap.set(`${o.room_type_id}:${o.date}`, o);

  const values: RestrictionValue[] = [];
  let ratePlansPushed = 0;

  for (const rt of roomTypeRows) {
    let runStart: string | null = null;
    let runValues: EffectiveValues | null = null;

    const flush = (endExclusive: string) => {
      if (runStart == null || runValues == null) return;
      const fields = toRestrictionFields(runValues);
      for (const ratePlanId of rpMap.get(rt.id)!) {
        values.push({
          property_id: propertyId,
          rate_plan_id: ratePlanId,
          date_from: runStart,
          date_to: addDaysISO(endExclusive, -1),
          ...fields,
        });
      }
    };

    let cursor = from;
    while (cursor <= lastNight) {
      const o = overrideMap.get(`${rt.id}:${cursor}`);
      const effective: EffectiveValues = {
        rate: o?.rate ?? rt.base_price ?? 0,
        stop_sell: o?.stop_sell ?? rt.stop_sell ?? false,
        closed_to_arrival: o?.closed_to_arrival ?? rt.closed_to_arrival ?? false,
        closed_to_departure: o?.closed_to_departure ?? rt.closed_to_departure ?? false,
        min_stay_arrival: o?.min_stay_arrival ?? rt.min_stay_arrival ?? null,
        min_stay_through: o?.min_stay_through ?? rt.min_stay_through ?? null,
        max_stay: o?.max_stay ?? rt.max_stay ?? null,
      };

      if (runValues && sameValues(runValues, effective)) {
        cursor = addDaysISO(cursor, 1);
        continue;
      }
      flush(cursor);
      runStart = cursor;
      runValues = effective;
      cursor = addDaysISO(cursor, 1);
    }
    flush(cursor);

    ratePlansPushed += rpMap.get(rt.id)!.length;
  }

  if (values.length === 0) return { ok: true, propertyId, ratePlansPushed: 0, entries: 0, skipped: "nothing to push" };

  await channex.pushRestrictions(values);
  return { ok: true, propertyId, ratePlansPushed, entries: values.length };
}
```

- [ ] **Step 5: Run all `channex-rates.test.ts` tests, confirm all pass**

Run: `npx vitest run src/lib/channels/channex-rates.test.ts`
Expected: PASS — all 3 pre-existing tests (unchanged behavior with no overrides seeded) plus the 6 new tests from Step 2.

- [ ] **Step 6: Commit**

```bash
git add src/lib/channels/channex-rates.ts src/lib/channels/channex-rates.test.ts
git commit -m "feat: push per-date rate/restriction overrides, compressed, to every mapped rate plan"
```

---

### Task 5: `src/lib/rate-overrides.ts` — bulk apply + clear-field

**Files:**
- Create: `src/lib/rate-overrides.ts`
- Test: `src/lib/rate-overrides.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/rate-overrides.test.ts`:

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
  it("writes one row per room type per date in range, touching only the given fields", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_types", [{ id: "rt-1", organization_id: orgId }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      roomTypeIds: ["rt-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(result).toEqual({ ok: true, rowsWritten: 1 });
    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({
      room_type_id: "rt-1",
      date: "2026-11-21",
      rate: 333,
      min_stay_arrival: null,
    });
    expect(enqueueRestrictions).toHaveBeenCalledWith(db, orgId, "2026-11-21", "2026-11-22", ["rt-1"]);
  });

  it("preserves untouched fields on an existing row", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_types", [{ id: "rt-1", organization_id: orgId }]);
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, room_type_id: "rt-1", date: "2026-11-21", rate: 100, min_stay_arrival: 2, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      roomTypeIds: ["rt-1"],
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      fields: { rate: 333 },
    });

    expect(db.tables.room_type_rate_overrides).toHaveLength(1);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ rate: 333, min_stay_arrival: 2 });
  });

  it("expands a multi-date range into one row per date", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_types", [{ id: "rt-1", organization_id: orgId }]);

    await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      roomTypeIds: ["rt-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-03",
      fields: { stop_sell: true },
    });

    expect(db.tables.room_type_rate_overrides.map((r: any) => r.date).sort()).toEqual([
      "2026-11-01", "2026-11-02", "2026-11-03",
    ]);
  });

  it("rejects room types that don't belong to the org", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_types", [{ id: "rt-1", organization_id: "other-org" }]);

    const result = await applyRateOverrides(db as unknown as SupabaseClient, orgId, {
      roomTypeIds: ["rt-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-01",
      fields: { rate: 100 },
    });

    expect(result.ok).toBe(false);
    expect(db.tables.room_type_rate_overrides ?? []).toHaveLength(0);
  });
});

describe("clearRateOverrideField", () => {
  it("nulls just the given field and enqueues a push for that date", async () => {
    const db = new FakeSupabaseClient();
    db.seed("room_type_rate_overrides", [
      { id: "ov-1", organization_id: orgId, room_type_id: "rt-1", date: "2026-11-21", rate: 333, min_stay_arrival: 2, min_stay_through: null, max_stay: null, stop_sell: null, closed_to_arrival: null, closed_to_departure: null },
    ]);

    const result = await clearRateOverrideField(db as unknown as SupabaseClient, orgId, "ov-1", "rate");

    expect(result.ok).toBe(true);
    expect(db.tables.room_type_rate_overrides[0]).toMatchObject({ rate: null, min_stay_arrival: 2 });
    expect(enqueueRestrictions).toHaveBeenCalledWith(db, orgId, "2026-11-21", "2026-11-22", ["rt-1"]);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run src/lib/rate-overrides.test.ts`
Expected: FAIL — `src/lib/rate-overrides.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/lib/rate-overrides.ts`:

```ts
// Business logic behind the "Rates & Restrictions" bulk-edit form: writes
// per-date overrides for one or more room types over a date range, merging
// only the fields the caller actually touched, then enqueues a single
// Channex restrictions push covering the whole scope of the edit.

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
  roomTypeIds: string[];
  dateFrom: string; // inclusive
  dateTo: string; // inclusive
  fields: RateOverrideFields;
}

export interface ApplyRateOverridesResult {
  ok: boolean;
  rowsWritten: number;
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
  const { roomTypeIds, dateFrom, dateTo, fields } = input;
  const touchedKeys = OVERRIDE_FIELD_KEYS.filter((k) => fields[k] !== undefined);
  if (roomTypeIds.length === 0 || touchedKeys.length === 0 || dateTo < dateFrom) {
    return { ok: false, rowsWritten: 0, error: "invalid input" };
  }

  // Only touch room types that actually belong to this org.
  const { data: owned } = await supabase
    .from("room_types")
    .select("id")
    .eq("organization_id", orgId)
    .in("id", roomTypeIds);
  const ownedIds = new Set(((owned as { id: string }[]) ?? []).map((r) => r.id));
  const validRoomTypeIds = roomTypeIds.filter((id) => ownedIds.has(id));
  if (validRoomTypeIds.length === 0) return { ok: false, rowsWritten: 0, error: "no matching room types" };

  const dates = dateRangeInclusive(dateFrom, dateTo);

  // Fetch existing rows in scope once, so untouched fields on a row survive
  // the merge (a single upsert call, not one round trip per date).
  const { data: existing } = await supabase
    .from("room_type_rate_overrides")
    .select("id, room_type_id, date, rate, min_stay_arrival, min_stay_through, max_stay, stop_sell, closed_to_arrival, closed_to_departure")
    .eq("organization_id", orgId)
    .in("room_type_id", validRoomTypeIds)
    .gte("date", dateFrom)
    .lte("date", dateTo);
  const existingMap = new Map<string, any>();
  for (const row of (existing as any[]) ?? []) existingMap.set(`${row.room_type_id}:${row.date}`, row);

  const upsertRows: Record<string, unknown>[] = [];
  for (const roomTypeId of validRoomTypeIds) {
    for (const date of dates) {
      const prior = existingMap.get(`${roomTypeId}:${date}`);
      const row: Record<string, unknown> = {
        organization_id: orgId,
        room_type_id: roomTypeId,
        date,
        rate: prior?.rate ?? null,
        min_stay_arrival: prior?.min_stay_arrival ?? null,
        min_stay_through: prior?.min_stay_through ?? null,
        max_stay: prior?.max_stay ?? null,
        stop_sell: prior?.stop_sell ?? null,
        closed_to_arrival: prior?.closed_to_arrival ?? null,
        closed_to_departure: prior?.closed_to_departure ?? null,
        updated_at: new Date().toISOString(),
      };
      for (const key of touchedKeys) row[key] = fields[key];
      upsertRows.push(row);
    }
  }

  const { error } = await supabase
    .from("room_type_rate_overrides")
    .upsert(upsertRows, { onConflict: "room_type_id,date" });
  if (error) return { ok: false, rowsWritten: 0, error: error.message };

  await enqueueRestrictions(supabase, orgId, dateFrom, addDaysISO(dateTo, 1), validRoomTypeIds);

  return { ok: true, rowsWritten: upsertRows.length };
}

export async function clearRateOverrideField(
  supabase: SupabaseClient,
  orgId: string,
  overrideId: string,
  field: OverrideFieldKey
): Promise<{ ok: boolean; error?: string }> {
  const { data: row, error: fetchError } = await supabase
    .from("room_type_rate_overrides")
    .select("id, room_type_id, date")
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
  await enqueueRestrictions(supabase, orgId, date, addDaysISO(date, 1), [(row as any).room_type_id]);
  return { ok: true };
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run src/lib/rate-overrides.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-overrides.ts src/lib/rate-overrides.test.ts
git commit -m "feat: add applyRateOverrides and clearRateOverrideField"
```

---

### Task 6: `src/lib/validations/rate-override.ts` — yup schema

**Files:**
- Create: `src/lib/validations/rate-override.ts`
- Modify: `src/lib/validations/room.ts:15-21, 28-31` (add `max_stay`)

- [ ] **Step 1: Add `max_stay` to the room type schemas**

In `src/lib/validations/room.ts`, in `createRoomTypeSchema`, add this line next to `min_stay_through`:

```ts
  max_stay: optionalNumber().min(1, "Max stay must be at least 1 night"),
```

`updateRoomTypeSchema` extends `createRoomTypeSchema` with `.shape({...})` and doesn't re-declare `min_stay_arrival`/`min_stay_through`/`stop_sell`/etc — `max_stay` needs no extra entry there either; it inherits the optional field from the base schema.

- [ ] **Step 2: Create the bulk-edit schema**

Create `src/lib/validations/rate-override.ts`:

```ts
import * as yup from "yup";

const optionalNumber = () =>
  yup
    .number()
    .transform((value, original) =>
      original === "" || original === null || original === undefined || Number.isNaN(value) ? undefined : value
    )
    .optional();

const FIELD_KEYS = [
  "rate",
  "min_stay_arrival",
  "min_stay_through",
  "max_stay",
  "stop_sell",
  "closed_to_arrival",
  "closed_to_departure",
] as const;

export const applyRateOverridesSchema = yup
  .object()
  .shape({
    room_type_ids: yup.array().of(yup.string().required()).min(1, "Select at least one room type").required(),
    date_from: yup.string().required("Start date is required"),
    date_to: yup
      .string()
      .required("End date is required")
      .test("after-from", "End date must be on or after start date", function (value) {
        return !value || !this.parent.date_from || value >= this.parent.date_from;
      }),
    rate: optionalNumber().min(0.01, "Rate must be greater than 0"),
    min_stay_arrival: optionalNumber().min(1, "Min stay must be at least 1 night"),
    min_stay_through: optionalNumber().min(1, "Min stay must be at least 1 night"),
    max_stay: optionalNumber().min(1, "Max stay must be at least 1 night"),
    stop_sell: yup.boolean().optional(),
    closed_to_arrival: yup.boolean().optional(),
    closed_to_departure: yup.boolean().optional(),
  })
  .test("at-least-one-field", "Set at least one field to apply", (value) =>
    FIELD_KEYS.some((k) => (value as Record<string, unknown> | undefined)?.[k] !== undefined)
  );
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations/rate-override.ts src/lib/validations/room.ts
git commit -m "feat: add max_stay and rate-override validation schemas"
```

---

### Task 7: Room type standing `max_stay` — routes + dialog UI

**Files:**
- Modify: `src/app/api/room-types/create/route.ts:44-62`
- Modify: `src/app/api/room-types/[id]/route.ts:124-168`
- Modify: `src/components/rooms/room-types-dialog.tsx:47-108, 333-364`

- [ ] **Step 1: Persist `max_stay` on create**

In `src/app/api/room-types/create/route.ts`, add `max_stay: body.max_stay ?? null,` to the `.insert({...})` call, next to `min_stay_through`.

- [ ] **Step 2: Persist `max_stay` on update, include it in the restriction-change trigger**

In `src/app/api/room-types/[id]/route.ts`:

Add this line next to the other `updateData` assignments (after the `min_stay_through` line):

```ts
    if (body.max_stay !== undefined) updateData.max_stay = body.max_stay ?? null;
```

And add `"max_stay"` to the `restrictionFieldsChanged` array:

```ts
    const restrictionFieldsChanged = [
      "base_price",
      "stop_sell",
      "closed_to_arrival",
      "closed_to_departure",
      "min_stay_arrival",
      "min_stay_through",
      "max_stay",
    ].some((field) => body[field] !== undefined);
```

- [ ] **Step 3: Add the field to the dialog's form state**

In `src/components/rooms/room-types-dialog.tsx`, add `max_stay: null,` to all three places `min_stay_through: null,` appears (the `useForm` `defaultValues`, the blank-form `reset()` in the `useEffect`, and the `reset()` inside `fetchRoomType`) — same key, same default, right after each `min_stay_through` line.

- [ ] **Step 4: Add the input**

In the "Channel restrictions" section, after the `min_stay_arrival`/`min_stay_through` `grid-cols-2` block, add:

```tsx
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("maxStayLabel")}</label>
                  <input
                    type="number"
                    min="1"
                    {...register("max_stay", { valueAsNumber: true })}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      errors.max_stay ? "border-red-500" : "border-border"
                    } disabled:opacity-50`}
                    disabled={isLoading || isDeleting}
                  />
                  {errors.max_stay && (
                    <p className="text-red-500 text-sm mt-1">{errors.max_stay.message}</p>
                  )}
                </div>
              </div>
```

(The `maxStayLabel` translation key is added in Task 11, across all locale files.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: passes once Task 11 adds the `maxStayLabel` key (translation keys aren't type-checked, so this step actually just confirms no TS errors from the JS/TS changes above).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/room-types/create/route.ts src/app/api/room-types/[id]/route.ts src/components/rooms/room-types-dialog.tsx
git commit -m "feat: support max_stay as a standing room type restriction"
```

---

### Task 8: API route — `GET`/`POST /api/room-types/rate-overrides`

**Files:**
- Create: `src/app/api/room-types/rate-overrides/route.ts`
- Test: `src/app/api/room-types/rate-overrides/route.test.ts`

This route has no established test pattern to follow — no `src/app/api/**/*.test.ts` exists anywhere yet — so this task introduces one: mock `@/lib/supabase/server` to return a `FakeSupabaseClient` with an `auth.getUser()` bolted on, mock `@/lib/rate-overrides` so only the route's own wiring (auth, role gate, validation, response shape) is under test, not `applyRateOverrides`'s internals (already covered by Task 5).

- [ ] **Step 1: Implement**

```ts
import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { applyRateOverridesSchema } from "@/lib/validations/rate-override";
import { applyRateOverrides, OVERRIDE_FIELD_KEYS } from "@/lib/rate-overrides";

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!membership) {
      return Response.json({ error: "You don't have access to any organization" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) return Response.json({ error: "from and to are required" }, { status: 400 });

    const { data, error } = await supabase
      .from("room_type_rate_overrides")
      .select("*")
      .eq("organization_id", (membership as any).organization_id)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true });

    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ overrides: data ?? [] });
  } catch (error) {
    console.error("Error listing rate overrides:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();
    if (!membership || !isManager((membership as any).role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    try {
      await applyRateOverridesSchema.validate(body);
    } catch (validationError: any) {
      return Response.json({ error: validationError.message }, { status: 400 });
    }

    const fields: Record<string, unknown> = {};
    for (const key of OVERRIDE_FIELD_KEYS) {
      if (body[key] !== undefined) fields[key] = body[key];
    }

    const result = await applyRateOverrides(supabase, (membership as any).organization_id, {
      roomTypeIds: body.room_type_ids,
      dateFrom: body.date_from,
      dateTo: body.date_to,
      fields,
    });

    if (!result.ok) return Response.json({ error: result.error || "Failed to apply overrides" }, { status: 400 });
    return Response.json({ success: true, rows_written: result.rowsWritten });
  } catch (error) {
    console.error("Error applying rate overrides:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the route tests**

Create `src/app/api/room-types/rate-overrides/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
let currentUser: { id: string } | null = { id: "user-1" };

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => {
    (db as any).auth = {
      getUser: async () => ({ data: { user: currentUser }, error: currentUser ? null : { message: "no user" } }),
    };
    return db;
  },
}));

vi.mock("@/lib/rate-overrides", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-overrides")>();
  return { ...actual, applyRateOverrides: vi.fn() };
});

import { applyRateOverrides } from "@/lib/rate-overrides";
import { GET, POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/rate-overrides", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/room-types/rate-overrides", () => {
  beforeEach(() => {
    db.tables = {};
    currentUser = { id: "user-1" };
    vi.mocked(applyRateOverrides).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    currentUser = null;
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a staff member", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await POST(jsonRequest({ room_type_ids: ["rt-1"], date_from: "2026-11-01", date_to: "2026-11-01", rate: 100 }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when the payload fails validation", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await POST(jsonRequest({ room_type_ids: [], date_from: "2026-11-01", date_to: "2026-11-01", rate: 100 }));
    expect(res.status).toBe(400);
    expect(applyRateOverrides).not.toHaveBeenCalled();
  });

  it("calls applyRateOverrides with only the touched fields for a manager", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    vi.mocked(applyRateOverrides).mockResolvedValue({ ok: true, rowsWritten: 2 });

    const res = await POST(jsonRequest({ room_type_ids: ["rt-1"], date_from: "2026-11-01", date_to: "2026-11-02", rate: 333 }));

    expect(res.status).toBe(200);
    expect(applyRateOverrides).toHaveBeenCalledWith(expect.anything(), "org-1", {
      roomTypeIds: ["rt-1"],
      dateFrom: "2026-11-01",
      dateTo: "2026-11-02",
      fields: { rate: 333 },
    });
  });
});

describe("GET /api/room-types/rate-overrides", () => {
  beforeEach(() => {
    db.tables = {};
    currentUser = { id: "user-1" };
  });

  it("returns 400 without from/to", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await GET(new Request("http://localhost/api/room-types/rate-overrides"));
    expect(res.status).toBe(400);
  });

  it("is readable by staff (read-only, not manager-gated)", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    db.seed("room_type_rate_overrides", [{ id: "ov-1", organization_id: "org-1", date: "2026-11-01" }]);
    const res = await GET(new Request("http://localhost/api/room-types/rate-overrides?from=2026-11-01&to=2026-11-30"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.overrides).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the tests, confirm they pass**

Run: `npx vitest run src/app/api/room-types/rate-overrides/route.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/room-types/rate-overrides/route.ts src/app/api/room-types/rate-overrides/route.test.ts
git commit -m "feat: add GET/POST /api/room-types/rate-overrides"
```

---

### Task 9: API route — `PATCH /api/room-types/rate-overrides/[id]`

**Files:**
- Create: `src/app/api/room-types/rate-overrides/[id]/route.ts`
- Test: `src/app/api/room-types/rate-overrides/[id]/route.test.ts`

- [ ] **Step 1: Implement**

```ts
import { createServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";
import { clearRateOverrideField, OVERRIDE_FIELD_KEYS, type OverrideFieldKey } from "@/lib/rate-overrides";

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
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();
    if (!membership || !isManager((membership as any).role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const field = body.field as OverrideFieldKey;
    if (!OVERRIDE_FIELD_KEYS.includes(field)) {
      return Response.json({ error: "Invalid field" }, { status: 400 });
    }

    const result = await clearRateOverrideField(supabase, (membership as any).organization_id, id, field);
    if (!result.ok) return Response.json({ error: result.error || "Failed to clear field" }, { status: 400 });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error clearing rate override field:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the route tests**

Create `src/app/api/room-types/rate-overrides/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
let currentUser: { id: string } | null = { id: "user-1" };

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => {
    (db as any).auth = {
      getUser: async () => ({ data: { user: currentUser }, error: currentUser ? null : { message: "no user" } }),
    };
    return db;
  },
}));

vi.mock("@/lib/rate-overrides", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-overrides")>();
  return { ...actual, clearRateOverrideField: vi.fn() };
});

import { clearRateOverrideField } from "@/lib/rate-overrides";
import { PATCH } from "./route";

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/room-types/rate-overrides/ov-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/room-types/rate-overrides/[id]", () => {
  beforeEach(() => {
    db.tables = {};
    currentUser = { id: "user-1" };
    vi.mocked(clearRateOverrideField).mockReset();
  });

  it("returns 403 for a staff member", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "staff" }]);
    const res = await PATCH(patchRequest({ field: "rate" }), { params: Promise.resolve({ id: "ov-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid field name", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    const res = await PATCH(patchRequest({ field: "not_a_real_field" }), { params: Promise.resolve({ id: "ov-1" }) });
    expect(res.status).toBe(400);
    expect(clearRateOverrideField).not.toHaveBeenCalled();
  });

  it("clears the field for a manager", async () => {
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);
    vi.mocked(clearRateOverrideField).mockResolvedValue({ ok: true });

    const res = await PATCH(patchRequest({ field: "rate" }), { params: Promise.resolve({ id: "ov-1" }) });

    expect(res.status).toBe(200);
    expect(clearRateOverrideField).toHaveBeenCalledWith(expect.anything(), "org-1", "ov-1", "rate");
  });
});
```

- [ ] **Step 3: Run the tests, confirm they pass**

Run: `npx vitest run "src/app/api/room-types/rate-overrides/[id]/route.test.ts"`
Expected: PASS (3 tests)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/room-types/rate-overrides/[id]/route.ts" "src/app/api/room-types/rate-overrides/[id]/route.test.ts"
git commit -m "feat: add PATCH /api/room-types/rate-overrides/[id] to clear one field"
```

---

### Task 10: `permissions.ts` — gate the new section

**Files:**
- Modify: `src/lib/permissions.ts:15-20`

- [ ] **Step 1: Add `rates` to `SECTION_ROLES`**

```ts
export const SECTION_ROLES: Record<string, readonly Role[]> = {
  analytics: MANAGERS,
  channels: MANAGERS,
  rates: MANAGERS,
  "settings/property": MANAGERS,
  "settings/billing": OWNER_ONLY,
  // settings/team is open to all — staff see it read-only.
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: restrict the rates section to managers"
```

---

### Task 11: i18n — `rates` namespace, sidebar nav key, `maxStayLabel`

**Files:**
- Modify: `messages/en.json`, `messages/zh.json`, `messages/bn.json`, `messages/ja.json`, `messages/ru.json`, `messages/pt.json`, `messages/sr.json`, `messages/fr.json`, `messages/hi.json`, `messages/es.json`, `messages/ar.json`

All 11 locale files are loaded independently (no fallback merge — see `src/i18n/request.ts`), so a key missing from one locale breaks that locale's page. This step adds the same English copy to every locale file — a deliberate "ship in English, translate later" choice, not a placeholder; every file ends up with real, working values.

- [ ] **Step 1: Run this script**

```bash
python3 <<'PYEOF'
import json

RATES = {
    "noOrgFound": "No organization found",
    "title": "Rates & Restrictions",
    "subtitle": "Set date-specific rates and restrictions that are pushed to your connected channels",
    "formHeading": "Set an override",
    "roomTypesLabel": "Room types",
    "dateFromLabel": "From",
    "dateToLabel": "To",
    "rateLabel": "Rate",
    "minStayArrivalLabel": "Min stay (arrival)",
    "minStayThroughLabel": "Min stay (through)",
    "maxStayLabel": "Max stay",
    "stopSellLabel": "Stop sell",
    "closedToArrivalLabel": "Closed to arrival",
    "closedToDepartureLabel": "Closed to departure",
    "saveButton": "Apply",
    "errorNoRoomTypes": "Select at least one room type",
    "errorInvalidDates": "Choose a valid date range",
    "errorNoFields": "Enable at least one field to apply",
    "toastSaveFailed": "Failed to save overrides",
    "toastSaved": "{count, plural, one {# override saved} other {# overrides saved}}",
    "toastListFailed": "Failed to load overrides",
    "toastClearFailed": "Failed to clear override",
    "listHeading": "Upcoming overrides",
    "toLabel": "to",
    "colDate": "Date",
    "colRoomType": "Room type",
    "colField": "Field",
    "colValue": "Value",
    "colActions": "Actions",
    "noneYet": "No overrides in this date range",
}

locales = ["en", "zh", "bn", "ja", "ru", "pt", "sr", "fr", "hi", "es", "ar"]

for locale in locales:
    path = f"messages/{locale}.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    data["rates"] = RATES
    data.setdefault("sidebar", {}).setdefault("nav", {})["rates"] = "Rates & Restrictions"
    data.setdefault("rooms", {}).setdefault("types", {}).setdefault("dialog", {})["maxStayLabel"] = "Max stay"

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

print("done")
PYEOF
```

- [ ] **Step 2: Verify**

Run: `python3 -c "import json; d = json.load(open('messages/en.json')); print(d['rates']['title']); print(d['sidebar']['nav']['rates']); print(d['rooms']['types']['dialog']['maxStayLabel'])"`
Expected: prints `Rates & Restrictions`, `Rates & Restrictions`, `Max stay`.

Spot-check one non-English file too: `python3 -c "import json; d = json.load(open('messages/es.json')); print(d['rates']['title'])"` — expected: `Rates & Restrictions` (English placeholder, valid JSON).

- [ ] **Step 3: Commit**

```bash
git add messages/*.json
git commit -m "i18n: add rates namespace and maxStayLabel across all locales"
```

---

### Task 12: Sidebar — nav entry

**Files:**
- Modify: `src/components/layout/sidebar.tsx:4-42`

- [ ] **Step 1: Import an icon and add the route**

Add `CalendarRange` to the `lucide-react` import list, and add a row to `mainNavRoutes` right after `rooms`:

```ts
  { path: "rooms", labelKey: "rooms", icon: BedDouble },
  { path: "rates", labelKey: "rates", icon: CalendarRange },
  { path: "housekeeping", labelKey: "housekeeping", icon: Sparkles },
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Rates nav entry to sidebar"
```

---

### Task 13: `RateOverridesClient` component

**Files:**
- Create: `src/components/rates/rate-overrides-client.tsx`

This form uses plain `useState` rather than `react-hook-form` — unlike the room-type dialog, every field here has its own independent "apply this field" toggle (a dynamic partial-field submission), which doesn't fit a single static yup-resolved form shape as cleanly. Validation of submitted values still happens server-side via `applyRateOverridesSchema` (Task 6/8).

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

interface RoomTypeOption {
  id: string;
  name: string;
}

interface OverrideRow {
  id: string;
  room_type_id: string;
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
  "rate",
  "min_stay_arrival",
  "min_stay_through",
  "max_stay",
  "stop_sell",
  "closed_to_arrival",
  "closed_to_departure",
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

  const toggleRoomType = (id: string) => {
    setSelectedRoomTypeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleField = (key: FieldKey) => {
    setEnabledFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (selectedRoomTypeIds.length === 0) {
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
      room_type_ids: selectedRoomTypeIds,
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
      fetchOverrides();
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

  const roomTypeName = (id: string) => roomTypes.find((rt) => rt.id === id)?.name ?? id;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">{t("formHeading")}</h2>

        <div>
          <label className="block text-sm font-medium mb-1">{t("roomTypesLabel")}</label>
          <div className="flex flex-wrap gap-3">
            {roomTypes.map((rt) => (
              <label key={rt.id} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2">
                <input type="checkbox" checked={selectedRoomTypeIds.includes(rt.id)} onChange={() => toggleRoomType(rt.id)} />
                {rt.name}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("dateFromLabel")}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("dateToLabel")}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            />
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
            <input
              type="date"
              value={listFrom}
              onChange={(e) => setListFrom(e.target.value)}
              className="px-2 py-1 border border-border rounded-lg bg-background text-sm"
            />
            <span className="text-sm text-muted-foreground">{t("toLabel")}</span>
            <input
              type="date"
              value={listTo}
              onChange={(e) => setListTo(e.target.value)}
              className="px-2 py-1 border border-border rounded-lg bg-background text-sm"
            />
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
                      <td className="px-4 py-2 text-sm">{roomTypeName(row.room_type_id)}</td>
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

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/rates/rate-overrides-client.tsx
git commit -m "feat: add RateOverridesClient bulk-edit form and overrides list"
```

---

### Task 14: `rates` page

**Files:**
- Create: `src/app/[locale]/[slug]/rates/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import { getTranslations } from "next-intl/server";
import { getServerUser } from "@/lib/supabase/session";
import RateOverridesClient from "@/components/rates/rate-overrides-client";

type Membership = { organization_id: string };
type RoomTypeOption = { id: string; name: string };

export default async function RatesPage() {
  const { supabase, user } = await getServerUser();
  const t = await getTranslations("rates");

  const { data: membershipRaw } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();
  const membership = membershipRaw as Membership | null;

  if (!membership) {
    return <div className="text-sm text-muted-foreground">{t("noOrgFound")}</div>;
  }

  const { data: roomTypes = [] } = await supabase
    .from("room_types")
    .select("id, name")
    .eq("organization_id", membership.organization_id)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm mt-0.5 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
        <RateOverridesClient roomTypes={(roomTypes ?? []) as RoomTypeOption[]} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/[slug]/rates/page.tsx"
git commit -m "feat: add Rates & Restrictions page"
```

---

### Task 15: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass, including every `channex-rates.test.ts` and `rate-overrides.test.ts` case from Tasks 4–5.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Start the dev server (`npm run dev`), sign in as a manager on an org with at least one room type, open the new "Rates & Restrictions" nav item, set a rate override for a single date, and confirm:
- the row appears in the "Upcoming overrides" list after save
- clearing it removes it from the list
- (if the org is Channex-provisioned) a row appears in `channex_outbox` and, once the outbox worker runs, a real push happens — verify with a readback (`channex.getRestrictions`) for that date, per the channex-pms-integration skill's "trust a readback, not a 200" rule.

- [ ] **Step 5: Final commit (if smoke testing turned up fixes)**

```bash
git add -A
git commit -m "fix: address issues found during rate calendar smoke test"
```

(Skip this step if Step 4 found nothing to fix.)
