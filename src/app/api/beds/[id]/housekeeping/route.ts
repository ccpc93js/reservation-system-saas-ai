import { createServerClient } from "@/lib/supabase/server";
import { HOUSEKEEPING_STATUSES } from "@/lib/types/housekeeping";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return Response.json({ error: "You don't have access to any organization" }, { status: 403 });
  }

  const body = await request.json();
  const { status } = body;

  if (!HOUSEKEEPING_STATUSES.includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabase
    .from("beds")
    .update({
      housekeeping_status: status,
      housekeeping_updated_at: new Date().toISOString(),
      housekeeping_updated_by: user.id,
    })
    .eq("id", id)
    .eq("organization_id", membership.organization_id);

  if (error) return Response.json({ error: "Failed to update status" }, { status: 400 });
  return Response.json({ success: true });
}
