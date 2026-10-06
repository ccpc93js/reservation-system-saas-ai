# Test Infrastructure + src/lib Unit Tests (Phase 1) Implementation Plan

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** Stand up Vitest as this repo's first test framework, add a hand-rolled fake Supabase client for unit-testing DB-touching `src/lib` code without a real database, and write unit tests for 12 `src/lib` files covering validation schemas, Channex ARI push logic, and pure utility/permission/plan logic.

**架构：** All 12 source files under test already accept their dependencies (a `SupabaseClient`, or nothing at all) as explicit parameters or module-level pure exports — none of them reach for a hidden singleton — which is what makes them unit-testable without a running server. Because the source code already exists and is already shipped/working (verified via `tsc`/`build`/manual readback in the prior session), these tasks are **characterization tests against existing behavior**, not red-green TDD for new code: each task writes a test asserting the documented/observed behavior, runs it, and it should pass immediately. If a test ever fails against existing code, that's a real bug the test just caught — stop and fix the source, don't weaken the assertion.

**技术栈：** Vitest, `@vitest/coverage-v8`, `vite-tsconfig-paths` (resolves the existing `@/*` tsconfig path alias). No `jsdom`/React Testing Library in this phase — every file under test is plain TS, no components.

---

## File structure

- `vitest.config.ts` (new, repo root) — test runner config: `node` environment, `@/*` alias resolution, coverage provider.
- `package.json` (modified) — add `test` / `test:watch` scripts and new devDependencies.
- `src/lib/test/fake-supabase.ts` (new) — the hand-rolled fake `SupabaseClient` used by every DB-touching test.
- `src/lib/test/fake-supabase.test.ts` (new) — tests the fake itself (select/insert/update/upsert/delete/rpc/or), so later tasks can trust it.
- `src/lib/channels/channex.ts` (modified) — export `unwrapOptions` (currently module-private) so it's directly testable; no behavior change.
- One `*.test.ts` colocated next to each of the 12 source files listed in the spec.

Each task below is independent once Task 1 (config) and Task 2 (fake client) land — later tasks can run in any order or in parallel.

---

### Task 1: Vitest configuration and scripts

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install -D vitest @vitest/coverage-v8 vite-tsconfig-paths
```

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` block, add two entries after `"typecheck"`:

```json
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pins the timezone so Intl-based formatting (utils.ts's formatDate) and
    // local-time date math (validations/reservation.ts's getTodayLocalDateStr)
    // are deterministic regardless of the machine running the suite.
    env: { TZ: "UTC" },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/test/**", "src/lib/types/**"],
    },
  },
});
```

- [ ] **Step 4: Verify the runner starts with zero test files**

Run: `npm test`
Expected: Vitest starts, reports `No test files found` (or exits 0 with an empty summary) — confirms config/alias resolution loads without error, before any test files exist yet.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add Vitest test infrastructure"
```

---

### Task 2: Fake Supabase client

**Files:**
- Create: `src/lib/test/fake-supabase.ts`
- Test: `src/lib/test/fake-supabase.test.ts`

This fake implements only the chainable subset of the real `SupabaseClient` query builder that the code under test actually calls: `.from(table).select().eq().in().or().order().limit().single()/.maybeSingle()`, `.insert()`, `.update()`, `.upsert()`, `.delete()`, and `.rpc(name, args)`. It is NOT a structural subtype of the real `SupabaseClient` type (that type has dozens of unrelated members) — call sites cast it with `as unknown as SupabaseClient`, which is the intended, documented usage.

- [ ] **Step 1: Write the fake client**

```ts
// src/lib/test/fake-supabase.ts
//
// Minimal fake Supabase client for unit tests. Implements only the
// chainable query-builder methods actually used by src/lib code today:
// select/eq/in/or/order/limit/single/maybeSingle, insert/update/upsert/
// delete, and rpc(). Intentionally not a structural subtype of the real
// SupabaseClient type — cast with `as unknown as SupabaseClient` at each
// call site. Extend this file (don't reach for a full Postgrest emulator)
// if a later test needs a method that isn't here yet.

type Row = Record<string, any>;
type Filter = (row: Row) => boolean;
type RpcHandler = (args: any) => { data: any; error: any } | Promise<{ data: any; error: any }>;

function parseOrFilter(expr: string): Filter {
  // Supports the subset actually used in this codebase: comma-separated
  // "column.op.value" clauses, OR'd together. ops: is (null only), lte.
  const clauses = expr.split(",").map((c) => {
    const [col, op, val] = c.split(".");
    return { col, op, val };
  });
  return (row: Row) =>
    clauses.some(({ col, op, val }) => {
      if (op === "is") return val === "null" ? row[col] == null : row[col] != null;
      if (op === "lte") return row[col] != null && row[col] <= val;
      if (op === "gte") return row[col] != null && row[col] >= val;
      if (op === "eq") return String(row[col]) === val;
      throw new Error(`fake-supabase: unsupported or() op "${op}"`);
    });
}

class FakeQueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any = null;
  private wantSingle = false;
  private wantMaybe = false;
  private limitN: number | null = null;
  private selectCols: string | null = null;

  constructor(private client: FakeSupabaseClient, private table: string) {}

  select(cols?: string) {
    this.selectCols = cols ?? null;
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push((row) => row[col] === val);
    return this;
  }
  in(col: string, vals: any[]) {
    this.filters.push((row) => vals.includes(row[col]));
    return this;
  }
  or(expr: string) {
    this.filters.push(parseOrFilter(expr));
    return this;
  }
  order(_col: string, _opts?: unknown) {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.wantMaybe = true;
    return this;
  }
  single() {
    this.wantSingle = true;
    return this;
  }
  insert(payload: any) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: any, _opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }

  private tableRows(): Row[] {
    if (!this.client.tables[this.table]) this.client.tables[this.table] = [];
    return this.client.tables[this.table];
  }

  private run(): { data: any; error: any } {
    const rows = this.tableRows();

    if (this.op === "select") {
      let result = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.limitN != null) result = result.slice(0, this.limitN);
      if (this.wantSingle) {
        return result.length === 1
          ? { data: result[0], error: null }
          : { data: null, error: { message: `expected 1 row, got ${result.length}` } };
      }
      if (this.wantMaybe) return { data: result[0] ?? null, error: null };
      return { data: result, error: null };
    }

    if (this.op === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const inserted = items.map((it, i) => ({
        id: it.id ?? `fake-${this.table}-${rows.length + i}`,
        ...it,
      }));
      rows.push(...inserted);
      const data = inserted.length === 1 ? inserted[0] : inserted;
      return { data, error: null };
    }

    if (this.op === "update") {
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      for (const row of matched) Object.assign(row, this.payload);
      return { data: this.wantSingle ? matched[0] ?? null : matched, error: null };
    }

    if (this.op === "upsert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const conflictKeys = Object.keys(items[0] ?? {}).filter((k) => k !== "id" && k !== "updated_at");
      for (const item of items) {
        const existing = rows.find((r) => conflictKeys.every((k) => r[k] === item[k]));
        if (existing) Object.assign(existing, item);
        else rows.push({ id: item.id ?? `fake-${this.table}-${rows.length}`, ...item });
      }
      return { data: null, error: null };
    }

    if (this.op === "delete") {
      const remaining = rows.filter((r) => !this.filters.every((f) => f(r)));
      this.client.tables[this.table] = remaining;
      return { data: null, error: null };
    }

    return { data: null, error: null };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export class FakeSupabaseClient {
  tables: Record<string, Row[]> = {};
  private rpcHandlers: Record<string, RpcHandler> = {};

  /** Seed a table's starting rows (cloned, so tests can't mutate the input array by reference). */
  seed(table: string, rows: Row[]): void {
    this.tables[table] = rows.map((r) => ({ ...r }));
  }

  /** Register a canned handler for supabase.rpc(name, args). */
  onRpc(name: string, handler: RpcHandler): void {
    this.rpcHandlers[name] = handler;
  }

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this, table);
  }

  async rpc(name: string, args?: any): Promise<{ data: any; error: any }> {
    const handler = this.rpcHandlers[name];
    if (!handler) throw new Error(`FakeSupabaseClient: no rpc handler registered for "${name}"`);
    return handler(args);
  }
}
```

- [ ] **Step 2: Write the fake client's own test**

```ts
// src/lib/test/fake-supabase.test.ts
import { describe, it, expect } from "vitest";
import { FakeSupabaseClient } from "./fake-supabase";

