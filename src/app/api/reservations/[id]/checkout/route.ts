import { createServerClient } from "@/lib/supabase/server";
import { finalizeCheckout } from "@/lib/checkout";

type ReservationOrg = {
  organization_id: string;
  status: string;
  total_amount: number;
  check_out: string;
  guest_id: string;
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

    // Get reservation to verify access
    const { data: reservationRaw, error: resError } = await supabase
      .from("reservations")
      .select("organization_id, status, total_amount, check_out, guest_id")
      .eq("id", id)
      .single();

    const reservation = reservationRaw as (ReservationOrg & {
      status: string;
      total_amount: number;
    }) | null;

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
    const { paid_amount } = body;

    // Basic validation
    if (paid_amount !== undefined && (typeof paid_amount !== 'number' || paid_amount < 0)) {
      return Response.json(
        { error: "Invalid payment amount" },
        { status: 400 }
      );
    }

    // Update reservation: status to checked_out
    const { error: updateError } = await (supabase
      .from("reservations") as any)
      .update({
        status: "checked_out",
        ...(paid_amount !== undefined && { paid_amount }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return Response.json(
        { error: "Failed to check out reservation" },
        { status: 400 }
      );
    }

    // Mark bed(s) dirty for housekeeping + send checkout confirmation email
    await finalizeCheckout(supabase, id);

    return Response.json({
      success: true,
      receipt: {
        total_amount: reservation.total_amount,
        paid_amount: paid_amount ?? 0,
      },
    });
  } catch (error) {
    console.error("Error checking out reservation:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
