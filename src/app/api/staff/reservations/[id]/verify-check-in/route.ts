import { createServerClient } from "@/lib/supabase/server";
import {
  sendCheckInApprovedEmail,
  sendCheckInRejectedEmail,
} from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is staff
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { verified, rejection_reason } = await req.json();

    if (verified === undefined) {
      return NextResponse.json(
        { error: "verified flag required" },
        { status: 400 }
      );
    }

    // Get reservation
    const { data: reservation, error: resError } = await supabase
      .from("reservations")
      .select("id, organization_id, guest_id, self_check_in_data, reservation_number, check_in")
      .eq("id", id)
      .single() as any;

    if (resError || !reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Verify org access
    if (reservation.organization_id !== membership.organization_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (verified) {
      // Approve check-in
      const { error: updateError } = await supabase
        .from("reservations")
        .update({
          check_in_verified_at: new Date().toISOString(),
          check_in_verified_by: user.id,
        })
        .eq("id", reservation.id);

      if (updateError) {
        console.error("Verification error:", updateError);
        return NextResponse.json(
          { error: "Failed to verify check-in" },
          { status: 500 }
        );
      }

      // Get guest email for notification
      const { data: guest } = await supabase
        .from("guests")
        .select("first_name, last_name, email")
        .eq("id", reservation.guest_id)
        .single();

      if (guest?.email) {
        await sendCheckInApprovedEmail(
          guest.email,
          `${guest.first_name} ${guest.last_name}`,
          (reservation as any).reservation_number || "RES-XX-XXXX",
          (reservation as any).check_in
        ).catch((err) => console.error("Email send failed:", err));
      }

      return NextResponse.json({
        success: true,
        check_in_status: "verified",
        guest_notified: true,
      });
    } else {
      // Reject check-in
      if (!rejection_reason) {
        return NextResponse.json(
          { error: "rejection_reason required when verified=false" },
          { status: 400 }
        );
      }

      console.log("Rejecting check-in:", {
        reservationId: reservation.id,
        currentData: reservation.self_check_in_data,
        reason: rejection_reason,
      });

      const updatedData = {
        ...(reservation.self_check_in_data || {}),
        rejection_reason,
        rejected_at: new Date().toISOString(),
      };

      console.log("Updated data:", updatedData);

      const { error: updateError } = await supabase
        .from("reservations")
        .update({
          self_check_in_data: updatedData,
        })
        .eq("id", reservation.id);

      if (updateError) {
        console.error("Rejection error:", updateError);
        return NextResponse.json(
          { error: "Failed to reject check-in" },
          { status: 500 }
        );
      }

      console.log("Rejection update successful");

      // Get guest email for notification
      const { data: guest } = await supabase
        .from("guests")
        .select("first_name, last_name, email")
        .eq("id", reservation.guest_id)
        .single();

      if (guest?.email) {
        await sendCheckInRejectedEmail(
          guest.email,
          `${guest.first_name} ${guest.last_name}`,
          (reservation as any).reservation_number || "RES-XX-XXXX",
          rejection_reason
        ).catch((err) => console.error("Email send failed:", err));
      }

      return NextResponse.json({
        success: true,
        check_in_status: "rejected",
        guest_notified: true,
      });
    }
  } catch (error) {
    console.error("Verify check-in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
