import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";

const db = new FakeSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => db,
}));

vi.mock("@/lib/checkout", () => ({
  finalizeCheckout: vi.fn(),
}));

vi.mock("@/lib/channels/channex-outbox", () => ({
  enqueueAvailability: vi.fn(),
}));

import { enqueueAvailability } from "@/lib/channels/channex-outbox";
import { PATCH, DELETE } from "./route";

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/reservations/res-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function params(id = "res-1") {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/reservations/[id] — Channex availability sync on cancel", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    vi.mocked(enqueueAvailability).mockReset();
  });

  it("enqueues an availability push when a reservation transitions to cancelled", async () => {
    db.seed("reservations", [
      { id: "res-1", organization_id: "org-1", check_in: "2026-11-01", check_out: "2026-11-03", status: "confirmed" },
    ]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await PATCH(patchRequest({ status: "cancelled" }), params());

    expect(res.status).toBe(200);
    expect(enqueueAvailability).toHaveBeenCalledWith(expect.anything(), "org-1", "2026-11-01", "2026-11-03");
  });

  it("does not re-enqueue when saving an already-cancelled reservation again", async () => {
    db.seed("reservations", [
      { id: "res-1", organization_id: "org-1", check_in: "2026-11-01", check_out: "2026-11-03", status: "cancelled" },
    ]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await PATCH(patchRequest({ status: "cancelled", notes: "updated note" }), params());

    expect(res.status).toBe(200);
    expect(enqueueAvailability).not.toHaveBeenCalled();
  });

  it("does not enqueue for a non-cancelling status change", async () => {
    db.seed("reservations", [
      { id: "res-1", organization_id: "org-1", check_in: "2026-11-01", check_out: "2026-11-03", status: "pending" },
    ]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await PATCH(patchRequest({ status: "confirmed" }), params());

    expect(res.status).toBe(200);
    expect(enqueueAvailability).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/reservations/[id] — Channex availability sync", () => {
  beforeEach(() => {
    db.tables = {};
    db.setUser({ id: "user-1" });
    vi.mocked(enqueueAvailability).mockReset();
  });

  it("enqueues an availability push for the freed dates after deletion", async () => {
    db.seed("reservations", [
      { id: "res-1", organization_id: "org-1", check_in: "2026-12-05", check_out: "2026-12-08", status: "confirmed" },
    ]);
    db.seed("memberships", [{ user_id: "user-1", organization_id: "org-1", role: "manager" }]);

    const res = await DELETE(new Request("http://localhost/api/reservations/res-1", { method: "DELETE" }), params());

    expect(res.status).toBe(200);
    expect(enqueueAvailability).toHaveBeenCalledWith(expect.anything(), "org-1", "2026-12-05", "2026-12-08");
  });
});
