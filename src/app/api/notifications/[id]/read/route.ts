import { createServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: "Failed to mark as read" }, { status: 400 });
  return Response.json({ success: true });
}
