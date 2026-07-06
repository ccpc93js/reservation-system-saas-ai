import { createServerClient } from "@/lib/supabase/server";
import { differenceInDays } from "date-fns";

// Verify the caller is a member of the reservation's org, and return the
// reservation's core fields used for adding/removing beds.
async function loadReservation(supabase: any, reservationId: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Unauthorized", status: 401 as const };

  const { data: res } = await supabase
    .from("reservations")
    .select("id, organization_id, check_in, check_out")
    .eq("id", reservationId)
    .single();
  if (!res) return { error: "Reservation not found", status: 404 as const };

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", res.organization_id)
    .eq("user_id", user.id)
    .single();
  if (!membership) return { error: "Forbidden", status: 403 as const };

  return { res };
}

async function recomputeTotal(supabase: any, reservationId: string) {
  const { data: items } = await supabase
    .from("reservation_items")
    .select("total_price")
    .eq("reservation_id", reservationId);
  const total = (items ?? []).reduce((sum: number, it: any) => sum + Number(it.total_price || 0), 0);
  await supabase
    .from("reservations")
    .update({ total_amount: total, updated_at: new Date().toISOString() })
    .eq("id", reservationId);
  return total;
}

// Add one or more beds (same room as the reservation's existing beds) to a
// reservation. Inserts one reservation_item per bed and recomputes the total.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const auth = await loadReservation(supabase, id);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const res = auth.res;

    const body = await request.json();
    const bedIds: string[] = Array.isArray(body?.bed_ids)
      ? Array.from(new Set((body.bed_ids as string[]).filter(Boolean)))
      : (body?.bed_id ? [body.bed_id] : []);
    if (bedIds.length === 0) return Response.json({ error: "bed_ids is required" }, { status: 400 });

    // Existing items define the allowed room(s) and the per-bed rate.
    const { data: existing } = await (supabase as any)
      .from("reservation_items")
      .select("bed_id, price_per_night, beds(room_id)")
      .eq("reservation_id", id);
    if (!existing || existing.length === 0) {
      return Response.json({ error: "Reservation has no beds to extend from" }, { status: 400 });
    }
    const allowedRooms = new Set(existing.map((it: any) => it.beds?.room_id).filter(Boolean));
    const alreadyOn = new Set(existing.map((it: any) => it.bed_id));
    const rate = Number(existing[0].price_per_night) || 0;
    const nights = differenceInDays(new Date(res.check_out), new Date(res.check_in));
    if (nights <= 0) return Response.json({ error: "Invalid reservation dates" }, { status: 400 });

    // Validate every requested bed: same org, in an allowed room, not already on it.
    const { data: beds } = await (supabase as any)
      .from("beds")
      .select("id, name, room_id, organization_id, is_active")
      .in("id", bedIds);
    const bedMap = new Map((beds ?? []).map((b: any) => [b.id, b]));
    for (const bid of bedIds) {
      const b: any = bedMap.get(bid);
      if (!b || b.organization_id !== res.organization_id) return Response.json({ error: "Bed not found" }, { status: 404 });
      if (alreadyOn.has(bid)) return Response.json({ error: "Bed is already on this reservation" }, { status: 409 });
      if (!allowedRooms.has(b.room_id)) return Response.json({ error: "Bed must be in the same room as the reservation" }, { status: 400 });
      if (!b.is_active) return Response.json({ error: `Bed ${b.name} is inactive` }, { status: 400 });
    }

    // Conflict check across the requested beds for the reservation's dates.
    const { data: conflicts } = await (supabase as any)
      .from("reservation_items")
      .select("bed_id, beds(name), reservations!inner(status)")
      .in("bed_id", bedIds)
      .lt("check_in", res.check_out)
      .gt("check_out", res.check_in)
      .not("reservations.status", "in", '("cancelled","no_show")');
    if (conflicts && conflicts.length > 0) {
      const names = Array.from(new Set(conflicts.map((c: any) => c.beds?.name).filter(Boolean)));
      return Response.json({ error: `Bed already booked for these dates${names.length ? ` (${names.join(", ")})` : ""}` }, { status: 409 });
    }

    const payload = bedIds.map((bid) => ({
      organization_id: res.organization_id,
      reservation_id: id,
      bed_id: bid,
      check_in: res.check_in,
      check_out: res.check_out,
      price_per_night: rate,
      total_price: nights * rate,
    }));
    const { error: insErr } = await (supabase as any).from("reservation_items").insert(payload);
    if (insErr) return Response.json({ error: insErr.message }, { status: 400 });

    const total = await recomputeTotal(supabase, id);
    return Response.json({ success: true, total_amount: total });
  } catch (err) {
    console.error("Add reservation bed error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Remove a bed from a reservation. Keeps at least one bed and never drops
// capacity below the number of attached guests.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const auth = await loadReservation(supabase, id);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const bedId = searchParams.get("bed_id");
    if (!bedId) return Response.json({ error: "bed_id is required" }, { status: 400 });

    const [{ count: bedCount }, { count: guestCount }] = await Promise.all([
      (supabase as any).from("reservation_items").select("id", { count: "exact", head: true }).eq("reservation_id", id),
      (supabase as any).from("reservation_guests").select("id", { count: "exact", head: true }).eq("reservation_id", id),
    ]);
    if ((bedCount ?? 0) <= 1) {
      return Response.json({ error: "A reservation must keep at least one bed" }, { status: 400 });
    }
    if ((bedCount ?? 0) - 1 < (guestCount ?? 0)) {
      return Response.json({ error: "Remove a guest first — beds cannot be fewer than guests", code: "beds_below_guests" }, { status: 409 });
    }

    const { error } = await (supabase as any)
      .from("reservation_items")
      .delete()
      .eq("reservation_id", id)
      .eq("bed_id", bedId);
    if (error) return Response.json({ error: error.message }, { status: 400 });

    const total = await recomputeTotal(supabase, id);
    return Response.json({ success: true, total_amount: total });
  } catch (err) {
    console.error("Remove reservation bed error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
