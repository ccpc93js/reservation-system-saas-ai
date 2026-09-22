// src/lib/test/fake-supabase.ts
//
// Minimal fake Supabase client for unit tests. Implements only the
// chainable query-builder methods actually used by src/lib code today:
// select/eq/in/gte/lte/or/order/limit/single/maybeSingle, insert/update/upsert/
// delete, rpc(), and auth.getUser() (via setUser()). Intentionally not a
// structural subtype of the real SupabaseClient type — cast with
// `as unknown as SupabaseClient` at each call site. Extend this file (don't
// reach for a full Postgrest emulator) if a later test needs a method that
// isn't here yet.

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
  private upsertOnConflict?: string;
  private orderCol: string | null = null;
  private orderAscending = true;

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
  gte(col: string, val: any) {
    this.filters.push((row) => row[col] != null && row[col] >= val);
    return this;
  }
  lte(col: string, val: any) {
    this.filters.push((row) => row[col] != null && row[col] <= val);
    return this;
  }
  or(expr: string) {
    this.filters.push(parseOrFilter(expr));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAscending = opts?.ascending ?? true;
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

  private run(): { data: any; error: any } {
    const rows = this.tableRows();

    if (this.op === "select") {
      let result = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.orderCol) {
        const col = this.orderCol;
        const dir = this.orderAscending ? 1 : -1;
        result = [...result].sort((a, b) => (a[col] < b[col] ? -dir : a[col] > b[col] ? dir : 0));
      }
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
  private currentUser: { id: string } | null = null;

  auth = {
    getUser: async () => ({
      data: { user: this.currentUser },
      error: this.currentUser ? null : { message: "no user" },
    }),
  };

  /** Set (or clear, with null) the user returned by auth.getUser(). */
  setUser(user: { id: string } | null): void {
    this.currentUser = user;
  }

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
