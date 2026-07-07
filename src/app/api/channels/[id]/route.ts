import { createServerClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/types/database";
import { isManager } from "@/lib/permissions";

async function getOrgAndVerify(supabase: any, userId: string, channelId: string) {
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .single();
  if (!membership) return null;
  if (!isManager((membership as any).role)) return null;

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
    const allowed = ["name", "platform", "ical_url", "bed_id", "color", "is_active", "mapping_mode", "room_type_id", "allotment"] as const;
    const update: TablesUpdate<"channels"> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) (update as any)[key] = body[key];
    }
    // Keep mapping consistent: a room-type channel has no fixed bed and vice versa.
    if ((update as any).mapping_mode === "room_type") (update as any).bed_id = null;
    if ((update as any).mapping_mode === "bed") {
      (update as any).room_type_id = null;
      (update as any).allotment = null;
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
