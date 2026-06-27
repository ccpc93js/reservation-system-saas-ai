import { createServerClient } from "@/lib/supabase/server";

async function getOrgAndVerify(supabase: any, userId: string, channelId: string) {
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .single();
  if (!membership) return null;

  const { data: channel } = await supabase
    .from("channels")
    .select("id, organization_id")
    .eq("id", channelId)
    .eq("organization_id", membership.organization_id)
    .single();

  return channel ? { orgId: membership.organization_id, channel } : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getOrgAndVerify(supabase, user.id, id);
    if (!access) return Response.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const allowed = ["name", "platform", "ical_url", "bed_id", "color", "is_active"];
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    const { data: channel, error } = await supabase
      .from("channels")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ channel });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getOrgAndVerify(supabase, user.id, id);
    if (!access) return Response.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabase.from("channels").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
