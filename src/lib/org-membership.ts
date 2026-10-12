import type { SupabaseClient } from "@supabase/supabase-js";

// A user can hold more than one membership (test accounts, staff who consult
// across properties). `.single()` throws (PGRST116) when the row count isn't
// exactly 1, so every "where does this user land" call site must tolerate 0
// or many rows instead of assuming exactly one.
export async function getPrimaryOrgSlug(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("memberships")
    .select("organization_id, organizations(slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as any)?.organizations?.slug ?? null;
}

// Same tolerance as getPrimaryOrgSlug, for the many API routes that need this
// caller's org id + role rather than a slug (no [slug] param in scope there).
export async function getPrimaryMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<{ organizationId: string; role: string } | null> {
  const { data } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { organizationId: (data as any).organization_id, role: (data as any).role };
}

// For routes anchored on a specific resource (room type, rate plan, override):
// the resource's own organization_id is the authority on which org this request
// is "for", not the caller's primary/oldest membership. Checks whether the user
// has ANY membership in that specific org and returns its role for a permission
// check; null means "not a member there" (caller should treat as not-found, to
// avoid revealing the resource exists in an org the user can't see).
export async function getMembershipForOrg(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<{ organizationId: string; role: string } | null> {
  const { data } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data) return null;
  return { organizationId: (data as any).organization_id, role: (data as any).role };
}
