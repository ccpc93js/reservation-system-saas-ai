import { createServerClient, createServiceClient } from "@/lib/supabase/server";

async function getOrgId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .single();
  return data?.organization_id ?? null;
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = await getOrgId(supabase, user.id);
    if (!orgId) return Response.json({ error: "No organization" }, { status: 403 });

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (orgError) return Response.json({ error: orgError.message }, { status: 400 });
    return Response.json({ org });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();
    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });
    if (!["owner", "manager", "admin"].includes(membership.role)) {
      return Response.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const allowed = ["name", "email", "phone", "address", "city", "country", "timezone",
      "locale", "description", "website", "logo_url", "check_in_time", "check_out_time", "currency", "theme_color"];
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    const service = await createServiceClient();
    const { data: org, error: updateError } = await service
      .from("organizations")
      .update(update)
      .eq("id", membership.organization_id)
      .select()
      .single();

    if (updateError) return Response.json({ error: updateError.message }, { status: 400 });
    return Response.json({ org });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
