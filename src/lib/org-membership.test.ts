import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabaseClient } from "@/lib/test/fake-supabase";
import { getPrimaryOrgSlug } from "@/lib/org-membership";

describe("getPrimaryOrgSlug", () => {
  it("returns the org slug for a user with exactly one membership", async () => {
    const client = new FakeSupabaseClient();
    client.seed("memberships", [
      { id: "m1", user_id: "u1", organization_id: "o1", created_at: "2026-01-01", organizations: { slug: "org-one" } },
    ]);

    const slug = await getPrimaryOrgSlug(client as unknown as SupabaseClient, "u1");

    expect(slug).toBe("org-one");
  });

  it("returns null for a user with no memberships, instead of throwing", async () => {
    const client = new FakeSupabaseClient();

    const slug = await getPrimaryOrgSlug(client as unknown as SupabaseClient, "u1");

    expect(slug).toBeNull();
  });

  // Regression test: the real bug. `.single()` throws when a user belongs to
  // more than one org (PostgREST PGRST116), the thrown/ignored error left
  // `membership` undefined, and every call site silently fell through to
  // "/onboarding" for a user who already has organizations.
  it("returns the oldest org's slug for a user with multiple memberships, instead of throwing", async () => {
    const client = new FakeSupabaseClient();
    client.seed("memberships", [
      { id: "m2", user_id: "u1", organization_id: "o2", created_at: "2026-03-01", organizations: { slug: "org-two" } },
      { id: "m1", user_id: "u1", organization_id: "o1", created_at: "2026-01-01", organizations: { slug: "org-one" } },
      { id: "m3", user_id: "u1", organization_id: "o3", created_at: "2026-05-01", organizations: { slug: "org-three" } },
    ]);

    const slug = await getPrimaryOrgSlug(client as unknown as SupabaseClient, "u1");

    expect(slug).toBe("org-one");
  });

  it("ignores other users' memberships", async () => {
    const client = new FakeSupabaseClient();
    client.seed("memberships", [
      { id: "m1", user_id: "someone-else", organization_id: "o1", created_at: "2026-01-01", organizations: { slug: "org-one" } },
    ]);

    const slug = await getPrimaryOrgSlug(client as unknown as SupabaseClient, "u1");

    expect(slug).toBeNull();
  });
});
