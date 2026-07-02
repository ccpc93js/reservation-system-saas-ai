import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: reservation, error } = await supabase
      .from("reservations")
      .select(
        `
        id,
        reservation_number,
        check_in,
        check_out,
        status,
        total_amount,
        guest_id,
        self_check_in_submitted_at,
        self_check_in_data,
        check_in_verified_at,
        room:reservation_items(
          beds(id, name, rooms(id, name, floor))
        )
      `
      )
      .eq("check_in_token", token)
      .single() as any;

    if (error || !reservation) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 404 }
      );
    }

    // Check if token is still valid (within 24h of check_in date)
    const checkInDate = new Date(reservation.check_in);
    const expiryDate = new Date(checkInDate);
    expiryDate.setDate(expiryDate.getDate() + 1);

    if (new Date() > expiryDate) {
      return NextResponse.json(
        { error: "Check-in window has closed" },
        { status: 410 }
      );
    }

    // Get guest data
    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .select(
        "id, first_name, last_name, email, phone, nationality, document_type, document_number"
      )
      .eq("id", reservation.guest_id)
      .single();

    if (guestError || !guest) {
      return NextResponse.json(
        { error: "Guest data not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      reservation: {
        id: reservation.id,
        reservation_number: reservation.reservation_number,
        check_in: reservation.check_in,
        check_out: reservation.check_out,
        status: reservation.status,
        total_amount: reservation.total_amount,
        room:
          reservation.room && reservation.room[0]?.beds
            ? {
                name: reservation.room[0].beds[0]?.rooms?.name,
                floor: reservation.room[0].beds[0]?.rooms?.floor,
              }
            : null,
      },
      guest,
      check_in_status: reservation.check_in_verified_at
        ? "verified"
        : reservation.self_check_in_submitted_at
          ? "submitted"
          : "pending",
      rejection_reason: reservation.self_check_in_data?.rejection_reason || null,
      available_until: expiryDate.toISOString(),
    });
  } catch (error) {
    console.error("Guest portal GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
