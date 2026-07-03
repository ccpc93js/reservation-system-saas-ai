import { createServerClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["clean", "dirty", "inspected", "out_of_order"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { status } = body;

  if (!VALID_STATUSES.includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabase
    .from("beds")
    .update({
      housekeeping_status: status,
      housekeeping_updated_at: new Date().toISOString(),
      housekeeping_updated_by: user.id,
    })
    .eq("id", id);

  if (error) return Response.json({ error: "Failed to update status" }, { status: 400 });
  return Response.json({ success: true });
}
