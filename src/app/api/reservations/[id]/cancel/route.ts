import { createServerClient } from "@/lib/supabase/server";
import { sendReservationCancelledEmail, getOrgLogoUrl } from "@/lib/email";
import { notifyOrg } from "@/lib/notifications";

type ReservationOrg = { organization_id: string };

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

    // Parse and validate
    const body = await request.json();
    const { cancellation_reason, cancellation_notes } = body;

    // Basic validation
    const validReasons = ['guest_request', 'overbooking', 'property_issue', 'other'];
    if (!validReasons.includes(cancellation_reason)) {
      return Response.json(
        { error: "Invalid cancellation reason" },
        { status: 400 }
      );
    }
    const reasonLabel = cancellation_reason
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    const noteText = cancellation_notes
      ? `Cancelled: ${reasonLabel} - ${cancellation_notes}`
      : `Cancelled: ${reasonLabel}`;

    // Update reservation: status to cancelled, append reason to notes
    const { error: updateError } = await (supabase
      .from("reservations") as any)
      .update({
        status: "cancelled",
        notes: noteText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return Response.json(
        { error: "Failed to cancel reservation" },
        { status: 400 }
      );
    }

    // Send cancellation email
    const { data: resData } = await supabase
      .from("reservations")
      .select("guest_id, id")
      .eq("id", id)
      .single();

    if (resData?.guest_id) {
      const { data: guest } = await supabase
        .from("guests")
        .select("first_name, last_name, email")
        .eq("id", resData.guest_id)
        .single();

      if (guest?.email) {
        const orgLogo = await getOrgLogoUrl(supabase, reservation.organization_id);
        await sendReservationCancelledEmail(
          guest.email,
          `${guest.first_name} ${guest.last_name}`,
          id.substring(0, 8).toUpperCase(),
          undefined,
          orgLogo
        ).catch((err) => console.error("Email send failed:", err));
      }

      await notifyOrg(
        reservation.organization_id,
        "reservation_cancelled",
        {
          guestName: guest ? `${guest.first_name} ${guest.last_name}` : null,
          reservationNumber: id.substring(0, 8).toUpperCase(),
        },
        "/reservations",
        user.id
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
