import { createServerClient } from "@/lib/supabase/server";
import { differenceInDays, parseISO } from "date-fns";
import { syncAvailabilityWindow } from "@/lib/channels/channex-availability";

export async function POST(
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
      .select("organization_id, check_in, check_out, total_amount, paid_amount")
      .eq("id", id)
      .single();
    const res = resRaw as any;
    if (!res) return Response.json({ error: "Reservation not found" }, { status: 404 });

    const { data: membership } = await supabase
      .from("memberships").select("role")
      .eq("organization_id", res.organization_id).eq("user_id", user.id).single();
    if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { new_check_out, price_per_night } = await request.json();

    if (!new_check_out || price_per_night == null) {
      return Response.json({ error: "new_check_out and price_per_night are required" }, { status: 400 });
    }
    if (new Date(new_check_out) <= new Date(res.check_out)) {
      return Response.json({ error: "New check-out must be after current check-out" }, { status: 400 });
    }

    // Extend EVERY bed on the reservation — a group stays together. One item
    // per bed for the extension range (matches the folio's date-range grouping).
    const { data: itemsRaw } = await supabase
      .from("reservation_items")
      .select("bed_id")
      .eq("reservation_id", id);
    const bedIds = Array.from(new Set(((itemsRaw ?? []) as any[]).map((i) => i.bed_id)));
    if (bedIds.length === 0) return Response.json({ error: "No bed found for this reservation" }, { status: 400 });

    // Conflict check: other reservations on any of these beds during the extension
    const { data: conflicts } = await (supabase.from("reservation_items") as any)
      .select("id, beds(name), reservations!inner(status)")
      .in("bed_id", bedIds)
      .not("reservation_id", "eq", id)
      .lt("check_in", new_check_out)
      .gt("check_out", res.check_out)
      .not("reservations.status", "in", '("cancelled","no_show")');

    if (conflicts && conflicts.length > 0) {
      const names = Array.from(new Set(conflicts.map((c: any) => c.beds?.name).filter(Boolean)));
      return Response.json({ error: `Extension dates conflict with an existing reservation${names.length ? ` (${names.join(", ")})` : ""}` }, { status: 409 });
    }

    const extNights = differenceInDays(parseISO(new_check_out), parseISO(res.check_out));
    const newItems = bedIds.map((bid) => ({
      organization_id: res.organization_id,
      reservation_id: id,
      bed_id: bid,
      check_in: res.check_out,
      check_out: new_check_out,
      price_per_night: Number(price_per_night),
      total_price: Number(price_per_night) * extNights,
    }));

    const { error: insertError } = await (supabase.from("reservation_items") as any).insert(newItems);
    if (insertError) return Response.json({ error: insertError.message }, { status: 400 });

    // Recalculate total from ALL items (not incremental) to stay in sync with segment-rate edits
    const { data: allItemsRaw } = await supabase
      .from("reservation_items")
      .select("total_price")
      .eq("reservation_id", id);
    const newTotal = ((allItemsRaw ?? []) as any[]).reduce((sum, i) => sum + Number(i.total_price ?? 0), 0);

    const { error: updateError } = await (supabase.from("reservations") as any)
      .update({ check_out: new_check_out, total_amount: newTotal, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) return Response.json({ error: updateError.message }, { status: 400 });

    // Extended nights now occupied → push availability for the extension window.
    await syncAvailabilityWindow(supabase as any, res.organization_id, res.check_out, new_check_out);

    const extensionTotal = extNights * Number(price_per_night) * bedIds.length;
    return Response.json({ success: true, new_total: newTotal, extension_nights: extNights, extension_total: extensionTotal });
  } catch (err) {
    console.error("Extend error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
