import { createServerClient } from "@/lib/supabase/server";
import { updateReservationSchema } from "@/lib/validations/reservation";

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
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return Response.json(
        { error: "Failed to update reservation" },
        { status: 400 }
      );
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
