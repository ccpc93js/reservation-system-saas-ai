# Phase 2a: API `reservations/` Route Tests Implementation Plan

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 扩展 Phase 1 建立的 fake Supabase client 以支持路由测试所需的能力（auth、关联查询、更多过滤操作符、count 查询），然后为 `src/app/api/reservations/` 下全部 13 个路由文件编写测试。

**架构：** 路由处理函数是普通的导出 async 函数（`GET`/`POST`/`PATCH`/`DELETE`），内部通过 `createServerClient()`（`@/lib/supabase/server` 的模块级导入）获取 Supabase 客户端——不像 Phase 1 的 `src/lib` 函数那样把客户端作为参数传入。测试用 `vi.mock("@/lib/supabase/server")` 让 `createServerClient()` 返回测试控制的 `FakeSupabaseClient` 实例，路由源码零改动，直接调用导出的处理函数并传入构造好的 `Request`。外部副作用模块（`@/lib/email`、`@/lib/notifications`、`@/lib/channels/channex-outbox`、`@/lib/checkout`）整体 mock 掉，不测试其内部实现。这些路由普遍使用关联查询（`beds(name)`、`reservations!inner(status)`）和跨关联的过滤（`.not("reservations.status", "in", ...)`），比 Phase 1 的 Channex 测试复杂得多——fake client 需要一个基于声明式外键表的最小 join 解析器，既支持"多对一"（子表内嵌父表，如 `reservation_items` 内嵌 `beds`）也支持"一对多"（父表内嵌子表数组，如 `reservations` 内嵌 `reservation_items`）。

**技术栈：** Vitest（已配置）、Phase 1 的 `FakeSupabaseClient`（本计划扩展）、`vi.mock`。

---

## File structure

- `src/lib/test/fake-supabase.ts`（修改）— 新增：`auth.getUser()`/`setUser()`、关联查询解析与解析（`FK_MAP` + `parseEmbeds` + `resolveEmbed`）、新过滤操作符（`neq`/`gte`/`lte`/`lt`/`gt`/`is`/`not`/`range`）、真实的多字段 `order()`、`count` 查询支持（`{count:"exact", head:true}` 和 `{count:"exact"}`）。
- `src/lib/test/fake-supabase.test.ts`（修改）— 新增测试覆盖上述每一项新能力。
- `src/app/api/reservations/route.test.ts`（新建）— GET 列表路由。
- `src/app/api/reservations/create/route.test.ts`（新建）
- `src/app/api/reservations/[id]/route.test.ts`（新建）— GET/PATCH/DELETE。
- `src/app/api/reservations/[id]/cancel/route.test.ts`（新建）
- `src/app/api/reservations/[id]/checkout/route.test.ts`（新建）
- `src/app/api/reservations/[id]/extend/route.test.ts`（新建）
- `src/app/api/reservations/[id]/update-dates/route.test.ts`（新建）
- `src/app/api/reservations/[id]/guests/route.test.ts`（新建）
- `src/app/api/reservations/[id]/items/route.test.ts`（新建）
- `src/app/api/reservations/[id]/payment/route.test.ts`（新建）
- `src/app/api/reservations/[id]/registry/route.test.ts`（新建）
- `src/app/api/reservations/[id]/segment-rate/route.test.ts`（新建）
- `src/app/api/reservations/availability/route.test.ts`（新建）

Task 1 必须先完成并落地——后续所有任务都依赖它扩展后的 fake client。Task 2-14 之间相互独立，一旦 Task 1 完成即可任意顺序执行或并行分派。

---

### Task 1: 扩展 fake-supabase.ts（auth、关联查询、过滤操作符、count、真实 order）

**Files:**
- Modify: `src/lib/test/fake-supabase.ts`
- Modify: `src/lib/test/fake-supabase.test.ts`

- [ ] **Step 1: 用完整新内容重写 `src/lib/test/fake-supabase.ts`**

