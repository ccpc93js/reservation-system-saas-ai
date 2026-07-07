import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { canManageMember, assignableRoles } from "@/lib/permissions";

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

// The target member's current role (service client bypasses RLS).
async function getTargetRole(service: any, orgId: string, targetUserId: string): Promise<string | null> {
  const { data } = await service
    .from("memberships")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", targetUserId)
    .single();
  return data?.role ?? null;
}

async function ownerCount(service: any, orgId: string): Promise<number> {
  const { count } = await service
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("role", "owner");
  return count ?? 0;
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

    const targetRole = await getTargetRole(service, admin.organization_id, userId);
    if (!targetRole) return Response.json({ error: "Member not found" }, { status: 404 });

    // Must outrank the target and be allowed to assign the requested role.
    if (!canManageMember(admin.role, targetRole)) {
      return Response.json({ error: "You can't modify this member" }, { status: 403 });
    }
    if (!assignableRoles(admin.role).includes(role)) {
      return Response.json({ error: "You can't assign that role" }, { status: 403 });
    }
    // Never demote the last remaining owner.
    if (targetRole === "owner" && role !== "owner" && (await ownerCount(service, admin.organization_id)) <= 1) {
      return Response.json({ error: "The property must keep at least one owner" }, { status: 400 });
    }

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

    const targetRole = await getTargetRole(service, admin.organization_id, userId);
    if (!targetRole) return Response.json({ error: "Member not found" }, { status: 404 });
    if (!canManageMember(admin.role, targetRole)) {
      return Response.json({ error: "You can't remove this member" }, { status: 403 });
    }
    if (targetRole === "owner" && (await ownerCount(service, admin.organization_id)) <= 1) {
      return Response.json({ error: "The property must keep at least one owner" }, { status: 400 });
    }

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
