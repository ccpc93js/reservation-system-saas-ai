import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return Response.json({ error: "Failed to mark all as read" }, { status: 400 });
  return Response.json({ success: true });
}