```ts
// src/lib/test/fake-supabase.ts
//
// Minimal fake Supabase client for unit tests. Implements the chainable
// query-builder methods actually used by src/lib and src/app/api code
// today: select/eq/neq/in/or/gte/lte/lt/gt/is/not/order/range/limit/
// single/maybeSingle, insert/update/upsert/delete, rpc(), and auth.getUser().
// Intentionally not a structural subtype of the real SupabaseClient type —
// cast with `as unknown as SupabaseClient` at each call site. Extend this
// file (don't reach for a full Postgrest emulator) if a later test needs a
// method that isn't here yet.
//
// Relational embeds (`.select("beds(name)")`, `.select("reservation_items(...)")`)
// are resolved via FK_MAP below — a declared "child table -> {parent table:
// FK column}" map, not schema introspection. Both directions are supported
// from one declaration: many-to-one (the queried table has the FK — embed
// resolves to a single object) and one-to-many (another table has an FK
// back to the queried table — embed resolves to an array). Add an entry to
// FK_MAP when a new test needs a relationship that isn't declared yet.
//
// Selected plain (non-embed) columns are NOT projected down — a row keeps
// all its original fields plus any resolved embeds attached under their
// name. Real Postgrest would return only the selected columns; every route
// tested against this fake only ever reads the fields it asked for, so the
// extra fields are harmless and this keeps the fake much simpler.

type Row = Record<string, any>;
type Filter = (row: Row) => boolean;
type RpcHandler = (args: any) => { data: any; error: any } | Promise<{ data: any; error: any }>;
type AuthUser = { id: string };

// child table -> { parent table -> FK column on the child }
const FK_MAP: Record<string, Record<string, string>> = {
  reservation_items: { beds: "bed_id", reservations: "reservation_id" },
  beds: { rooms: "room_id" },
  reservations: { guests: "guest_id" },
  reservation_guests: { guests: "guest_id", reservations: "reservation_id" },
};

function getColValue(row: Row, col: string): any {
  if (col.includes(".")) {
    const [rel, prop] = col.split(".");
    return row[rel]?.[prop];
  }
  return row[col];
}

function parsePgList(val: string): string[] {
  const trimmed = val.trim();
  const inner = trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1) : trimmed;
  if (!inner) return [];
  return inner.split(",").map((s) => s.trim().replace(/^"(.*)"$/, "$1"));
}

function parseOrFilter(expr: string): Filter {
  // Supports the subset actually used in this codebase: comma-separated
  // "column.op.value" clauses, OR'd together. ops: is (null only), lte, gte, eq.
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

// Parses top-level "name(...)" / "name!hint(...)" embed clauses out of a
// select string, returning each embed's name and its (unparsed) nested
// select string. Ignores plain column names — those need no resolution.
function parseEmbeds(select: string): { name: string; nested: string }[] {
  const embeds: { name: string; nested: string }[] = [];
  let i = 0;
  const n = select.length;
  while (i < n) {
    const openIdx = select.indexOf("(", i);
    if (openIdx === -1) break;
    let start = openIdx;
    while (start > 0 && /[A-Za-z0-9_!]/.test(select[start - 1])) start--;
    const rawName = select.slice(start, openIdx);
    const name = rawName.split("!")[0];
    let depth = 1;
    let j = openIdx + 1;
    while (j < n && depth > 0) {
      if (select[j] === "(") depth++;
      else if (select[j] === ")") depth--;
      j++;
    }
    const nested = select.slice(openIdx + 1, j - 1);
    if (name) embeds.push({ name, nested });
    i = j;
  }
  return embeds;
}

function resolveEmbed(client: FakeSupabaseClient, table: string, row: Row, embedName: string, nestedSelect: string): any {
  const fkToParent = FK_MAP[table]?.[embedName];
  if (fkToParent) {
    const parentRows = client.tables[embedName] ?? [];
    const match = parentRows.find((r) => r.id === row[fkToParent]);
    return match ? enrichRow(client, embedName, match, nestedSelect) : null;
  }
  const fkToChild = FK_MAP[embedName]?.[table];
  if (fkToChild) {
    const childRows = client.tables[embedName] ?? [];
    return childRows
      .filter((r) => r[fkToChild] === row.id)
      .map((r) => enrichRow(client, embedName, r, nestedSelect));
  }
  throw new Error(`fake-supabase: no FK relationship declared between "${table}" and "${embedName}" — add an entry to FK_MAP`);
}

// Attaches resolved embeds (per selectCols) onto a copy of `row`. No-op
// (returns row as-is) when selectCols has no embed clauses.
function enrichRow(client: FakeSupabaseClient, table: string, row: Row, selectCols: string | null): Row {
  if (!selectCols) return row;
  const embeds = parseEmbeds(selectCols);
  if (embeds.length === 0) return row;
  const out: Row = { ...row };
  for (const { name, nested } of embeds) {
    out[name] = resolveEmbed(client, table, row, name, nested);
  }
  return out;
}

function compareByOrders(a: Row, b: Row, orders: { col: string; ascending: boolean }[]): number {
  for (const { col, ascending } of orders) {
    const av = getColValue(a, col);
    const bv = getColValue(b, col);
    if (av === bv) continue;
    if (av == null) return ascending ? -1 : 1;
    if (bv == null) return ascending ? 1 : -1;
    return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
  }
  return 0;
}

class FakeQueryBuilder implements PromiseLike<{ data: any; error: any; count?: number }> {
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any = null;
  private wantSingle = false;
  private wantMaybe = false;
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private selectCols: string | null = null;
  private countMode: "exact" | null = null;
  private headOnly = false;
  private orders: { col: string; ascending: boolean }[] = [];
  private upsertOnConflict?: string;

  constructor(private client: FakeSupabaseClient, private table: string) {}

  select(cols?: string, opts?: { count?: "exact"; head?: boolean }) {
    this.selectCols = cols ?? null;
    this.countMode = opts?.count ?? null;
    this.headOnly = !!opts?.head;
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push((row) => getColValue(row, col) === val);
    return this;
  }
  neq(col: string, val: any) {
    this.filters.push((row) => getColValue(row, col) !== val);
    return this;
  }
  in(col: string, vals: any[]) {
    this.filters.push((row) => vals.includes(getColValue(row, col)));
    return this;
  }
  gte(col: string, val: any) {
    this.filters.push((row) => getColValue(row, col) != null && getColValue(row, col) >= val);
    return this;
  }
  lte(col: string, val: any) {
    this.filters.push((row) => getColValue(row, col) != null && getColValue(row, col) <= val);
    return this;
  }
  lt(col: string, val: any) {
    this.filters.push((row) => getColValue(row, col) != null && getColValue(row, col) < val);
    return this;
  }
  gt(col: string, val: any) {
    this.filters.push((row) => getColValue(row, col) != null && getColValue(row, col) > val);
    return this;
  }
  is(col: string, val: any) {
    this.filters.push((row) => (val === null ? getColValue(row, col) == null : getColValue(row, col) === val));
    return this;
  }
  not(col: string, op: string, val: any) {
    this.filters.push((row) => {
      const v = getColValue(row, col);
      if (op === "eq") return v !== val;
      if (op === "in") {
        const list = Array.isArray(val) ? val : parsePgList(String(val));
        return !list.includes(v);
      }
      throw new Error(`fake-supabase: unsupported not() op "${op}"`);
    });
    return this;
  }
  or(expr: string) {
    this.filters.push(parseOrFilter(expr));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, ascending: opts?.ascending !== false });
    return this;
  }
  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
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
  upsert(payload: any, opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = payload;
    this.upsertOnConflict = opts?.onConflict;
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

  private run(): { data: any; error: any; count?: number } {
    const rows = this.tableRows();

    if (this.op === "select") {
      const enriched = rows.map((r) => enrichRow(this.client, this.table, r, this.selectCols));
      let result = enriched.filter((r) => this.filters.every((f) => f(r)));
      const totalCount = result.length;

      if (this.orders.length > 0) {
        result = [...result].sort((a, b) => compareByOrders(a, b, this.orders));
      }
      if (this.rangeFrom != null && this.rangeTo != null) {
        result = result.slice(this.rangeFrom, this.rangeTo + 1);
      } else if (this.limitN != null) {
        result = result.slice(0, this.limitN);
      }

      const count = this.countMode ? totalCount : undefined;
      if (this.headOnly) return { data: null, error: null, count };
      if (this.wantSingle) {
        return result.length === 1
          ? { data: result[0], error: null, count }
          : { data: null, error: { message: `expected 1 row, got ${result.length}` } };
      }
      if (this.wantMaybe) return { data: result[0] ?? null, error: null, count };
      return { data: result, error: null, count };
    }

    if (this.op === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const inserted = items.map((it, i) => ({
        id: it.id ?? `fake-${this.table}-${rows.length + i}`,
        ...it,
      }));
      rows.push(...inserted);
      const withEmbeds = inserted.map((r) => enrichRow(this.client, this.table, r, this.selectCols));
      const data = withEmbeds.length === 1 ? withEmbeds[0] : withEmbeds;
      return { data, error: null };
    }

    if (this.op === "update") {
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      for (const row of matched) Object.assign(row, this.payload);
      return { data: this.wantSingle ? matched[0] ?? null : matched, error: null };
    }

    if (this.op === "upsert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const conflictKeys = this.upsertOnConflict
        ? this.upsertOnConflict.split(",").map((k) => k.trim())
        : Object.keys(items[0] ?? {}).filter((k) => k !== "id" && k !== "updated_at");
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

  then<TResult1 = { data: any; error: any; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export class FakeSupabaseClient {
  tables: Record<string, Row[]> = {};
  private rpcHandlers: Record<string, RpcHandler> = {};
  private currentUser: AuthUser | null = null;

  /** Set (or clear, with null) the user returned by auth.getUser(). */
  setUser(user: AuthUser | null): void {
    this.currentUser = user;
  }

  auth = {
    getUser: async () => ({
      data: { user: this.currentUser },
      error: this.currentUser ? null : { message: "Auth session missing!" },
    }),
  };

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

- [ ] **Step 2: 追加新测试到 `src/lib/test/fake-supabase.test.ts`**

在文件末尾（最后一个 `});` 之后）追加：

```ts

describe("FakeSupabaseClient — auth", () => {
  it("getUser() returns null with an error when no user is set", async () => {
    const db = new FakeSupabaseClient();
    const { data, error } = await db.auth.getUser();
    expect(data.user).toBeNull();
    expect(error).not.toBeNull();
  });

  it("getUser() returns the set user with no error", async () => {
    const db = new FakeSupabaseClient();
    db.setUser({ id: "user-1" });
    const { data, error } = await db.auth.getUser();
    expect(data.user).toEqual({ id: "user-1" });
    expect(error).toBeNull();
  });
});

