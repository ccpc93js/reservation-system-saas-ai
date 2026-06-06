import { createServerClient } from "@/lib/supabase/server";
import { differenceInDays, parseISO } from "date-fns";

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

    // Get bed_id from first reservation_item
    const { data: firstItem, error: itemError } = await supabase
      .from("reservation_items")
      .select("bed_id, price_per_night")
      .eq("reservation_id", id)
      .limit(1)
      .single();

    if (itemError || !firstItem) {
      return Response.json(
        { error: "Reservation items not found" },
        { status: 404 }
      );
    }

    const bedId = (firstItem as any).bed_id;
    let pricePerNight = (firstItem as any).price_per_night;

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

    // Check for conflicts with other reservations on same bed (exclude current reservation)
    if (newCheckIn || newCheckOut) {
      const { data: conflicts, error: conflictError } = await supabase
        .from("reservation_items")
        .select("id")
        .eq("bed_id", bedId)
        .not("reservation_id", "eq", id)
        .gte("check_out", checkIn)
        .lt("check_in", checkOut)
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

    // pricePerNight already fetched above, create new reservation items for each night
    const nights = differenceInDays(parseISO(checkOut), parseISO(checkIn));
    const newItems = [];

    for (let i = 0; i < nights; i++) {
      const itemCheckIn = new Date(checkIn);
      itemCheckIn.setDate(itemCheckIn.getDate() + i);
      const itemCheckOut = new Date(itemCheckIn);
      itemCheckOut.setDate(itemCheckOut.getDate() + 1);

      newItems.push({
        organization_id: reservation.organization_id,
        reservation_id: id,
        bed_id: bedId,
        check_in: itemCheckIn.toISOString().split("T")[0],
        check_out: itemCheckOut.toISOString().split("T")[0],
        price_per_night: pricePerNight,
        total_price: pricePerNight,
      });
    }

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
    const totalAmount = nights * pricePerNight;
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