describe("FakeSupabaseClient", () => {
  it("filters rows with eq and returns an array by default", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "1", org: "a" }, { id: "2", org: "b" }]);
    const { data, error } = await db.from("widgets").select("*").eq("org", "a");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: "1", org: "a" }]);
  });

  it("single() errors when the row count isn't exactly 1", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", []);
    const { data, error } = await db.from("widgets").select("*").eq("id", "missing").single();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("maybeSingle() returns null (no error) when nothing matches", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", []);
    const { data, error } = await db.from("widgets").select("*").eq("id", "missing").maybeSingle();
    expect(data).toBeNull();
    expect(error).toBeNull();
  });

  it("insert() assigns an id when absent and appends to the table", async () => {
    const db = new FakeSupabaseClient();
    const { data } = await db.from("widgets").insert({ org: "a" });
    expect(data.id).toBeTruthy();
    expect(db.tables.widgets).toHaveLength(1);
  });

  it("update() mutates only matched rows", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "1", status: "pending" }, { id: "2", status: "pending" }]);
    await db.from("widgets").update({ status: "sent" }).eq("id", "1");
    expect(db.tables.widgets).toEqual([{ id: "1", status: "sent" }, { id: "2", status: "pending" }]);
  });

  it("upsert() updates on conflict, inserts otherwise", async () => {
    const db = new FakeSupabaseClient();
    db.seed("links", [{ id: "x", kind: "property", local_id: "org1", channex_id: "old" }]);
    await db.from("links").upsert({ kind: "property", local_id: "org1", channex_id: "new" }, { onConflict: "kind,local_id" });
    expect(db.tables.links).toHaveLength(1);
    expect(db.tables.links[0].channex_id).toBe("new");
  });

  it("or() ORs is.null and lte clauses", async () => {
    const db = new FakeSupabaseClient();
    db.seed("outbox", [
      { id: "1", next_attempt_at: null },
      { id: "2", next_attempt_at: "2020-01-01" },
      { id: "3", next_attempt_at: "2099-01-01" },
    ]);
    const { data } = await db.from("outbox").select("*").or("next_attempt_at.is.null,next_attempt_at.lte.2026-01-01");
    expect(data.map((r: any) => r.id).sort()).toEqual(["1", "2"]);
  });

  it("rpc() invokes the registered handler with the given args", async () => {
    const db = new FakeSupabaseClient();
    db.onRpc("my_fn", (args) => ({ data: `got:${args.x}`, error: null }));
    const { data } = await db.rpc("my_fn", { x: 42 });
    expect(data).toBe("got:42");
  });

  it("rpc() throws for an unregistered name", async () => {
    const db = new FakeSupabaseClient();
    await expect(db.rpc("nope")).rejects.toThrow(/no rpc handler registered/);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm test -- src/lib/test/fake-supabase.test.ts`
Expected: 9 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/test/fake-supabase.ts src/lib/test/fake-supabase.test.ts
git commit -m "test: add fake Supabase client for lib unit tests"
```

---

### Task 3: `channels/channex.ts` — export `unwrapOptions`, test pure helpers

**Files:**
- Modify: `src/lib/channels/channex.ts:244`
- Test: `src/lib/channels/channex.test.ts`

`unwrapOptions` is currently a module-private function. It's a pure, three-line map with no side effects — exporting it is a safe, non-behavioral change that makes it directly testable instead of only reachable through the HTTP-calling `propertyOptions()`/`roomTypeOptions()`/`ratePlanOptions()` wrappers (which would require mocking global `fetch` and `CHANNEX_API_KEY` just to exercise a map function).

- [ ] **Step 1: Export `unwrapOptions`**

In `src/lib/channels/channex.ts`, change line 244 from:

```ts
function unwrapOptions<T>(rows: ChannexEntity[]): T[] {
```

to:

```ts
export function unwrapOptions<T>(rows: ChannexEntity[]): T[] {
```

- [ ] **Step 2: Write the test**

```ts
// src/lib/channels/channex.test.ts
import { describe, it, expect } from "vitest";
import { toChannexMinor, unwrapOptions, type ChannexEntity } from "./channex";

describe("toChannexMinor", () => {
  it("converts a major-unit number to integer cents", () => {
    expect(toChannexMinor(80)).toBe(8000);
  });

  it("converts a major-unit string to integer cents", () => {
    expect(toChannexMinor("80.00")).toBe(8000);
  });

  it("rounds fractional cents", () => {
    expect(toChannexMinor(19.999)).toBe(2000);
  });

  it("handles zero", () => {
    expect(toChannexMinor(0)).toBe(0);
  });
});

describe("unwrapOptions", () => {
  it("flattens id + attributes into a single object per row", () => {
    const rows: ChannexEntity[] = [
      { id: "abc", attributes: { title: "Standard", currency: "EUR" } },
      { id: "def", attributes: { title: "Deluxe", currency: "USD" } },
    ];
    const result = unwrapOptions<{ id: string; title: string; currency: string }>(rows);
    expect(result).toEqual([
      { id: "abc", title: "Standard", currency: "EUR" },
      { id: "def", title: "Deluxe", currency: "USD" },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(unwrapOptions([])).toEqual([]);
  });

  it("handles a row with no attributes", () => {
    const rows: ChannexEntity[] = [{ id: "abc" }];
    expect(unwrapOptions(rows)).toEqual([{ id: "abc" }]);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm test -- src/lib/channels/channex.test.ts`
Expected: 7 passed.

- [ ] **Step 4: Confirm the export didn't break anything else**

Run: `npm run typecheck`
Expected: no errors (the export is additive; nothing else changes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/channex.ts src/lib/channels/channex.test.ts
git commit -m "test: unit test channex.ts pure helpers, export unwrapOptions"
```

---

### Task 4: `validations/room.ts`

**Files:**
- Test: `src/lib/validations/room.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/lib/validations/room.test.ts
import { describe, it, expect } from "vitest";
import {
  createRoomTypeSchema,
  updateRoomTypeSchema,
  createRoomSchema,
  createBedSchema,
} from "./room";

const validRoomType = {
  name: "Standard Dorm",
  type: "dorm",
  gender: "mixed",
  capacity: 6,
  base_price: 25,
};

describe("createRoomTypeSchema", () => {
  it("accepts a minimal valid room type", async () => {
    await expect(createRoomTypeSchema.validate(validRoomType)).resolves.toBeTruthy();
  });

  it("rejects a name that's too short", async () => {
    await expect(createRoomTypeSchema.validate({ ...validRoomType, name: "A" })).rejects.toThrow();
  });

  it("rejects an invalid type", async () => {
    await expect(createRoomTypeSchema.validate({ ...validRoomType, type: "suite" })).rejects.toThrow();
  });

  it("rejects capacity above 20", async () => {
    await expect(createRoomTypeSchema.validate({ ...validRoomType, capacity: 21 })).rejects.toThrow();
  });

  it("rejects a zero base_price", async () => {
    await expect(createRoomTypeSchema.validate({ ...validRoomType, base_price: 0 })).rejects.toThrow();
  });

  it("accepts stop_sell / closed_to_arrival / closed_to_departure booleans", async () => {
    const result = await createRoomTypeSchema.validate({
      ...validRoomType,
      stop_sell: true,
      closed_to_arrival: true,
      closed_to_departure: false,
    });
    expect(result.stop_sell).toBe(true);
    expect(result.closed_to_arrival).toBe(true);
    expect(result.closed_to_departure).toBe(false);
  });

  it("accepts a positive min_stay_arrival / min_stay_through", async () => {
    const result = await createRoomTypeSchema.validate({
      ...validRoomType,
      min_stay_arrival: 2,
      min_stay_through: 3,
    });
    expect(result.min_stay_arrival).toBe(2);
    expect(result.min_stay_through).toBe(3);
  });

  it("rejects min_stay_arrival below 1", async () => {
    await expect(
      createRoomTypeSchema.validate({ ...validRoomType, min_stay_arrival: 0 })
    ).rejects.toThrow();
  });

  it("coerces an empty-string min_stay_arrival to null instead of failing", async () => {
    const result = await createRoomTypeSchema.validate({ ...validRoomType, min_stay_arrival: "" as any });
    expect(result.min_stay_arrival).toBeNull();
  });
});

describe("updateRoomTypeSchema", () => {
  it("accepts a partial update with only base_price", async () => {
    await expect(updateRoomTypeSchema.validate({ base_price: 30 })).resolves.toBeTruthy();
  });

  it("accepts an empty object (all fields optional on update)", async () => {
    await expect(updateRoomTypeSchema.validate({})).resolves.toBeTruthy();
  });

  it("still rejects an out-of-range base_price when provided", async () => {
    await expect(updateRoomTypeSchema.validate({ base_price: -5 })).rejects.toThrow();
  });
});

describe("createRoomSchema", () => {
  it("accepts a valid room", async () => {
    await expect(
      createRoomSchema.validate({ room_type_id: "any-id", name: "Room 101" })
    ).resolves.toBeTruthy();
  });

  it("requires room_type_id", async () => {
    await expect(createRoomSchema.validate({ name: "Room 101" })).rejects.toThrow();
  });
});

describe("createBedSchema", () => {
  it("accepts a valid bed", async () => {
    await expect(createBedSchema.validate({ room_id: "any-id", name: "Bed 1" })).resolves.toBeTruthy();
  });

  it("requires a non-empty bed name", async () => {
    await expect(createBedSchema.validate({ room_id: "any-id", name: "" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/validations/room.test.ts`
Expected: 16 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/room.test.ts
git commit -m "test: unit test room/bed validation schemas"
```

---

### Task 5: `validations/guest.ts`

**Files:**
- Test: `src/lib/validations/guest.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/lib/validations/guest.test.ts
import { describe, it, expect } from "vitest";
import { createGuestSchema, updateGuestSchema } from "./guest";

const validGuest = { first_name: "Jane", last_name: "Doe" };

describe("createGuestSchema", () => {
  it("accepts a minimal valid guest", async () => {
    await expect(createGuestSchema.validate(validGuest)).resolves.toBeTruthy();
  });

  it("rejects a first_name that's too short", async () => {
    await expect(createGuestSchema.validate({ ...validGuest, first_name: "J" })).rejects.toThrow();
  });

  it("rejects an invalid email", async () => {
    await expect(createGuestSchema.validate({ ...validGuest, email: "not-an-email" })).rejects.toThrow();
  });

  it("accepts a valid email", async () => {
    await expect(
      createGuestSchema.validate({ ...validGuest, email: "jane@example.com" })
    ).resolves.toBeTruthy();
  });

  it("rejects a date_of_birth in the future", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    await expect(
      createGuestSchema.validate({ ...validGuest, date_of_birth: future })
    ).rejects.toThrow();
  });

  it("rejects an invalid document_type", async () => {
    await expect(
      createGuestSchema.validate({ ...validGuest, document_type: "id_card" })
    ).rejects.toThrow();
  });

  it("accepts a valid document_type", async () => {
    await expect(
      createGuestSchema.validate({ ...validGuest, document_type: "passport" })
    ).resolves.toBeTruthy();
  });
});

describe("updateGuestSchema", () => {
  it("accepts a partial update", async () => {
    await expect(updateGuestSchema.validate({ phone: "+1234567890" })).resolves.toBeTruthy();
  });

  it("accepts an empty object", async () => {
    await expect(updateGuestSchema.validate({})).resolves.toBeTruthy();
  });

  it("still validates email format when provided", async () => {
    await expect(updateGuestSchema.validate({ email: "bad" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/validations/guest.test.ts`
Expected: 10 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/guest.test.ts
git commit -m "test: unit test guest validation schemas"
```

---

### Task 6: `validations/reservation.ts`

**Files:**
- Test: `src/lib/validations/reservation.test.ts`

Uses `vi.useFakeTimers()` to pin "today" so the not-in-the-past date checks are deterministic regardless of when the suite runs.

- [ ] **Step 1: Write the test**

```ts
// src/lib/validations/reservation.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createReservationSchema,
  updateReservationDatesSchema,
  cancelReservationSchema,
} from "./reservation";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("createReservationSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const base = {
    guest_id: "new",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    check_in: "2026-06-16",
    check_out: "2026-06-18",
    price_per_night: 50,
    bed_id: validUuid,
    org_id: validUuid,
  };

  it("accepts a valid new-guest reservation", async () => {
    await expect(createReservationSchema.validate(base)).resolves.toBeTruthy();
  });

  it("rejects a check_in date in the past", async () => {
    await expect(
      createReservationSchema.validate({ ...base, check_in: "2026-06-01" })
    ).rejects.toThrow();
  });

  it("rejects check_out before check_in", async () => {
    await expect(
      createReservationSchema.validate({ ...base, check_in: "2026-06-20", check_out: "2026-06-18" })
    ).rejects.toThrow();
  });

  it("rejects a non-positive price_per_night", async () => {
    await expect(createReservationSchema.validate({ ...base, price_per_night: 0 })).rejects.toThrow();
  });

  it("rejects a malformed bed_id", async () => {
    await expect(createReservationSchema.validate({ ...base, bed_id: "not-a-uuid" })).rejects.toThrow();
  });

  it("requires first_name/last_name/email when guest_id is 'new'", async () => {
    await expect(
      createReservationSchema.validate({ ...base, guest_id: "new", first_name: "" })
    ).rejects.toThrow();
  });

  it("does not require first_name/last_name when guest_id is an existing guest", async () => {
    const { first_name, last_name, email, ...rest } = base;
    await expect(
      createReservationSchema.validate({ ...rest, guest_id: validUuid })
    ).resolves.toBeTruthy();
  });
});

describe("updateReservationDatesSchema", () => {
  it("accepts valid, ordered dates", async () => {
    await expect(
      updateReservationDatesSchema.validate({ check_in: "2026-06-16", check_out: "2026-06-18" })
    ).resolves.toBeTruthy();
  });

  it("rejects check_out before check_in", async () => {
    await expect(
      updateReservationDatesSchema.validate({ check_in: "2026-06-18", check_out: "2026-06-16" })
    ).rejects.toThrow();
  });

  it("allows omitting both dates", async () => {
    await expect(updateReservationDatesSchema.validate({})).resolves.toBeTruthy();
  });
});

describe("cancelReservationSchema", () => {
  it("accepts a valid cancellation reason", async () => {
    await expect(
      cancelReservationSchema.validate({ cancellation_reason: "guest_request" })
    ).resolves.toBeTruthy();
  });

  it("rejects an invalid cancellation reason", async () => {
    await expect(
      cancelReservationSchema.validate({ cancellation_reason: "changed_my_mind" })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/validations/reservation.test.ts`
Expected: 12 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/reservation.test.ts
git commit -m "test: unit test reservation validation schemas"
```

---

### Task 7: `permissions.ts`

**Files:**
- Test: `src/lib/permissions.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/lib/permissions.test.ts
import { describe, it, expect } from "vitest";
import {
  canAccessSection,
  isManager,
  isOwner,
  roleRank,
  canManageMember,
  assignableRoles,
} from "./permissions";

describe("canAccessSection", () => {
  it("allows any role into a section not listed in SECTION_ROLES", () => {
    expect(canAccessSection("staff", "reservations")).toBe(true);
    expect(canAccessSection(undefined, "reservations")).toBe(true);
  });

  it("blocks staff from a manager-only section", () => {
    expect(canAccessSection("staff", "channels")).toBe(false);
  });

  it("allows manager/owner into a manager-only section", () => {
    expect(canAccessSection("manager", "channels")).toBe(true);
    expect(canAccessSection("owner", "channels")).toBe(true);
  });

  it("restricts an owner-only section to owner", () => {
    expect(canAccessSection("manager", "settings/billing")).toBe(false);
    expect(canAccessSection("owner", "settings/billing")).toBe(true);
  });
});

describe("isManager / isOwner", () => {
  it("treats admin as a manager", () => {
    expect(isManager("admin")).toBe(true);
  });

  it("does not treat staff as a manager", () => {
    expect(isManager("staff")).toBe(false);
  });

  it("only owner is owner", () => {
    expect(isOwner("owner")).toBe(true);
    expect(isOwner("manager")).toBe(false);
  });
});

describe("roleRank / canManageMember", () => {
  it("ranks owner above manager/admin above staff", () => {
    expect(roleRank("owner")).toBeGreaterThan(roleRank("manager"));
    expect(roleRank("manager")).toBeGreaterThan(roleRank("staff"));
  });

  it("gives an unknown/undefined role rank 0", () => {
    expect(roleRank(undefined)).toBe(0);
    expect(roleRank("bogus")).toBe(0);
  });

  it("owner can manage manager and staff", () => {
    expect(canManageMember("owner", "manager")).toBe(true);
    expect(canManageMember("owner", "staff")).toBe(true);
  });

  it("manager cannot manage another manager or an owner", () => {
    expect(canManageMember("manager", "manager")).toBe(false);
    expect(canManageMember("manager", "owner")).toBe(false);
  });

  it("manager can manage staff", () => {
    expect(canManageMember("manager", "staff")).toBe(true);
  });
});

describe("assignableRoles", () => {
  it("only an owner can assign the owner role", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("manager")).not.toContain("owner");
  });

  it("manager can assign manager and staff", () => {
    expect(assignableRoles("manager")).toEqual(expect.arrayContaining(["manager", "staff"]));
  });

  it("staff can assign nothing", () => {
    expect(assignableRoles("staff")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/permissions.test.ts`
Expected: 15 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions.test.ts
git commit -m "test: unit test role-based access control logic"
```

---

### Task 8: `plan.ts`

**Files:**
- Test: `src/lib/plan.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/lib/plan.test.ts
import { describe, it, expect } from "vitest";
import {
  getPlanLimits,
  hasFeature,
  canAddGuestBookEntry,
  canAddBed,
  canAddUser,
  getBedLimit,
  getUserLimit,
} from "./plan";

describe("getPlanLimits", () => {
  it("returns the matching plan's limits", () => {
    expect(getPlanLimits("pro").beds).toBe(60);
  });

  it("falls back to free for an unknown plan string", () => {
    expect(getPlanLimits("nonsense")).toEqual(getPlanLimits("free"));
  });
});

describe("hasFeature", () => {
  it("free plan has no channels feature", () => {
    expect(hasFeature("free", "channels")).toBe(false);
  });

  it("pro plan has the channels feature", () => {
    expect(hasFeature("pro", "channels")).toBe(true);
  });
});

describe("canAddGuestBookEntry", () => {
  it("blocks once the free plan's guest book limit is reached", () => {
    expect(canAddGuestBookEntry("free", 500)).toBe(false);
    expect(canAddGuestBookEntry("free", 499)).toBe(true);
  });

  it("scale plan is unlimited (-1)", () => {
    expect(canAddGuestBookEntry("scale", 1_000_000)).toBe(true);
  });
});

describe("canAddBed / canAddUser", () => {
  it("blocks adding a bed at the free plan's limit", () => {
    expect(canAddBed("free", 20)).toBe(false);
    expect(canAddBed("free", 19)).toBe(true);
  });

  it("blocks adding a user at the free plan's limit", () => {
    expect(canAddUser("free", 1)).toBe(false);
  });

  it("scale plan allows unlimited beds and users", () => {
    expect(canAddBed("scale", 999)).toBe(true);
    expect(canAddUser("scale", 999)).toBe(true);
  });
});

describe("getBedLimit / getUserLimit", () => {
  it("reports -1 as unlimited for scale", () => {
    expect(getBedLimit("scale")).toBe(-1);
    expect(getUserLimit("scale")).toBe(-1);
  });

  it("reports finite limits for pro", () => {
    expect(getBedLimit("pro")).toBe(60);
    expect(getUserLimit("pro")).toBe(3);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/plan.test.ts`
Expected: 11 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/plan.test.ts
git commit -m "test: unit test plan limit logic"
```

---

### Task 9: `countries.ts`

**Files:**
- Test: `src/lib/countries.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/lib/countries.test.ts
import { describe, it, expect } from "vitest";
import { COUNTRIES } from "./countries";

describe("COUNTRIES", () => {
  it("is a non-empty array of unique strings", () => {
    expect(COUNTRIES.length).toBeGreaterThan(100);
    expect(new Set(COUNTRIES).size).toBe(COUNTRIES.length);
  });

  it("is sorted alphabetically", () => {
    const sorted = [...COUNTRIES].sort((a, b) => a.localeCompare(b));
    expect(COUNTRIES).toEqual(sorted);
  });

  it("contains expected common countries", () => {
    for (const c of ["United States", "United Kingdom", "Germany", "Serbia"]) {
      expect(COUNTRIES).toContain(c);
    }
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/countries.test.ts`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/countries.test.ts
git commit -m "test: unit test countries list invariants"
```

---

### Task 10: `utils.ts`

**Files:**
- Test: `src/lib/utils.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/lib/utils.test.ts
import { describe, it, expect } from "vitest";
import { cn, formatCurrency, formatDate, getNights, STATUS_LABELS, CHANNEL_LABELS } from "./utils";

describe("cn", () => {
  it("merges class names and dedupes conflicting Tailwind utilities", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });
});

describe("formatCurrency", () => {
  it("formats EUR by default with 2 decimals", () => {
    expect(formatCurrency(1234.5)).toContain("1.234,50");
  });

  it("formats a different currency when given", () => {
    const result = formatCurrency(10, "USD");
    expect(result).toMatch(/US\$|USD/);
  });
});

describe("formatDate", () => {
  it("formats a date string as 'DD Mon YYYY'", () => {
    expect(formatDate("2026-06-15")).toBe("15 Jun 2026");
  });

  it("accepts a Date object", () => {
    expect(formatDate(new Date("2026-01-01T00:00:00Z"))).toBe("01 Jan 2026");
  });
});

describe("getNights", () => {
  it("computes whole nights between two dates", () => {
    expect(getNights("2026-06-15", "2026-06-18")).toBe(3);
  });

  it("returns 0 for same-day check-in/check-out", () => {
    expect(getNights("2026-06-15", "2026-06-15")).toBe(0);
  });
});

describe("label maps", () => {
  it("STATUS_LABELS covers every reservation status", () => {
    for (const s of ["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"]) {
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
  });

  it("CHANNEL_LABELS covers every known channel", () => {
    for (const c of ["walk_in", "booking_com", "airbnb", "hostelworld"]) {
      expect(CHANNEL_LABELS[c]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/utils.test.ts`
Expected: 10 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.test.ts
git commit -m "test: unit test formatting/date utility functions"
```

---

### Task 11: `channels/channex-rates.ts`

**Files:**
- Test: `src/lib/channels/channex-rates.test.ts`

Mocks only the network-calling half of `./channex` (`channex.pushRestrictions`) via `vi.mock` with `importOriginal`, so the real `toChannexMinor` is still used to compute expected values — keeping the test honest about what actually gets sent.

- [ ] **Step 1: Write the test**

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

function seedProvisioned(db: FakeSupabaseClient, roomTypes: any[]) {
  db.seed("channel_provider_links", [
    { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
    ...roomTypes.map((rt) => ({
      kind: "rate_plan",
      local_id: rt.id,
      channex_id: `rp-${rt.id}`,
      organization_id: orgId,
    })),
  ]);
  db.seed("room_types", roomTypes);
}

describe("pushRatesForOrg", () => {
  // pushRatesForOrg clamps `from` to today (`opts.from > todayISO() ? opts.from
  // : todayISO()`), so date assertions below need "today" pinned before the
  // fixture dates — otherwise this test silently breaks once real "today"
  // passes 2026-07-01.
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
        id: "rt-1",
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
        rate_plan_id: "rp-rt-1",
        date_from: "2026-07-01",
        date_to: "2026-07-02", // to is exclusive; last night is one before it
        rate: 2500,
        stop_sell: false,
        closed_to_arrival: true,
        closed_to_departure: false,
        min_stay_arrival: 2,
        // min_stay_through omitted entirely — null, not sent as null
      },
    ]);
  });

  it("omits null min-stay fields rather than sending null", async () => {
    const db = new FakeSupabaseClient();
    seedProvisioned(db, [
      {
        id: "rt-1",
        base_price: "25.00",
        stop_sell: false,
        closed_to_arrival: false,
        closed_to_departure: false,
        min_stay_arrival: null,
        min_stay_through: null,
      },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values[0]).not.toHaveProperty("min_stay_arrival");
    expect(values[0]).not.toHaveProperty("min_stay_through");
  });

  it("only pushes room types that have a mapped rate plan", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      // rt-mapped has a rate_plan link; rt-unmapped does not
      { kind: "rate_plan", local_id: "rt-mapped", channex_id: "rp-mapped", organization_id: orgId },
    ]);
    db.seed("room_types", [
      { id: "rt-mapped", base_price: 10, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null },
      { id: "rt-unmapped", base_price: 10, stop_sell: false, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: null, min_stay_through: null },
    ]);

    await pushRatesForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-07-02" });

    const [values] = vi.mocked(channex.pushRestrictions).mock.calls[0];
    expect(values).toHaveLength(1);
    expect(values[0].rate_plan_id).toBe("rp-mapped");
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/channels/channex-rates.test.ts`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/channels/channex-rates.test.ts
git commit -m "test: unit test Channex rate/restriction push mapping"
```

---

### Task 12: `channels/channex-availability.ts`

**Files:**
- Test: `src/lib/channels/channex-availability.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/lib/channels/channex-availability.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./channex")>();
  return {
    ...actual,
    channex: { ...actual.channex, pushAvailability: vi.fn().mockResolvedValue(undefined) },
  };
});

import { channex } from "./channex";
import { pushAvailabilityForOrg } from "./channex-availability";

const orgId = "org-1";

describe("pushAvailabilityForOrg", () => {
  beforeEach(() => vi.mocked(channex.pushAvailability).mockClear());

  it("skips a non-provisioned org", async () => {
    const db = new FakeSupabaseClient();
    const result = await pushAvailabilityForOrg(db as unknown as SupabaseClient, orgId);
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe("org not provisioned");
    expect(channex.pushAvailability).not.toHaveBeenCalled();
  });

  it("maps free_beds_ranges rows to AvailabilityValue via the mapped room type id", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      { kind: "room_type", local_id: "rt-1", channex_id: "channex-rt-1", organization_id: orgId },
    ]);
    db.onRpc("free_beds_ranges", () => ({
      data: [{ room_type_id: "rt-1", date_from: "2026-07-01", date_to: "2026-07-05", free: 3 }],
      error: null,
    }));

    const result = await pushAvailabilityForOrg(db as unknown as SupabaseClient, orgId, {
      from: "2026-07-01",
      to: "2026-08-01",
    });

    expect(result.ok).toBe(true);
    expect(channex.pushAvailability).toHaveBeenCalledWith([
      { property_id: "prop-1", room_type_id: "channex-rt-1", date_from: "2026-07-01", date_to: "2026-07-05", availability: 3 },
    ]);
  });

  it("drops ranges for room types with no Channex mapping", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      { kind: "room_type", local_id: "rt-mapped", channex_id: "channex-mapped", organization_id: orgId },
    ]);
    db.onRpc("free_beds_ranges", () => ({
      data: [
        { room_type_id: "rt-mapped", date_from: "2026-07-01", date_to: "2026-07-02", free: 1 },
        { room_type_id: "rt-unmapped", date_from: "2026-07-01", date_to: "2026-07-02", free: 5 },
      ],
      error: null,
    }));

    await pushAvailabilityForOrg(db as unknown as SupabaseClient, orgId, { from: "2026-07-01", to: "2026-08-01" });

    const [values] = vi.mocked(channex.pushAvailability).mock.calls[0];
    expect(values).toHaveLength(1);
    expect(values[0].room_type_id).toBe("channex-mapped");
  });

  it("returns ok:false with the RPC error message on an RPC failure", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channel_provider_links", [
      { kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId },
      { kind: "room_type", local_id: "rt-1", channex_id: "channex-rt-1", organization_id: orgId },
    ]);
    db.onRpc("free_beds_ranges", () => ({ data: null, error: { message: "boom" } }));

    const result = await pushAvailabilityForOrg(db as unknown as SupabaseClient, orgId, {
      from: "2026-07-01",
      to: "2026-08-01",
    });

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe("boom");
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/channels/channex-availability.test.ts`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/channels/channex-availability.test.ts
git commit -m "test: unit test Channex availability push mapping"
```

---

### Task 13: `channels/channex-outbox.ts`

**Files:**
- Test: `src/lib/channels/channex-outbox.test.ts`

Mocks `pushAvailabilityForOrg`/`pushRatesForOrg` themselves (not `./channex`) since `processOutbox` calls those directly — this isolates the outbox's grouping/backoff logic from the push-mapping logic already covered in Tasks 11–12.

- [ ] **Step 1: Write the test**

```ts
// src/lib/channels/channex-outbox.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex-availability", () => ({ pushAvailabilityForOrg: vi.fn() }));
vi.mock("./channex-rates", () => ({ pushRatesForOrg: vi.fn() }));

import { pushAvailabilityForOrg } from "./channex-availability";
import { pushRatesForOrg } from "./channex-rates";
import { enqueueAvailability, enqueueRestrictions, processOutbox } from "./channex-outbox";

const orgId = "org-1";

function provisioned(db: FakeSupabaseClient) {
  db.seed("channel_provider_links", [{ kind: "property", local_id: orgId, channex_id: "prop-1", organization_id: orgId }]);
}

describe("enqueueAvailability / enqueueRestrictions", () => {
  it("no-ops for an org with no Channex property link", async () => {
    const db = new FakeSupabaseClient();
    await enqueueAvailability(db as unknown as SupabaseClient, orgId, "2026-07-01", "2026-07-02");
    expect(db.tables.channex_outbox ?? []).toHaveLength(0);
  });

  it("inserts a pending row for a provisioned org", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    await enqueueRestrictions(db as unknown as SupabaseClient, orgId, "2026-07-01", "2026-07-02", ["rt-1"]);
    expect(db.tables.channex_outbox).toHaveLength(1);
    expect(db.tables.channex_outbox[0]).toMatchObject({
      organization_id: orgId,
      kind: "restrictions",
      from_date: "2026-07-01",
      to_date: "2026-07-02",
      room_type_ids: ["rt-1"],
    });
  });

  it("does nothing when from/to are missing", async () => {
    const db = new FakeSupabaseClient();
    provisioned(db);
    await enqueueAvailability(db as unknown as SupabaseClient, orgId, undefined, undefined);
    expect(db.tables.channex_outbox ?? []).toHaveLength(0);
  });
});

describe("processOutbox", () => {
  beforeEach(() => {
    vi.mocked(pushAvailabilityForOrg).mockReset().mockResolvedValue({ ok: true, propertyId: "p", roomTypesPushed: 1, entries: 1 });
    vi.mocked(pushRatesForOrg).mockReset().mockResolvedValue({ ok: true, propertyId: "p", ratePlansPushed: 1, entries: 1 });
  });

  function pendingRow(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: overrides.id ?? "row-1",
      organization_id: orgId,
      kind: "availability",
      from_date: "2026-07-01",
      to_date: "2026-07-02",
      room_type_ids: null,
      status: "pending",
      attempts: 0,
      next_attempt_at: null,
      created_at: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  it("groups multiple pending rows for the same (org, kind) into a single push call", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [
      pendingRow({ id: "a", from_date: "2026-07-01", to_date: "2026-07-02" }),
      pendingRow({ id: "b", from_date: "2026-07-03", to_date: "2026-07-05" }),
    ]);

    const result = await processOutbox(db as unknown as SupabaseClient);

    expect(pushAvailabilityForOrg).toHaveBeenCalledTimes(1);
    expect(pushAvailabilityForOrg).toHaveBeenCalledWith(db, orgId, { from: "2026-07-01", to: "2026-07-05", roomTypeLocalIds: undefined });
    expect(result.sent).toBe(2);
    expect(db.tables.channex_outbox.every((r: any) => r.status === "sent")).toBe(true);
  });

  it("widens to all room types (undefined filter) if any grouped row has room_type_ids: null", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [
      pendingRow({ id: "a", room_type_ids: ["rt-1"] }),
      pendingRow({ id: "b", room_type_ids: null }),
    ]);

    await processOutbox(db as unknown as SupabaseClient);

    const [, , opts] = vi.mocked(pushAvailabilityForOrg).mock.calls[0];
    expect(opts.roomTypeLocalIds).toBeUndefined();
  });

  it("retries with exponential backoff on a transient (network) push failure", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [pendingRow()]);
    vi.mocked(pushAvailabilityForOrg).mockRejectedValue(Object.assign(new Error("timeout"), { status: undefined }));

    const result = await processOutbox(db as unknown as SupabaseClient);

    expect(result.retried).toBe(1);
    expect(db.tables.channex_outbox[0].status).toBe("pending");
    expect(db.tables.channex_outbox[0].attempts).toBe(1);
    expect(db.tables.channex_outbox[0].next_attempt_at).toBeTruthy();
  });

  it("parks a permanent (4xx) push failure as status:error without retrying", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [pendingRow()]);
    const { ChannexError } = await import("./channex");
    vi.mocked(pushAvailabilityForOrg).mockRejectedValue(new ChannexError(422, "bad_request", "nope"));

    const result = await processOutbox(db as unknown as SupabaseClient);

    expect(result.errored).toBe(1);
    expect(db.tables.channex_outbox[0].status).toBe("error");
  });

  it("stops issuing calls once maxCalls is reached, leaving the rest pending", async () => {
    const db = new FakeSupabaseClient();
    db.seed("channex_outbox", [
      pendingRow({ id: "a", organization_id: "org-a" }),
      pendingRow({ id: "b", organization_id: "org-b" }),
    ]);

    const result = await processOutbox(db as unknown as SupabaseClient, 1);

    expect(result.rateLimited).toBe(true);
    expect(result.calls).toBe(1);
    const statuses = db.tables.channex_outbox.map((r: any) => r.status).sort();
    expect(statuses).toEqual(["pending", "sent"]);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/channels/channex-outbox.test.ts`
Expected: 8 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/channels/channex-outbox.test.ts
git commit -m "test: unit test Channex outbox grouping and retry/backoff logic"
```

---

### Task 14: `channels/channex-bookings.ts`

**Files:**
- Test: `src/lib/channels/channex-bookings.test.ts`

Mocks `./channex-outbox` (`enqueueAvailability`) and `@/lib/notifications` (`notifyOrg`) entirely, since both reach outside the function's parameters (the outbox module makes its own enqueue call; `notifyOrg` creates its own service client internally). This isolates `applyRevision`'s branching logic, which is the highest-value test in this phase.

- [ ] **Step 1: Write the test**

```ts
// src/lib/channels/channex-bookings.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

vi.mock("./channex-outbox", () => ({ enqueueAvailability: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications", () => ({ notifyOrg: vi.fn().mockResolvedValue(undefined) }));

import { applyRevision, type ApplyResult } from "./channex-bookings";
import type { RevisionAttributes } from "./channex";

const orgId = "org-1";
const channexPropertyId = "channex-prop-1";
const channexRoomTypeId = "channex-rt-1";
const localRoomTypeId = "rt-1";

function baseDb(overrides: { roomType?: Partial<Record<string, any>>; rpcResult?: string | null } = {}) {
  const db = new FakeSupabaseClient();
  db.seed("channel_provider_links", [
    { kind: "property", local_id: orgId, channex_id: channexPropertyId, organization_id: orgId },
    { kind: "room_type", local_id: localRoomTypeId, channex_id: channexRoomTypeId, organization_id: orgId },
  ]);
  db.seed("room_types", [{ id: localRoomTypeId, type: "dorm", capacity: 6, ...overrides.roomType }]);
  db.seed("reservations", []);
  db.seed("guests", []);
  db.onRpc("create_channex_reservation", () => ({
    data: overrides.rpcResult === undefined ? "new-reservation-id" : overrides.rpcResult,
    error: null,
  }));
  return db;
}

function revision(overrides: Partial<RevisionAttributes> = {}): RevisionAttributes {
  return {
    booking_id: "booking-1",
    status: "new",
    property_id: channexPropertyId,
    ota_name: "Booking.com",
    arrival_date: "2026-07-01",
    departure_date: "2026-07-03",
    amount: "100.00",
    currency: "EUR",
    customer: { name: "Jane", surname: "Doe", mail: "jane@example.com" },
    rooms: [{ room_type_id: channexRoomTypeId, checkin_date: "2026-07-01", checkout_date: "2026-07-03", occupancy: { adults: 1 } }],
    ...overrides,
  };
}

describe("applyRevision", () => {
  it("skips a revision for a property not mapped to any org", async () => {
    const db = new FakeSupabaseClient();
    const result = await applyRevision(db as unknown as SupabaseClient, revision({ property_id: "unmapped-property" }));
    expect(result.action).toBe("skipped");
  });

  it("creates a new reservation for a new booking", async () => {
    const db = baseDb();
    const result = await applyRevision(db as unknown as SupabaseClient, revision());
    expect(result.action).toBe("created");
    expect(result.reservationId).toBe("new-reservation-id");
  });

  it("dedupes: a 'new' booking already imported is skipped, not re-created", async () => {
    const db = baseDb();
    db.seed("reservations", [{ id: "existing-1", organization_id: orgId, external_id: "booking-1", status: "confirmed" }]);
    const result = await applyRevision(db as unknown as SupabaseClient, revision());
    expect(result.action).toBe("skipped");
    expect(result.warning).toMatch(/already imported/);
  });

  it("cancels a known booking", async () => {
    const db = baseDb();
    db.seed("reservations", [{ id: "existing-1", organization_id: orgId, external_id: "booking-1", status: "confirmed" }]);
    const result = await applyRevision(db as unknown as SupabaseClient, revision({ status: "cancelled" }));
    expect(result.action).toBe("cancelled");
    expect(db.tables.reservations.find((r: any) => r.id === "existing-1").status).toBe("cancelled");
  });

  it("skips a cancellation for an unknown booking", async () => {
    const db = baseDb();
    const result = await applyRevision(db as unknown as SupabaseClient, revision({ status: "cancelled" }));
    expect(result.action).toBe("skipped");
    expect(result.warning).toMatch(/unknown/);
  });

  it("parks a modification of a held booking without mutating the reservation", async () => {
    const db = baseDb();
    db.seed("reservations", [{ id: "existing-1", organization_id: orgId, external_id: "booking-1", status: "confirmed" }]);
    db.seed("channex_pending_mods", []);

    const result = await applyRevision(
      db as unknown as SupabaseClient,
      revision({ status: "modified", amount: "150.00", rooms: [{ room_type_id: channexRoomTypeId, checkin_date: "2026-07-02", checkout_date: "2026-07-04" }] })
    );

    expect(result.action).toBe("modified_flagged");
    // The live reservation must be untouched — no auto-apply.
    expect(db.tables.reservations.find((r: any) => r.id === "existing-1").status).toBe("confirmed");
    expect(db.tables.channex_pending_mods).toHaveLength(1);
    expect(db.tables.channex_pending_mods[0]).toMatchObject({
      reservation_id: "existing-1",
      new_check_in: "2026-07-02",
      new_check_out: "2026-07-04",
      new_amount: 150,
    });
  });

  it("imports an overbooking as a flagged, unassigned reservation rather than dropping it", async () => {
    const db = baseDb({ rpcResult: null }); // RPC returns no id -> no free bed/room
    const result = await applyRevision(db as unknown as SupabaseClient, revision());

    expect(result.action).toBe("overbooking");
    expect(result.reservationId).toBeTruthy();
    const created = db.tables.reservations.find((r: any) => r.id === result.reservationId);
    expect(created.overbooked).toBe(true);
    expect(created.status).toBe("pending");
  });

  it("errors cleanly when the revision has no rooms", async () => {
    const db = baseDb();
    const result = await applyRevision(db as unknown as SupabaseClient, revision({ rooms: [] }));
    expect(result.action).toBe("error");
    expect(result.warning).toMatch(/no rooms/);
  });

  it("errors when the room's room_type_id isn't mapped to this org", async () => {
    const db = baseDb();
    const result = await applyRevision(
      db as unknown as SupabaseClient,
      revision({ rooms: [{ room_type_id: "some-other-channex-rt", checkin_date: "2026-07-01", checkout_date: "2026-07-03" }] })
    );
    expect(result.action).toBe("error");
    expect(result.warning).toMatch(/not mapped/);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/channels/channex-bookings.test.ts`
Expected: 9 passed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/channels/channex-bookings.test.ts
git commit -m "test: unit test applyRevision new/cancel/modify/overbooking/dedupe logic"
```

---

### Task 15: Full suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all ~118 tests across 13 test files (the 12 source files from the spec table, plus `fake-supabase.test.ts`) pass, 0 failures.

- [ ] **Step 2: Run typecheck and build to confirm nothing regressed**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors (matches the verification bar used in the prior Channex-restrictions session).

- [ ] **Step 3: Run coverage and eyeball the report**

Run: `npm test -- --coverage`
Expected: a coverage summary prints for `src/lib/**`; no threshold is enforced in this phase (per spec's "Out of scope" — coverage tooling works, gating is deferred), so review it informationally rather than requiring a specific percentage.

This task has no commit of its own — it's a checkpoint confirming Tasks 1–14 are collectively correct.