describe("FakeSupabaseClient — relational embeds", () => {
  it("resolves a many-to-one embed (child table embeds its parent)", async () => {
    const db = new FakeSupabaseClient();
    db.seed("beds", [{ id: "bed-1", name: "Bed A", room_id: "room-1" }]);
    db.seed("reservation_items", [{ id: "item-1", bed_id: "bed-1", reservation_id: "res-1" }]);
    const { data } = await db.from("reservation_items").select("id, beds(name)").eq("id", "item-1").single();
    expect(data.beds).toEqual({ name: "Bed A" });
  });

  it("resolves a one-to-many embed (parent table embeds an array of children)", async () => {
    const db = new FakeSupabaseClient();
    db.seed("reservations", [{ id: "res-1" }]);
    db.seed("reservation_items", [
      { id: "item-1", reservation_id: "res-1", bed_id: "bed-1" },
      { id: "item-2", reservation_id: "res-1", bed_id: "bed-2" },
    ]);
    const { data } = await db.from("reservations").select("id, reservation_items(bed_id)").eq("id", "res-1").single();
    expect(data.reservation_items).toEqual([{ bed_id: "bed-1" }, { bed_id: "bed-2" }]);
  });

  it("resolves nested embeds two levels deep", async () => {
    const db = new FakeSupabaseClient();
    db.seed("rooms", [{ id: "room-1", name: "Yellow Dorm" }]);
    db.seed("beds", [{ id: "bed-1", name: "Bed A", room_id: "room-1" }]);
    db.seed("reservation_items", [{ id: "item-1", bed_id: "bed-1" }]);
    const { data } = await db.from("reservation_items").select("beds(name, rooms(name))").eq("id", "item-1").single();
    expect(data.beds).toEqual({ name: "Bed A", rooms: { name: "Yellow Dorm" } });
  });

  it("throws a clear error for an undeclared relationship", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "w-1" }]);
    await expect(db.from("widgets").select("gadgets(name)").eq("id", "w-1").single()).rejects.toThrow(
      /no FK relationship declared/
    );
  });
});

describe("FakeSupabaseClient — filter operators", () => {
  it("gte/lte/lt/gt compare correctly", async () => {
    const db = new FakeSupabaseClient();
    db.seed("nums", [{ id: "1", n: 5 }, { id: "2", n: 10 }, { id: "3", n: 15 }]);
    expect((await db.from("nums").select("*").gte("n", 10)).data).toHaveLength(2);
    expect((await db.from("nums").select("*").lte("n", 10)).data).toHaveLength(2);
    expect((await db.from("nums").select("*").lt("n", 10)).data).toHaveLength(1);
    expect((await db.from("nums").select("*").gt("n", 10)).data).toHaveLength(1);
  });

  it("neq excludes the matching row", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "1" }, { id: "2" }]);
    const { data } = await db.from("widgets").select("*").neq("id", "1");
    expect(data).toEqual([{ id: "2" }]);
  });

  it("is(col, null) matches null/undefined, is(col, val) matches an exact value", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "1", x: null }, { id: "2", x: "set" }]);
    expect((await db.from("widgets").select("*").is("x", null)).data).toEqual([{ id: "1", x: null }]);
  });

  it("not(col, 'eq', val) excludes the matching row", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "1" }, { id: "2" }]);
    const { data } = await db.from("widgets").select("*").not("id", "eq", "1");
    expect(data).toEqual([{ id: "2" }]);
  });

  it("not(col, 'in', pgList) on an embedded column filters by the joined table's field", async () => {
    const db = new FakeSupabaseClient();
    db.seed("reservations", [
      { id: "res-1", status: "confirmed" },
      { id: "res-2", status: "cancelled" },
    ]);
    db.seed("reservation_items", [
      { id: "item-1", reservation_id: "res-1", bed_id: "bed-1" },
      { id: "item-2", reservation_id: "res-2", bed_id: "bed-1" },
    ]);
    const { data } = await db
      .from("reservation_items")
      .select("id, reservations(status)")
      .not("reservations.status", "in", '("cancelled","no_show")');
    expect(data).toEqual([{ id: "item-1", reservations: { status: "confirmed" } }]);
  });
});

describe("FakeSupabaseClient — count queries", () => {
  it("head:true returns only the count, no rows", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "1" }, { id: "2" }, { id: "3" }]);
    const { data, count } = await db.from("widgets").select("id", { count: "exact", head: true }).eq("id", "1");
    expect(data).toBeNull();
    expect(count).toBe(1);
  });

  it("count without head returns both rows and the total count", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "1" }, { id: "2" }]);
    const { data, count } = await db.from("widgets").select("*", { count: "exact" });
    expect(data).toHaveLength(2);
    expect(count).toBe(2);
  });

  it("count reflects the filtered total, ignoring range/limit", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "1" }, { id: "2" }, { id: "3" }]);
    const { data, count } = await db.from("widgets").select("*", { count: "exact" }).range(0, 0);
    expect(data).toHaveLength(1);
    expect(count).toBe(3);
  });
});

describe("FakeSupabaseClient — order and range", () => {
  it("order() sorts ascending by default, descending when requested", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "1", n: 3 }, { id: "2", n: 1 }, { id: "3", n: 2 }]);
    const asc = await db.from("widgets").select("*").order("n");
    expect(asc.data.map((r: any) => r.n)).toEqual([1, 2, 3]);
    const desc = await db.from("widgets").select("*").order("n", { ascending: false });
    expect(desc.data.map((r: any) => r.n)).toEqual([3, 2, 1]);
  });

  it("chained order() calls sort by a secondary key", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [
      { id: "1", is_primary: false, created_at: "2026-01-02" },
      { id: "2", is_primary: true, created_at: "2026-01-03" },
      { id: "3", is_primary: false, created_at: "2026-01-01" },
    ]);
    const { data } = await db
      .from("widgets")
      .select("*")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    expect(data.map((r: any) => r.id)).toEqual(["2", "3", "1"]);
  });

  it("range() slices the result inclusively", async () => {
    const db = new FakeSupabaseClient();
    db.seed("widgets", [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }]);
    const { data } = await db.from("widgets").select("*").order("id").range(1, 2);
    expect(data.map((r: any) => r.id)).toEqual(["2", "3"]);
  });
});

describe("FakeSupabaseClient — insert with embeds", () => {
  it("resolves embeds on the row returned by insert().select(...)", async () => {
    const db = new FakeSupabaseClient();
    db.seed("guests", [{ id: "guest-1", first_name: "Jane" }]);
    const { data } = await db
      .from("reservation_guests")
      .insert({ id: "rg-1", guest_id: "guest-1", is_primary: true })
      .select("id, is_primary, guests(first_name)")
      .single();
    expect(data).toEqual({ id: "rg-1", is_primary: true, guest_id: "guest-1", guests: { first_name: "Jane" } });
  });
});
```

- [ ] **Step 3: 运行完整的 fake-supabase 测试套件**

Run: `npm test -- src/lib/test/fake-supabase.test.ts`
Expected: 9（Phase 1 原有）+ 18（新增）= 27 passed。

- [ ] **Step 4: 运行 typecheck 和完整套件，确认没有破坏 Phase 1 的任何测试**

Run: `npm run typecheck && npm test`
Expected: typecheck 无输出；`npm test` 122（Phase 1）+ 18（新增）= 140 passed，0 failed（Phase 1 的 13 个测试文件必须原样全部通过，证明这次扩展是纯加法、没有破坏任何已有行为）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/test/fake-supabase.ts src/lib/test/fake-supabase.test.ts
git commit -m "test: extend fake Supabase client with auth, relational embeds, filter operators, count queries"
```

