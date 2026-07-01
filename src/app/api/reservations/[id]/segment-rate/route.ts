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

    const { data: resRaw } = await supabase
      .from("reservations")
      .select("organization_id")
      .eq("id", id)
      .single();
    const res = resRaw as any;
    if (!res) return Response.json({ error: "Reservation not found" }, { status: 404 });

    const { data: membership } = await supabase
      .from("memberships").select("role")
      .eq("organization_id", res.organization_id).eq("user_id", user.id).single();
    if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { item_ids, price_per_night } = await request.json();
    if (!Array.isArray(item_ids) || item_ids.length === 0 || price_per_night == null) {
      return Response.json({ error: "item_ids and price_per_night required" }, { status: 400 });
    }

    // Fetch items to calculate correct total_price per item (price × nights in that item)
    const { data: itemsRaw } = await supabase
      .from("reservation_items")
      .select("id, check_in, check_out")
      .in("id", item_ids)
      .eq("reservation_id", id);
    const items = (itemsRaw ?? []) as any[];

    for (const item of items) {
      const nights = item.check_in && item.check_out
        ? Math.round((new Date(item.check_out).getTime() - new Date(item.check_in).getTime()) / 86400000)
        : 1;
      await (supabase.from("reservation_items") as any).update({
        price_per_night: Number(price_per_night),
        total_price: Number(price_per_night) * nights,
      }).eq("id", item.id);
    }

    // Recalculate total_amount = sum of all items for this reservation
    const { data: allItemsRaw } = await supabase
      .from("reservation_items")
      .select("total_price")
      .eq("reservation_id", id);
    const allItems = (allItemsRaw ?? []) as any[];
    const newTotal = allItems.reduce((sum, i) => sum + Number(i.total_price ?? 0), 0);

    await (supabase.from("reservations") as any)
      .update({ total_amount: newTotal, updated_at: new Date().toISOString() })
      .eq("id", id);

    return Response.json({ success: true, new_total: newTotal });
  } catch (err) {
    console.error("Segment rate error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
