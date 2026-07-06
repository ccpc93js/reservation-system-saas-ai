import { createServerClient } from "@/lib/supabase/server";
import { updateReservationSchema } from "@/lib/validations/reservation";
import { finalizeCheckout } from "@/lib/checkout";

type ReservationOrg = { organization_id: string };

const GUEST_IDENTITY_FIELDS = `
  id, first_name, last_name, date_of_birth, nationality, country_of_birth,
  place_of_birth, document_type, document_number, document_issued_date,
  document_issued_place, document_expiry, jmbg
`;

// Per-occupant snapshots: one registry row per guest on the reservation
// (Serbian guest book requires each occupant registered individually).
// Append-only and idempotent per guest — only missing occupants are added.
async function writeCheckinRegistrySnapshot(supabase: any, reservationId: string) {
  const { data: res } = await supabase
    .from("reservations")
    .select(`
      organization_id, guest_id, reservation_number, service_type,
      check_in, check_out, actual_check_in_at, actual_check_out_at,
      total_amount, paid_amount, payment_currency,
      guests(${GUEST_IDENTITY_FIELDS}),
      reservation_items(beds(name, rooms(name)))
    `)
    .eq("id", reservationId)
    .single();
  if (!res) return;

  // Occupants (primary first); fall back to the primary guest for old data.
  const { data: rgRows } = await supabase
    .from("reservation_guests")
    .select(`is_primary, guests(${GUEST_IDENTITY_FIELDS})`)
    .eq("reservation_id", reservationId)
    .order("is_primary", { ascending: false });
  let occupants: { is_primary: boolean; guest: any }[] =
    (rgRows ?? [])
      .filter((r: any) => r.guests)
      .map((r: any) => ({ is_primary: r.is_primary, guest: r.guests }));
  if (occupants.length === 0 && res.guests) {
    occupants = [{ is_primary: true, guest: res.guests }];
  }
  if (occupants.length === 0) return;

  const { data: existingRows } = await supabase
    .from("checkin_registry")
    .select("guest_id")
    .eq("reservation_id", reservationId);
  const registered = new Set((existingRows ?? []).map((r: any) => r.guest_id).filter(Boolean));
  // Legacy single-row snapshots without guest_id count as the primary.
  const hasLegacyRow = (existingRows ?? []).some((r: any) => !r.guest_id);
  const toAdd = occupants.filter(
    (o) => !registered.has(o.guest.id) && !(hasLegacyRow && o.is_primary)
  );
  if (toAdd.length === 0) return;

  const bedNames = (res.reservation_items ?? [])
    .map((it: any) => it.beds?.name)
    .filter(Boolean);
  const roomName = res.reservation_items?.[0]?.beds?.rooms?.name ?? null;

  await supabase.from("checkin_registry").insert(
    toAdd.map(({ is_primary, guest: g }: { is_primary: boolean; guest: any }) => ({
      organization_id: res.organization_id,
      reservation_id: reservationId,
      guest_id: g.id,
      is_primary,
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
      room_name: roomName,
      bed_name: bedNames.length > 0 ? bedNames.join(", ") : null,
      check_in: res.check_in,
      check_out: res.check_out,
      actual_check_in_at: res.actual_check_in_at,
      actual_check_out_at: res.actual_check_out_at,
      // Financials only on the primary row so reports don't double-count.
      total_amount: is_primary ? res.total_amount : 0,
      paid_amount: is_primary ? res.paid_amount : 0,
      payment_currency: res.payment_currency,
    }))
  );
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

    // Keep reservation_guests in sync with the primary guest pointer.
    // Demote any existing primary, then upsert the new guest as primary.
    if (updateData.guest_id) {
      await (supabase as any)
        .from("reservation_guests")
        .update({ is_primary: false })
        .eq("reservation_id", id)
        .eq("is_primary", true);

      await (supabase as any)
        .from("reservation_guests")
        .upsert(
          {
            organization_id: reservation.organization_id,
            reservation_id: id,
            guest_id: updateData.guest_id,
            is_primary: true,
          },
          { onConflict: "reservation_id,guest_id" }
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
