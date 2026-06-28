import { createServerClient, createServiceClient } from "@/lib/supabase/server";

async function getAdminMembership(supabase: any, userId: string) {
  const { data } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .single();
  if (!data) return null;
  if (!["owner", "manager", "admin"].includes(data.role)) return null;
  return data;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await getAdminMembership(supabase, user.id);
    if (!admin) return Response.json({ error: "Insufficient permissions" }, { status: 403 });
    if (userId === user.id) return Response.json({ error: "Cannot change your own role" }, { status: 400 });

    const { role } = await request.json();
    if (!role) return Response.json({ error: "role required" }, { status: 400 });

    const service = await createServiceClient();
    const { error: updateError } = await service
      .from("memberships")
      .update({ role })
      .eq("organization_id", admin.organization_id)
      .eq("user_id", userId);

    if (updateError) return Response.json({ error: updateError.message }, { status: 400 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await getAdminMembership(supabase, user.id);
    if (!admin) return Response.json({ error: "Insufficient permissions" }, { status: 403 });
    if (userId === user.id) return Response.json({ error: "Cannot remove yourself" }, { status: 400 });

    const service = await createServiceClient();
    const { error: deleteError } = await service
      .from("memberships")
      .delete()
      .eq("organization_id", admin.organization_id)
      .eq("user_id", userId);

    if (deleteError) return Response.json({ error: deleteError.message }, { status: 400 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
