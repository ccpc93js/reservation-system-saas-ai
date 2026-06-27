import { createServerClient } from "@/lib/supabase/server";
import { createReservationSchema } from "@/lib/validations/reservation";
import { differenceInDays } from "date-fns";
import { sendReservationConfirmationEmail } from "@/lib/email";

const IS_DEV = process.env.NODE_ENV !== "production";

const errorMessage = (fallback: string, error?: any) => {
  if (!IS_DEV || !error) return fallback;

  const details = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" | ");

  return details ? `${fallback}: ${details}` : fallback;
};

const fail = (stage: string, fallback: string, status: number, error?: any) => {
  console.error(`[reservations/create] ${stage}`, error || fallback);
  return Response.json(
    {
      error: errorMessage(fallback, error),
      stage,
      ...(IS_DEV
        ? {
            details: error
              ? {
                  message: error.message ?? null,
                  code: error.code ?? null,
                  hint: error.hint ?? null,
                  details: error.details ?? null,
                }
              : null,
          }
        : {}),
    },
    { status }
  );
};

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return fail("auth.getUser", "Unauthorized", 401, userError);
    }

    // Parse and validate request body
    let body: any;
    try {
      body = await request.json();
    } catch (parseError: any) {
      return fail("request.json", "Invalid JSON body", 400, parseError);
    }

    console.log("Request body:", body);

    try {
      await createReservationSchema.validate(body);
    } catch (validationError: any) {
      return fail("schema.validate", validationError.message, 400, validationError);
    }

    const data = body;

    // Verify user belongs to org
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", data.org_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return fail(
        "memberships.select",
        "You don't have access to this organization",
        403,
        membershipError
      );
    }

    // Create or get guest
    let guestId = data.guest_id && data.guest_id !== "new" ? data.guest_id : null;

    if (!guestId) {
      const { data: newGuest, error: guestError } = await (supabase
        .from("guests") as any)
        .insert({
          organization_id: data.org_id,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email || null,
          nationality: null,
          document_type: null,
          document_number: null,
        })
        .select("id")
        .single();

      if (guestError) {
        return fail("guests.insert", "Failed to create guest", 400, guestError);
      }

      guestId = newGuest.id;
    }

    // Create reservation (header)
    const { data: reservation, error: resError } = await (supabase
      .from("reservations") as any)
      .insert({
        organization_id: data.org_id,
        guest_id: guestId,
        check_in: data.check_in,
        check_out: data.check_out,
        status: "pending",
        channel: "direct_website",
        adults: 1,
        children: 0,
        total_amount: 0,
        paid_amount: 0,
        notes: data.notes || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (resError) {
      return fail("reservations.insert", "Failed to create reservation", 400, resError);
    }

    const checkIn = new Date(data.check_in);
    const checkOut = new Date(data.check_out);
    const nights = differenceInDays(checkOut, checkIn);

    if (nights <= 0) {
      await (supabase.from("reservations") as any).delete().eq("id", reservation.id);
      return fail("nights.compute", "Check-out date must be after check-in date", 400);
    }

    // Conflict check: reject if bed already booked for these dates
    const { data: conflicts } = await (supabase
      .from("reservation_items") as any)
      .select("id, reservations!inner(status)")
      .eq("bed_id", data.bed_id)
      .lt("check_in", data.check_out)
      .gt("check_out", data.check_in)
      .not("reservations.status", "in", '("cancelled","checked_out","no_show")');

    if (conflicts && conflicts.length > 0) {
      await (supabase.from("reservations") as any).delete().eq("id", reservation.id);
      return fail("conflict.check", "This bed is already booked for the selected dates", 409);
    }

    const totalPrice = nights * data.price_per_night;

    // One item per reservation (full stay) — not per night
    const { error: itemsError } = await (supabase
      .from("reservation_items") as any)
      .insert({
        organization_id: data.org_id,
        reservation_id: reservation.id,
        bed_id: data.bed_id,
        check_in: data.check_in,
        check_out: data.check_out,
        price_per_night: data.price_per_night,
        total_price: totalPrice,
      });

    if (itemsError) {
      console.error("[reservations/create] reservation_items.insert", itemsError);
      // Rollback: delete reservation
      await (supabase.from("reservations") as any).delete().eq("id", reservation.id);
      return fail("reservation_items.insert", "Failed to create reservation items", 400, itemsError);
    }

    // Update reservation total_amount
    const { error: totalUpdateError } = await (supabase
      .from("reservations") as any)
      .update({ total_amount: totalPrice })
      .eq("id", reservation.id);

    if (totalUpdateError) {
      return fail("reservations.updateTotal", "Reservation created but failed to update total", 400, totalUpdateError);
    }

    // Fetch guest and room info for email
    const { data: guest } = await supabase
      .from("guests")
      .select("email")
      .eq("id", guestId)
      .single();

    const { data: room } = await (supabase
      .from("reservation_items") as any)
      .select("beds(rooms(name))")
      .eq("reservation_id", reservation.id)
      .single();

    // Send confirmation email
    if (guest?.email) {
      await sendReservationConfirmationEmail(
        guest.email,
        `${data.first_name} ${data.last_name}`,
        reservation.id.substring(0, 8).toUpperCase(),
        data.check_in,
        data.check_out,
        room?.beds?.rooms?.name,
        totalPrice
      ).catch((err) => console.error("Email send failed:", err));
    }

    return Response.json(
      { success: true, reservation_id: reservation.id },
      { status: 201 }
    );
  } catch (error) {
    return fail("unhandled", "Internal server error", 500, error);
  }
}
