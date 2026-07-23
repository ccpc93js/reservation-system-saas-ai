import { createServerClient } from "@/lib/supabase/server";
import { differenceInDays, parseISO } from "date-fns";
import { syncAvailabilityWindow } from "@/lib/channels/channex-availability";

type ReservationOrg = {
  organization_id: string;
  check_in: string;
  check_out: string;
  guest_id: string | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get reservation to verify access and get current details
    const { data: reservationRaw, error: resError } = await supabase
      .from("reservations")
      .select("organization_id, check_in, check_out")
      .eq("id", id)
      .single();

    const reservation = reservationRaw as ReservationOrg | null;

    if (resError || !reservation) {
      return Response.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Load ALL items: a reservation may span several beds. Keep each bed's
    // current rate (first item per bed) when rebuilding.
    const { data: itemsRaw, error: itemError } = await supabase
      .from("reservation_items")
      .select("bed_id, price_per_night, check_in")
      .eq("reservation_id", id)
      .order("check_in", { ascending: true });

    if (itemError || !itemsRaw || itemsRaw.length === 0) {
      return Response.json(
        { error: "Reservation items not found" },
        { status: 404 }
      );
    }

    // bed_id -> rate (first/earliest item's rate per bed)
    const bedRates = new Map<string, number>();
    for (const it of itemsRaw as any[]) {
      if (!bedRates.has(it.bed_id)) bedRates.set(it.bed_id, Number(it.price_per_night) || 0);
    }
    const bedIds = Array.from(bedRates.keys());

    // Verify user belongs to org
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", reservation.organization_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return Response.json(
        { error: "You don't have access to this reservation" },
        { status: 403 }
      );
    }

    // Parse and validate update data
    const body = await request.json();
    const { check_in: newCheckIn, check_out: newCheckOut } = body;

    // Basic validation
    if (newCheckIn && newCheckOut) {
      if (new Date(newCheckOut) <= new Date(newCheckIn)) {
        return Response.json(
          { error: "Check-out date must be after check-in date" },
          { status: 400 }
        );
      }
    }
    const checkIn = newCheckIn || reservation.check_in;
    const checkOut = newCheckOut || reservation.check_out;

    // Conflict check across EVERY bed on the reservation for the new dates.
    // Strict overlap (lt/gt) so back-to-back turnover is allowed; ignore
    // cancelled/no_show like the rest of the availability logic.
    if (newCheckIn || newCheckOut) {
      const { data: conflicts, error: conflictError } = await (supabase
        .from("reservation_items") as any)
        .select("id, reservations!inner(status)")
        .in("bed_id", bedIds)
        .not("reservation_id", "eq", id)
        .lt("check_in", checkOut)
        .gt("check_out", checkIn)
        .not("reservations.status", "in", '("cancelled","no_show")')
        .limit(1);

      if (conflictError) {
        return Response.json(
          { error: "Failed to check availability" },
          { status: 400 }
        );
      }

      if (conflicts && conflicts.length > 0) {
        return Response.json(
          { error: "New dates conflict with existing reservations" },
          { status: 409 }
        );
      }
    }

    // Delete old reservation items
    const { error: deleteError } = await (supabase
      .from("reservation_items") as any)
      .delete()
      .eq("reservation_id", id);

    if (deleteError) {
      return Response.json(
        { error: "Failed to delete reservation items" },
        { status: 400 }
      );
    }

    // Rebuild: ONE item per bed spanning the full stay (matches the create
    // flow and the folio's date-range grouping), keeping each bed's rate.
    const nights = differenceInDays(parseISO(checkOut), parseISO(checkIn));
    const newItems = bedIds.map((bid) => ({
      organization_id: reservation.organization_id,
      reservation_id: id,
      bed_id: bid,
      check_in: checkIn,
      check_out: checkOut,
      price_per_night: bedRates.get(bid),
      total_price: (bedRates.get(bid) ?? 0) * nights,
    }));

    // Insert new reservation items
    const { error: insertError } = await (supabase
      .from("reservation_items") as any)
      .insert(newItems);

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return Response.json(
        { error: `Failed to create reservation items: ${insertError.message}` },
        { status: 400 }
      );
    }

    // Update reservation with new dates and total amount
    const totalAmount = newItems.reduce((sum, it) => sum + Number(it.total_price), 0);
    const { error: updateError } = await (supabase
      .from("reservations") as any)
      .update({
        ...(newCheckIn && { check_in: checkIn }),
        ...(newCheckOut && { check_out: checkOut }),
        total_amount: totalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return Response.json(
        { error: "Failed to update reservation" },
        { status: 400 }
      );
    }

    // Dates moved → push availability over BOTH the old and new windows so
    // Channex frees the vacated nights and blocks the new ones (no-op if not connected).
    const from = reservation.check_in < checkIn ? reservation.check_in : checkIn;
    const to = reservation.check_out > checkOut ? reservation.check_out : checkOut;
    await syncAvailabilityWindow(supabase as any, reservation.organization_id, from, to);

    return Response.json({
      success: true,
      updated_total_amount: totalAmount,
      nights,
    });
  } catch (error) {
    console.error("Error updating reservation dates:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
