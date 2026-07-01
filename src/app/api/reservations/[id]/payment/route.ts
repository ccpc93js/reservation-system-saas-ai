import { createServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: res } = await supabase
      .from("reservations").select("organization_id").eq("id", id).single();
    if (!res) return Response.json({ error: "Not found" }, { status: 404 });

    const { data: membership } = await supabase
      .from("memberships").select("role")
      .eq("organization_id", res.organization_id).eq("user_id", user.id).single();
    if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();

    const allowed = [
      "payment_confirmed", "payment_currency", "paid_amount",
      "deposit_amount", "deposit_currency",
      "actual_check_in_at", "actual_check_out_at",
    ];

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    const { error } = await supabase.from("reservations").update(update).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 400 });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Payment update error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
