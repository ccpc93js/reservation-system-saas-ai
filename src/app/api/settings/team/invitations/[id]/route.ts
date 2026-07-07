import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/permissions";

// Revoke a pending invitation. Manager+ only, scoped to the caller's org.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();
    if (!membership) return Response.json({ error: "No organization" }, { status: 403 });
    if (!isManager((membership as any).role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const service = await createServiceClient();
    const { error: delError } = await service
      .from("invitations")
      .delete()
      .eq("id", id)
      .eq("organization_id", (membership as any).organization_id)
      .is("accepted_at", null);

    if (delError) return Response.json({ error: delError.message }, { status: 400 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