---

### Task 2: `reservations/route.ts`（GET 列表）

**Files:**
- Test: `src/app/api/reservations/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));

import { GET } from "./route";

const orgId = "org-1";

function req(query = "") {
  return new Request(`http://test/api/reservations${query}`);
}

describe("GET /api/reservations", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser(null);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user has no membership", async () => {
    db.setUser({ id: "user-1" });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("lists reservations for the caller's org, with pagination metadata", async () => {
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [
      { id: "r1", organization_id: orgId, reservation_number: "R1", check_in: "2026-07-01", check_out: "2026-07-03", status: "confirmed", channel: "direct_website", overbooked: false, total_amount: 100, paid_amount: 0, created_at: "2026-06-01" },
      { id: "r2", organization_id: "other-org", reservation_number: "R2", check_in: "2026-07-01", check_out: "2026-07-03", status: "confirmed", channel: "direct_website", overbooked: false, total_amount: 100, paid_amount: 0, created_at: "2026-06-02" },
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reservations).toHaveLength(1);
    expect(body.reservations[0].id).toBe("r1");
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
  });

  it("filters by status (comma-separated)", async () => {
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [
      { id: "r1", organization_id: orgId, status: "confirmed", channel: "direct_website", overbooked: false, total_amount: 0, paid_amount: 0, check_in: "2026-07-01", check_out: "2026-07-02", created_at: "2026-06-01" },
      { id: "r2", organization_id: orgId, status: "cancelled", channel: "direct_website", overbooked: false, total_amount: 0, paid_amount: 0, check_in: "2026-07-01", check_out: "2026-07-02", created_at: "2026-06-01" },
    ]);

    const res = await GET(req("?status=confirmed"));
    const body = await res.json();
    expect(body.reservations.map((r: any) => r.id)).toEqual(["r1"]);
  });

  it("applies pagination via page/limit", async () => {
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed(
      "reservations",
      Array.from({ length: 3 }, (_, i) => ({
        id: `r${i}`, organization_id: orgId, status: "confirmed", channel: "direct_website",
        overbooked: false, total_amount: 0, paid_amount: 0, check_in: "2026-07-01", check_out: "2026-07-02",
        created_at: `2026-06-0${i + 1}`,
      }))
    );

    const res = await GET(req("?page=2&limit=1&sort=created_at:asc"));
    const body = await res.json();
    expect(body.reservations).toHaveLength(1);
    expect(body.reservations[0].id).toBe("r1");
    expect(body.total).toBe(3);
    expect(body.totalPages).toBe(3);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- src/app/api/reservations/route.test.ts`
Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reservations/route.test.ts
git commit -m "test: unit test GET /api/reservations list route"
```

---

### Task 3: `reservations/create/route.ts`

**Files:**
- Test: `src/app/api/reservations/create/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/create/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));
vi.mock("@/lib/email", () => ({
  sendReservationConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  getOrgBranding: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/notifications", () => ({ notifyOrg: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/channels/channex-outbox", () => ({ enqueueAvailability: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "./route";

const orgId = "org-1";
const validBody = {
  guest_id: "new",
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@example.com",
  check_in: "2026-07-01",
  check_out: "2026-07-03",
  price_per_night: 50,
  bed_id: "bed-1",
  org_id: orgId,
};

function req(body: any) {
  return new Request("http://test/api/reservations/create", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/reservations/create", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("beds", [{ id: "bed-1", name: "Bed A", room_id: "room-1" }]);
    db.seed("reservation_items", []);
    db.seed("reservations", []);
    db.seed("guests", []);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a body that fails schema validation", async () => {
    const res = await POST(req({ ...validBody, price_per_night: undefined }));
    expect(res.status).toBe(400);
  });

  it("creates a guest, a reservation, and one reservation_item per bed", async () => {
    const res = await POST(req(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(db.tables.guests).toHaveLength(1);
    expect(db.tables.reservations).toHaveLength(1);
    expect(db.tables.reservation_items).toHaveLength(1);
    expect(db.tables.reservation_items[0].total_price).toBe(100); // 2 nights * 50
  });

  it("books every bed in bed_ids and multiplies the total accordingly", async () => {
    db.seed("beds", [
      { id: "bed-1", name: "Bed A", room_id: "room-1" },
      { id: "bed-2", name: "Bed B", room_id: "room-1" },
    ]);
    const res = await POST(req({ ...validBody, bed_id: undefined, bed_ids: ["bed-1", "bed-2"] }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(db.tables.reservation_items).toHaveLength(2);
    const reservation = db.tables.reservations.find((r: any) => r.id === body.reservation_id);
    expect(reservation.total_amount).toBe(200); // 2 nights * 50 * 2 beds
  });

  it("rejects and rolls back when the requested bed is already booked for overlapping dates", async () => {
    db.seed("reservations", [{ id: "existing-res", organization_id: orgId, status: "confirmed" }]);
    db.seed("reservation_items", [
      { id: "existing-item", bed_id: "bed-1", reservation_id: "existing-res", check_in: "2026-07-02", check_out: "2026-07-04" },
    ]);

    const res = await POST(req(validBody));
    expect(res.status).toBe(409);
    expect(db.tables.reservations).toHaveLength(1); // only the pre-seeded one — the new one was rolled back
  });

  it("reuses an existing guest when guest_id is not 'new'", async () => {
    db.seed("guests", [{ id: "guest-1", organization_id: orgId, first_name: "Existing" }]);
    const res = await POST(req({ ...validBody, guest_id: "guest-1" }));
    expect(res.status).toBe(201);
    expect(db.tables.guests).toHaveLength(1); // no new guest created
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- src/app/api/reservations/create/route.test.ts`
Expected: 6 passed.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reservations/create/route.test.ts
git commit -m "test: unit test POST /api/reservations/create route"
```

---

### Task 4: `reservations/[id]/route.ts`（GET/PATCH/DELETE）

**Files:**
- Test: `src/app/api/reservations/[id]/route.test.ts`

- [ ] **Step 1: 编写测试**

Note: this route file only exports `PATCH` and `DELETE` (confirmed by reading the source — there is no `GET` in `src/app/api/reservations/[id]/route.ts`).

```ts
// src/app/api/reservations/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));
vi.mock("@/lib/checkout", () => ({ finalizeCheckout: vi.fn().mockResolvedValue(undefined) }));

import { PATCH, DELETE } from "./route";
import { finalizeCheckout } from "@/lib/checkout";

const orgId = "org-1";
const resId = "res-1";

function patchReq(body: any) {
  return new Request(`http://test/api/reservations/${resId}`, { method: "PATCH", body: JSON.stringify(body) });
}
function deleteReq() {
  return new Request(`http://test/api/reservations/${resId}`, { method: "DELETE" });
}
const params = () => Promise.resolve({ id: resId });

describe("PATCH /api/reservations/[id]", () => {
  beforeEach(() => {
    db.tables = {};
    vi.mocked(finalizeCheckout).mockClear();
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [{ id: resId, organization_id: orgId, status: "confirmed" }]);
    db.seed("reservation_guests", []);
    db.seed("checkin_registry", []);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await PATCH(patchReq({ status: "confirmed" }), { params: params() });
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown reservation", async () => {
    const res = await PATCH(patchReq({ status: "confirmed" }), { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("updates allowed fields", async () => {
    const res = await PATCH(patchReq({ notes: "updated" }), { params: params() });
    expect(res.status).toBe(200);
    expect(db.tables.reservations.find((r: any) => r.id === resId).notes).toBe("updated");
  });

  it("syncs reservation_guests when guest_id changes: demotes the old primary, upserts the new one", async () => {
    db.seed("reservation_guests", [{ id: "rg-1", reservation_id: resId, guest_id: "old-guest", is_primary: true }]);
    const res = await PATCH(patchReq({ guest_id: "new-guest" }), { params: params() });
    expect(res.status).toBe(200);
    const rows = db.tables.reservation_guests;
    expect(rows.find((r: any) => r.guest_id === "old-guest").is_primary).toBe(false);
    expect(rows.find((r: any) => r.guest_id === "new-guest").is_primary).toBe(true);
  });

  it("calls finalizeCheckout when status transitions to checked_out", async () => {
    const res = await PATCH(patchReq({ status: "checked_out" }), { params: params() });
    expect(res.status).toBe(200);
    expect(finalizeCheckout).toHaveBeenCalledWith(db, resId);
  });
});

describe("DELETE /api/reservations/[id]", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [{ id: resId, organization_id: orgId }]);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await DELETE(deleteReq(), { params: params() });
    expect(res.status).toBe(401);
  });

  it("deletes the reservation", async () => {
    const res = await DELETE(deleteReq(), { params: params() });
    expect(res.status).toBe(200);
    expect(db.tables.reservations).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- "src/app/api/reservations/[id]/route.test.ts"`
Expected: 7 passed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/reservations/[id]/route.test.ts"
git commit -m "test: unit test PATCH/DELETE /api/reservations/[id] route"
```

---

### Task 5: `reservations/[id]/cancel/route.ts`

**Files:**
- Test: `src/app/api/reservations/[id]/cancel/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/[id]/cancel/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));
vi.mock("@/lib/email", () => ({
  sendReservationCancelledEmail: vi.fn().mockResolvedValue(undefined),
  getOrgBranding: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/notifications", () => ({ notifyOrg: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/channels/channex-outbox", () => ({ enqueueAvailability: vi.fn().mockResolvedValue(undefined) }));

import { PATCH } from "./route";
import { enqueueAvailability } from "@/lib/channels/channex-outbox";

const orgId = "org-1";
const resId = "res-1";
const params = () => Promise.resolve({ id: resId });

function req(body: any) {
  return new Request(`http://test/api/reservations/${resId}/cancel`, { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/reservations/[id]/cancel", () => {
  beforeEach(() => {
    db.tables = {};
    vi.mocked(enqueueAvailability).mockClear();
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [
      { id: resId, organization_id: orgId, check_in: "2026-07-01", check_out: "2026-07-03", status: "confirmed", guest_id: null },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await PATCH(req({ cancellation_reason: "guest_request" }), { params: params() });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid cancellation reason", async () => {
    const res = await PATCH(req({ cancellation_reason: "changed_my_mind" }), { params: params() });
    expect(res.status).toBe(400);
  });

  it("cancels the reservation and re-enqueues availability for the freed range", async () => {
    const res = await PATCH(req({ cancellation_reason: "guest_request" }), { params: params() });
    expect(res.status).toBe(200);
    expect(db.tables.reservations.find((r: any) => r.id === resId).status).toBe("cancelled");
    expect(enqueueAvailability).toHaveBeenCalledWith(db, orgId, "2026-07-01", "2026-07-03");
  });

  it("returns 403 when the caller has no membership in the reservation's org", async () => {
    db.tables.memberships = [];
    const res = await PATCH(req({ cancellation_reason: "guest_request" }), { params: params() });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- "src/app/api/reservations/[id]/cancel/route.test.ts"`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/reservations/[id]/cancel/route.test.ts"
git commit -m "test: unit test PATCH /api/reservations/[id]/cancel route"
```

---

### Task 6: `reservations/[id]/checkout/route.ts`

**Files:**
- Test: `src/app/api/reservations/[id]/checkout/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/[id]/checkout/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));
vi.mock("@/lib/checkout", () => ({ finalizeCheckout: vi.fn().mockResolvedValue(undefined) }));

import { PATCH } from "./route";
import { finalizeCheckout } from "@/lib/checkout";

const orgId = "org-1";
const resId = "res-1";
const params = () => Promise.resolve({ id: resId });

function req(body: any) {
  return new Request(`http://test/api/reservations/${resId}/checkout`, { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/reservations/[id]/checkout", () => {
  beforeEach(() => {
    db.tables = {};
    vi.mocked(finalizeCheckout).mockClear();
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [
      { id: resId, organization_id: orgId, status: "checked_in", total_amount: 200, check_out: "2026-07-03", guest_id: null, paid_amount: 100 },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await PATCH(req({}), { params: params() });
    expect(res.status).toBe(401);
  });

  it("rejects a negative paid_amount", async () => {
    const res = await PATCH(req({ paid_amount: -5 }), { params: params() });
    expect(res.status).toBe(400);
  });

  it("checks the reservation out, updates paid_amount, and returns a receipt", async () => {
    const res = await PATCH(req({ paid_amount: 200 }), { params: params() });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.tables.reservations.find((r: any) => r.id === resId).status).toBe("checked_out");
    expect(db.tables.reservations.find((r: any) => r.id === resId).paid_amount).toBe(200);
    expect(body.receipt).toEqual({ total_amount: 200, paid_amount: 200 });
    expect(finalizeCheckout).toHaveBeenCalledWith(db, resId);
  });

  it("checks out without a paid_amount, defaulting the receipt's paid_amount to 0", async () => {
    const res = await PATCH(req({}), { params: params() });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.receipt.paid_amount).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- "src/app/api/reservations/[id]/checkout/route.test.ts"`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/reservations/[id]/checkout/route.test.ts"
git commit -m "test: unit test PATCH /api/reservations/[id]/checkout route"
```

---

### Task 7: `reservations/[id]/extend/route.ts`

**Files:**
- Test: `src/app/api/reservations/[id]/extend/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/[id]/extend/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));
vi.mock("@/lib/channels/channex-outbox", () => ({ enqueueAvailability: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "./route";

const orgId = "org-1";
const resId = "res-1";
const params = () => Promise.resolve({ id: resId });

function req(body: any) {
  return new Request(`http://test/api/reservations/${resId}/extend`, { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/reservations/[id]/extend", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [
      { id: resId, organization_id: orgId, check_in: "2026-07-01", check_out: "2026-07-03", total_amount: 100, paid_amount: 0 },
    ]);
    db.seed("reservation_items", [
      { id: "item-1", reservation_id: resId, bed_id: "bed-1", check_in: "2026-07-01", check_out: "2026-07-03", total_price: 100 },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(req({ new_check_out: "2026-07-05", price_per_night: 50 }), { params: params() });
    expect(res.status).toBe(401);
  });

  it("rejects a new_check_out that is not after the current check_out", async () => {
    const res = await POST(req({ new_check_out: "2026-07-02", price_per_night: 50 }), { params: params() });
    expect(res.status).toBe(400);
  });

  it("extends the stay: adds an item for the extension nights and recomputes the total", async () => {
    const res = await POST(req({ new_check_out: "2026-07-05", price_per_night: 50 }), { params: params() });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.extension_nights).toBe(2);
    expect(db.tables.reservation_items).toHaveLength(2);
    expect(db.tables.reservations.find((r: any) => r.id === resId).check_out).toBe("2026-07-05");
    expect(db.tables.reservations.find((r: any) => r.id === resId).total_amount).toBe(200); // 100 existing + 100 new
  });

  it("rejects when the bed is booked by another reservation during the extension window", async () => {
    db.seed("reservations", [
      { id: resId, organization_id: orgId, check_in: "2026-07-01", check_out: "2026-07-03", total_amount: 100, paid_amount: 0 },
      { id: "other-res", organization_id: orgId, status: "confirmed" },
    ]);
    db.seed("reservation_items", [
      { id: "item-1", reservation_id: resId, bed_id: "bed-1", check_in: "2026-07-01", check_out: "2026-07-03", total_price: 100 },
      { id: "item-2", reservation_id: "other-res", bed_id: "bed-1", check_in: "2026-07-03", check_out: "2026-07-06" },
    ]);
    const res = await POST(req({ new_check_out: "2026-07-05", price_per_night: 50 }), { params: params() });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- "src/app/api/reservations/[id]/extend/route.test.ts"`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/reservations/[id]/extend/route.test.ts"
git commit -m "test: unit test POST /api/reservations/[id]/extend route"
```

---

### Task 8: `reservations/[id]/update-dates/route.ts`

**Files:**
- Test: `src/app/api/reservations/[id]/update-dates/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/[id]/update-dates/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));
vi.mock("@/lib/channels/channex-outbox", () => ({ enqueueAvailability: vi.fn().mockResolvedValue(undefined) }));

import { PATCH } from "./route";

const orgId = "org-1";
const resId = "res-1";
const params = () => Promise.resolve({ id: resId });

function req(body: any) {
  return new Request(`http://test/api/reservations/${resId}/update-dates`, { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/reservations/[id]/update-dates", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [{ id: resId, organization_id: orgId, check_in: "2026-07-01", check_out: "2026-07-03" }]);
    db.seed("reservation_items", [
      { id: "item-1", reservation_id: resId, bed_id: "bed-1", price_per_night: 50, check_in: "2026-07-01" },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await PATCH(req({ check_in: "2026-07-02", check_out: "2026-07-04" }), { params: params() });
    expect(res.status).toBe(401);
  });

  it("rejects check_out on or before check_in", async () => {
    const res = await PATCH(req({ check_in: "2026-07-05", check_out: "2026-07-04" }), { params: params() });
    expect(res.status).toBe(400);
  });

  it("rebuilds reservation_items for the new dates, keeping each bed's rate, and updates the total", async () => {
    const res = await PATCH(req({ check_in: "2026-07-02", check_out: "2026-07-05" }), { params: params() });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nights).toBe(3);
    expect(db.tables.reservation_items).toHaveLength(1);
    expect(db.tables.reservation_items[0].check_in).toBe("2026-07-02");
    expect(db.tables.reservation_items[0].check_out).toBe("2026-07-05");
    expect(db.tables.reservation_items[0].price_per_night).toBe(50);
    expect(db.tables.reservations.find((r: any) => r.id === resId).total_amount).toBe(150);
  });

  it("rejects when the new dates conflict with another reservation on the same bed", async () => {
    db.seed("reservations", [
      { id: resId, organization_id: orgId, check_in: "2026-07-01", check_out: "2026-07-03" },
      { id: "other-res", organization_id: orgId, status: "confirmed" },
    ]);
    db.seed("reservation_items", [
      { id: "item-1", reservation_id: resId, bed_id: "bed-1", price_per_night: 50, check_in: "2026-07-01" },
      { id: "item-2", reservation_id: "other-res", bed_id: "bed-1", check_in: "2026-07-06", check_out: "2026-07-08" },
    ]);
    const res = await PATCH(req({ check_in: "2026-07-05", check_out: "2026-07-07" }), { params: params() });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- "src/app/api/reservations/[id]/update-dates/route.test.ts"`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/reservations/[id]/update-dates/route.test.ts"
git commit -m "test: unit test PATCH /api/reservations/[id]/update-dates route"
```

---

### Task 9: `reservations/[id]/guests/route.ts`

**Files:**
- Test: `src/app/api/reservations/[id]/guests/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/[id]/guests/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));

import { GET, POST, DELETE } from "./route";

const orgId = "org-1";
const resId = "res-1";
const params = () => Promise.resolve({ id: resId });

function getReq() {
  return new Request(`http://test/api/reservations/${resId}/guests`);
}
function postReq(body: any) {
  return new Request(`http://test/api/reservations/${resId}/guests`, { method: "POST", body: JSON.stringify(body) });
}
function deleteReq(guestId: string) {
  return new Request(`http://test/api/reservations/${resId}/guests?guest_id=${guestId}`, { method: "DELETE" });
}

describe("/api/reservations/[id]/guests", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [{ id: resId, organization_id: orgId }]);
    db.seed("reservation_items", [{ id: "item-1", reservation_id: resId, bed_id: "bed-1" }]);
    db.seed("guests", [{ id: "guest-2", organization_id: orgId, first_name: "Jo" }]);
    db.seed("reservation_guests", [
      { id: "rg-1", reservation_id: resId, guest_id: "guest-1", is_primary: true, created_at: "2026-01-01" },
    ]);
  });

  it("GET lists guests, primary first", async () => {
    const res = await GET(getReq(), { params: params() });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.guests).toHaveLength(1);
    expect(body.guests[0].is_primary).toBe(true);
  });

  it("POST attaches a companion guest when there's a free bed", async () => {
    // beforeEach seeds 1 bed + 1 existing guest (at capacity) — add a second
    // bed so there's room for a companion.
    db.tables.reservation_items.push({ id: "item-2", reservation_id: resId, bed_id: "bed-2" });
    const res = await POST(postReq({ guest_id: "guest-2" }), { params: params() });
    expect(res.status).toBe(200);
    expect(db.tables.reservation_guests.find((r: any) => r.guest_id === "guest-2")).toMatchObject({ is_primary: false });
  });

  it("POST returns 409 when the reservation is already at bed capacity", async () => {
    // one bed, already one guest → capacity is full
    const res = await POST(postReq({ guest_id: "guest-2" }), { params: params() });
    // capacity check happens before insert: 1 existing guest, 1 bed → full
    expect(res.status).toBe(409);
  });

  it("DELETE removes a companion guest", async () => {
    db.tables.reservation_guests.push({ id: "rg-2", reservation_id: resId, guest_id: "guest-2", is_primary: false });
    const res = await DELETE(deleteReq("guest-2"), { params: params() });
    expect(res.status).toBe(200);
    expect(db.tables.reservation_guests.find((r: any) => r.guest_id === "guest-2")).toBeUndefined();
  });

  it("DELETE refuses to remove the primary guest", async () => {
    const res = await DELETE(deleteReq("guest-1"), { params: params() });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- "src/app/api/reservations/[id]/guests/route.test.ts"`
Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/reservations/[id]/guests/route.test.ts"
git commit -m "test: unit test /api/reservations/[id]/guests route"
```

---

### Task 10: `reservations/[id]/items/route.ts`

**Files:**
- Test: `src/app/api/reservations/[id]/items/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/[id]/items/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));

import { POST, DELETE } from "./route";

const orgId = "org-1";
const resId = "res-1";
const params = () => Promise.resolve({ id: resId });

function postReq(body: any) {
  return new Request(`http://test/api/reservations/${resId}/items`, { method: "POST", body: JSON.stringify(body) });
}
function deleteReq(bedId: string) {
  return new Request(`http://test/api/reservations/${resId}/items?bed_id=${bedId}`, { method: "DELETE" });
}

describe("POST /api/reservations/[id]/items (add bed)", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [
      { id: resId, organization_id: orgId, check_in: "2026-07-01", check_out: "2026-07-03", total_amount: 100, overbooked: false },
    ]);
    db.seed("reservation_items", [
      { id: "item-1", reservation_id: resId, bed_id: "bed-1", price_per_night: 50, total_price: 100 },
    ]);
    db.seed("beds", [
      { id: "bed-1", room_id: "room-1", organization_id: orgId, name: "Bed A", is_active: true },
      { id: "bed-2", room_id: "room-1", organization_id: orgId, name: "Bed B", is_active: true },
      { id: "bed-3", room_id: "room-2", organization_id: orgId, name: "Bed C", is_active: true },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(postReq({ bed_id: "bed-2" }), { params: params() });
    expect(res.status).toBe(401);
  });

  it("adds a bed from the same room at the existing rate", async () => {
    const res = await POST(postReq({ bed_id: "bed-2" }), { params: params() });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(db.tables.reservation_items).toHaveLength(2);
    expect(body.total_amount).toBe(200);
  });

  it("rejects a bed from a different room", async () => {
    const res = await POST(postReq({ bed_id: "bed-3" }), { params: params() });
    expect(res.status).toBe(400);
  });

  it("rejects a bed already on the reservation", async () => {
    const res = await POST(postReq({ bed_id: "bed-1" }), { params: params() });
    expect(res.status).toBe(409);
  });

  it("clears the overbooked flag when placing a first bed on a bedless reservation", async () => {
    db.seed("reservation_items", []);
    db.seed("reservations", [
      { id: resId, organization_id: orgId, check_in: "2026-07-01", check_out: "2026-07-03", total_amount: 100, overbooked: true },
    ]);
    const res = await POST(postReq({ bed_id: "bed-2" }), { params: params() });
    expect(res.status).toBe(200);
    expect(db.tables.reservations.find((r: any) => r.id === resId).overbooked).toBe(false);
  });
});

describe("DELETE /api/reservations/[id]/items (remove bed)", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [{ id: resId, organization_id: orgId, total_amount: 200 }]);
    db.seed("reservation_items", [
      { id: "item-1", reservation_id: resId, bed_id: "bed-1", total_price: 100 },
      { id: "item-2", reservation_id: resId, bed_id: "bed-2", total_price: 100 },
    ]);
    db.seed("reservation_guests", []);
  });

  it("removes a bed and recomputes the total", async () => {
    const res = await DELETE(deleteReq("bed-2"), { params: params() });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(db.tables.reservation_items).toHaveLength(1);
    expect(body.total_amount).toBe(100);
  });

  it("refuses to drop below one bed", async () => {
    db.seed("reservation_items", [{ id: "item-1", reservation_id: resId, bed_id: "bed-1", total_price: 100 }]);
    const res = await DELETE(deleteReq("bed-1"), { params: params() });
    expect(res.status).toBe(400);
  });

  it("refuses to drop beds below the attached guest count", async () => {
    db.seed("reservation_guests", [
      { id: "rg-1", reservation_id: resId, guest_id: "g1" },
      { id: "rg-2", reservation_id: resId, guest_id: "g2" },
    ]);
    const res = await DELETE(deleteReq("bed-2"), { params: params() });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- "src/app/api/reservations/[id]/items/route.test.ts"`
Expected: 8 passed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/reservations/[id]/items/route.test.ts"
git commit -m "test: unit test /api/reservations/[id]/items route"
```

---

### Task 11: `reservations/[id]/payment/route.ts`

**Files:**
- Test: `src/app/api/reservations/[id]/payment/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/[id]/payment/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));

import { PATCH } from "./route";

const orgId = "org-1";
const resId = "res-1";
const params = () => Promise.resolve({ id: resId });

function req(body: any) {
  return new Request(`http://test/api/reservations/${resId}/payment`, { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/reservations/[id]/payment", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [{ id: resId, organization_id: orgId, paid_amount: 0, payment_confirmed: false }]);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await PATCH(req({ paid_amount: 100 }), { params: params() });
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown reservation", async () => {
    const res = await PATCH(req({ paid_amount: 100 }), { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("updates only the allow-listed payment fields", async () => {
    const res = await PATCH(
      req({ paid_amount: 150, payment_confirmed: true, not_a_real_field: "ignored" }),
      { params: params() }
    );
    expect(res.status).toBe(200);
    const reservation = db.tables.reservations.find((r: any) => r.id === resId);
    expect(reservation.paid_amount).toBe(150);
    expect(reservation.payment_confirmed).toBe(true);
    expect(reservation.not_a_real_field).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- "src/app/api/reservations/[id]/payment/route.test.ts"`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/reservations/[id]/payment/route.test.ts"
git commit -m "test: unit test PATCH /api/reservations/[id]/payment route"
```

---

### Task 12: `reservations/[id]/registry/route.ts`

**Files:**
- Test: `src/app/api/reservations/[id]/registry/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/[id]/registry/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));

import { POST } from "./route";

const orgId = "org-1";
const resId = "res-1";
const params = () => Promise.resolve({ id: resId });

function req() {
  return new Request(`http://test/api/reservations/${resId}/registry`, { method: "POST" });
}

describe("POST /api/reservations/[id]/registry", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("organizations", [{ id: orgId, plan: "pro" }]);
    db.seed("guests", [{ id: "guest-1", first_name: "Jane", last_name: "Doe" }]);
    db.seed("reservations", [
      {
        id: resId, organization_id: orgId, guest_id: "guest-1", reservation_number: "R1",
        check_in: "2026-07-01", check_out: "2026-07-03", total_amount: 100, paid_amount: 100, status: "confirmed",
      },
    ]);
    db.seed("reservation_guests", [{ id: "rg-1", reservation_id: resId, guest_id: "guest-1", is_primary: true }]);
    db.seed("reservation_items", [{ id: "item-1", reservation_id: resId, bed_id: "bed-1" }]);
    db.seed("beds", [{ id: "bed-1", name: "Bed A", room_id: "room-1" }]);
    db.seed("rooms", [{ id: "room-1", name: "Yellow Dorm" }]);
    db.seed("checkin_registry", []);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(401);
  });

  it("registers every occupant not already registered", async () => {
    const res = await POST(req(), { params: params() });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.added).toBe(1);
    expect(db.tables.checkin_registry).toHaveLength(1);
    expect(db.tables.checkin_registry[0]).toMatchObject({ guest_id: "guest-1", room_name: "Yellow Dorm", bed_name: "Bed A" });
  });

  it("returns 409 when every occupant is already registered", async () => {
    db.seed("checkin_registry", [{ id: "cr-1", reservation_id: resId, guest_id: "guest-1" }]);
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(409);
  });

  it("returns 403 when adding would exceed the plan's guest book limit", async () => {
    db.seed("organizations", [{ id: orgId, plan: "free" }]); // free plan limit is 500
    db.seed(
      "checkin_registry",
      Array.from({ length: 500 }, (_, i) => ({ id: `cr-${i}`, organization_id: orgId, guest_id: `other-${i}` }))
    );
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- "src/app/api/reservations/[id]/registry/route.test.ts"`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/reservations/[id]/registry/route.test.ts"
git commit -m "test: unit test POST /api/reservations/[id]/registry route"
```

---

### Task 13: `reservations/[id]/segment-rate/route.ts`

**Files:**
- Test: `src/app/api/reservations/[id]/segment-rate/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/[id]/segment-rate/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));

import { PATCH } from "./route";

const orgId = "org-1";
const resId = "res-1";
const params = () => Promise.resolve({ id: resId });

function req(body: any) {
  return new Request(`http://test/api/reservations/${resId}/segment-rate`, { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/reservations/[id]/segment-rate", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("memberships", [{ organization_id: orgId, user_id: "user-1" }]);
    db.seed("reservations", [{ id: resId, organization_id: orgId, total_amount: 200 }]);
    db.seed("reservation_items", [
      { id: "item-1", reservation_id: resId, check_in: "2026-07-01", check_out: "2026-07-03", price_per_night: 50, total_price: 100 },
      { id: "item-2", reservation_id: resId, check_in: "2026-07-03", check_out: "2026-07-05", price_per_night: 50, total_price: 100 },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await PATCH(req({ item_ids: ["item-1"], price_per_night: 60 }), { params: params() });
    expect(res.status).toBe(401);
  });

  it("rejects a missing item_ids or price_per_night", async () => {
    const res = await PATCH(req({ item_ids: [] }), { params: params() });
    expect(res.status).toBe(400);
  });

  it("re-rates only the selected items and recomputes the reservation total", async () => {
    const res = await PATCH(req({ item_ids: ["item-1"], price_per_night: 70 }), { params: params() });
    const body = await res.json();

    expect(res.status).toBe(200);
    const item1 = db.tables.reservation_items.find((i: any) => i.id === "item-1");
    const item2 = db.tables.reservation_items.find((i: any) => i.id === "item-2");
    expect(item1.price_per_night).toBe(70);
    expect(item1.total_price).toBe(140); // 2 nights * 70
    expect(item2.price_per_night).toBe(50); // untouched
    expect(body.new_total).toBe(240); // 140 + 100
    expect(db.tables.reservations.find((r: any) => r.id === resId).total_amount).toBe(240);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- "src/app/api/reservations/[id]/segment-rate/route.test.ts"`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/reservations/[id]/segment-rate/route.test.ts"
git commit -m "test: unit test PATCH /api/reservations/[id]/segment-rate route"
```

---

### Task 14: `reservations/availability/route.ts`

**Files:**
- Test: `src/app/api/reservations/availability/route.test.ts`

- [ ] **Step 1: 编写测试**

```ts
// src/app/api/reservations/availability/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));

import { GET } from "./route";

function req(query: string) {
  return new Request(`http://test/api/reservations/availability${query}`);
}

describe("GET /api/reservations/availability", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    db.seed("reservations", [{ id: "res-1", status: "confirmed", reservation_number: "R1" }]);
    db.seed("guests", [{ id: "guest-1", first_name: "Jane", last_name: "Doe" }]);
    db.seed("reservation_items", [
      { id: "item-1", bed_id: "bed-1", reservation_id: "res-1", check_in: "2026-07-01", check_out: "2026-07-03" },
    ]);
  });

  it("returns 400 when required params are missing", async () => {
    const res = await GET(req("?check_in=2026-07-01&check_out=2026-07-03"));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    db.setUser(null);
    const res = await GET(req("?bed_id=bed-1&check_in=2026-07-01&check_out=2026-07-03"));
    expect(res.status).toBe(401);
  });

  it("bed_id mode: reports unavailable with the conflicting reservation's details", async () => {
    const res = await GET(req("?bed_id=bed-1&check_in=2026-07-02&check_out=2026-07-04"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.available).toBe(false);
    expect(body.conflicts[0]).toMatchObject({ reservation_number: "R1", guest: "Jane Doe" });
  });

  it("bed_id mode: reports available when there's no overlap", async () => {
    const res = await GET(req("?bed_id=bed-1&check_in=2026-07-03&check_out=2026-07-05"));
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.conflicts).toHaveLength(0);
  });

  it("bed_id mode: excludes the reservation named in exclude_id (for edits)", async () => {
    const res = await GET(req("?bed_id=bed-1&check_in=2026-07-02&check_out=2026-07-04&exclude_id=res-1"));
    const body = await res.json();
    expect(body.available).toBe(true);
  });

  it("room_id mode: returns per-bed availability for every bed in the room", async () => {
    db.seed("beds", [
      { id: "bed-1", room_id: "room-1", name: "Bed A", position: 1, is_active: true },
      { id: "bed-2", room_id: "room-1", name: "Bed B", position: 2, is_active: true },
    ]);
    const res = await GET(req("?room_id=room-1&check_in=2026-07-02&check_out=2026-07-04"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total_count).toBe(2);
    expect(body.free_count).toBe(1);
    expect(body.beds.find((b: any) => b.id === "bed-1").available).toBe(false);
    expect(body.beds.find((b: any) => b.id === "bed-2").available).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- src/app/api/reservations/availability/route.test.ts`
Expected: 6 passed.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reservations/availability/route.test.ts
git commit -m "test: unit test GET /api/reservations/availability route"
```

---

### Task 15: 全套件最终验证

**Files:** 无（仅验证）

- [ ] **Step 1: 运行完整测试套件**

Run: `npm test`
Expected: 全部通过，0 failed。预期总数 = 140（Task 1 结束时的数字）+ 5（Task2）+ 6（Task3）+ 7（Task4）+ 4（Task5）+ 4（Task6）+ 4（Task7）+ 4（Task8）+ 5（Task9）+ 8（Task10）+ 3（Task11）+ 4（Task12）+ 3（Task13）+ 6（Task14）= 203 passed，14 个新测试文件 + Phase 1 的 13 个 + Task 1 修改的 1 个 = 27 个测试文件。

- [ ] **Step 2: 运行 typecheck 和 build，确认没有破坏任何现有代码**

Run: `npm run typecheck && npm run build`
Expected: 两者都干净退出，无错误。

- [ ] **Step 3: 跑一次覆盖率报告，确认 `src/app/api/reservations/` 下的 13 个路由文件覆盖率显著提升**

Run: `npm test -- --coverage`
Expected: 覆盖率报告里 `src/app/api/reservations/**` 相关文件不再是 0%（Phase 1 的 coverage config 里 `include` 目前只覆盖 `src/lib/**`，如果这次运行覆盖率报告没有把 `src/app/api` 纳入统计，属于预期——这是一个已知的、留给后续调整 `vitest.config.ts` 的 `coverage.include` 范围的收尾项，不阻塞本阶段收尾）。

此任务无 commit——它是确认 Task 1-14 整体正确的检查点。
