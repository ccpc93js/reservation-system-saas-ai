import { createServerClient } from "@/lib/supabase/server";
import { updateReservationSchema } from "@/lib/validations/reservation";
import { finalizeCheckout } from "@/lib/checkout";

type ReservationOrg = { organization_id: string };

async function writeCheckinRegistrySnapshot(supabase: any, reservationId: string) {
  // Append-only: skip if a snapshot already exists for this reservation.
  const { data: existing } = await supabase
    .from("checkin_registry")
    .select("id")
    .eq("reservation_id", reservationId)
    .maybeSingle();
  if (existing) return;

  const { data: res } = await supabase
    .from("reservations")
    .select(`
      organization_id, guest_id, reservation_number, service_type,
      check_in, check_out, actual_check_in_at, actual_check_out_at,
      total_amount, paid_amount, payment_currency,
      guests(
        first_name, last_name, date_of_birth, nationality, country_of_birth,
        place_of_birth, document_type, document_number, document_issued_date,
        document_issued_place, document_expiry, jmbg
      ),
      reservation_items(beds(name, rooms(name)))
    `)
    .eq("id", reservationId)
    .single();
  if (!res) return;

  const g = res.guests ?? {};
  const item = res.reservation_items?.[0];
  const bed = item?.beds;
  const room = bed?.rooms;

  await supabase.from("checkin_registry").insert({
    organization_id: res.organization_id,
    reservation_id: reservationId,
    guest_id: res.guest_id,
    reservation_number: res.reservation_number,
    first_name: g.first_name,
    last_name: g.last_name,
    date_of_birth: g.date_of_birth,
    nationality: g.nationality,
    country_of_birth: g.country_of_birth,
    place_of_birth: g.place_of_birth,
    document_type: g.document_type,
    document_number: g.document_number,
    document_issued_date: g.document_issued_date,
    document_issued_place: g.document_issued_place,
    document_expiry: g.document_expiry,
    jmbg: g.jmbg,
    service_type: res.service_type,
    room_name: room?.name ?? null,
    bed_name: bed?.name ?? null,
    check_in: res.check_in,
    check_out: res.check_out,
    actual_check_in_at: res.actual_check_in_at,
    actual_check_out_at: res.actual_check_out_at,
    total_amount: res.total_amount,
    paid_amount: res.paid_amount,
    payment_currency: res.payment_currency,
  });
}

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

    // Get reservation to verify access
    const { data: reservationRaw, error: resError } = await supabase
      .from("reservations")
      .select("organization_id")
      .eq("id", id)
      .single();

    const reservation = reservationRaw as ReservationOrg | null;

    if (resError || !reservation) {
      return Response.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

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

    try {
      await updateReservationSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const updateData = body;

    // Update reservation
    const { error: updateError } = await (supabase
      .from("reservations") as any)
      .update({
        ...(updateData.status && { status: updateData.status }),
        ...(updateData.notes !== undefined && { notes: updateData.notes }),
        ...(updateData.guest_id && { guest_id: updateData.guest_id }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return Response.json(
        { error: "Failed to update reservation" },
        { status: 400 }
      );
    }

    // Update registry actual_check_out_at when checking out
    if (updateData.status === "checked_out") {
      await (supabase as any)
        .from("checkin_registry")
        .update({ actual_check_out_at: new Date().toISOString() })
        .eq("reservation_id", id)
        .is("actual_check_out_at", null);

      // Mark bed(s) dirty for housekeeping + send checkout confirmation email
      await finalizeCheckout(supabase, id);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating reservation:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Get reservation to verify access
    const { data: reservationRaw, error: resError } = await supabase
      .from("reservations")
      .select("organization_id")
      .eq("id", id)
      .single();

    const reservation = reservationRaw as ReservationOrg | null;

    if (resError || !reservation) {
      return Response.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

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

    // Delete reservation (cascade deletes reservation_items via FK)
    const { error: deleteError } = await (supabase
      .from("reservations") as any)
      .delete()
      .eq("id", id);

    if (deleteError) {
      return Response.json(
        { error: "Failed to delete reservation" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting reservation:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
