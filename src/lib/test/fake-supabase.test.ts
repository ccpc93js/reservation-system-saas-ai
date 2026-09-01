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
