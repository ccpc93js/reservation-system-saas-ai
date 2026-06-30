import { createServerClient, createServiceClient } from "@/lib/supabase/server";

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function findUniqueSlug(service: any, base: string): Promise<string> {
  // Try base slug, then base-2, base-3, etc.
  const candidates = [base, ...Array.from({ length: 10 }, (_, i) => `${base}-${i + 2}`)];
  for (const candidate of candidates) {
    const { data } = await service.from("organizations").select("id").eq("slug", candidate).single();
    if (!data) return candidate;
  }
  // Fallback: base + random 4-char suffix
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Block if already in an org
    const { data: existing } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (existing) return Response.json({ error: "Already in an organization" }, { status: 409 });

    const { name, slug: customSlug, city, country, timezone, currency, pendingPlan } = await request.json();
    if (!name?.trim()) return Response.json({ error: "Property name required" }, { status: 400 });
    const validPendingPlan = ["pro", "scale"].includes(pendingPlan) ? pendingPlan : null;

    const service = await createServiceClient();

    // Use custom slug if provided and valid, otherwise derive from name
    let slugBase = customSlug ? slugify(customSlug) : slugify(name);
    if (!slugBase || slugBase.length < 2) slugBase = slugify(name);

    // Validate custom slug format
    if (customSlug && !/^[a-z0-9-]+$/.test(slugBase)) {
      return Response.json({ error: "Slug can only contain lowercase letters, numbers, and hyphens" }, { status: 400 });
    }

    // If custom slug provided, check it's actually available
    if (customSlug) {
      const { data: taken } = await service.from("organizations").select("id").eq("slug", slugBase).single();
      if (taken) return Response.json({ error: `"${slugBase}" is already taken. Choose a different URL.`, field: "slug" }, { status: 409 });
    }

    const slug = customSlug ? slugBase : await findUniqueSlug(service, slugBase);

    const { data: org, error: orgError } = await service
      .from("organizations")
      .insert({ name: name.trim(), slug, city, country, timezone: timezone || "UTC", currency: currency || "EUR", locale: "en", pending_plan: validPendingPlan })
      .select()
      .single();

    if (orgError) {
      // Unique violation — race condition
      if (orgError.code === "23505") {
        return Response.json({ error: `"${slug}" was just taken. Try a slightly different name.`, field: "slug" }, { status: 409 });
      }
      return Response.json({ error: orgError.message }, { status: 400 });
    }

    const { error: memberError } = await service
      .from("memberships")
      .insert({ organization_id: org.id, user_id: user.id, role: "owner" });

    if (memberError) return Response.json({ error: memberError.message }, { status: 400 });

    const redirectTo = validPendingPlan
      ? `/${org.slug}/settings/billing?required=true`
      : `/${org.slug}/dashboard`;
    return Response.json({ org, redirectTo }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
