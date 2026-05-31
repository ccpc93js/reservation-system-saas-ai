import { createServerClient } from "@/lib/supabase/server";
import { updateGuestSchema } from "@/lib/validations/guest";
import crypto from "crypto";

export async function GET(
  _request: Request,
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

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    // Fetch guest
    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .select("*")
      .eq("id", id)
      .eq("organization_id", (membership as any).organization_id)
      .single();

    if (guestError || !guest) {
      return Response.json({ error: "Guest not found" }, { status: 404 });
    }

    // Get reservation count
    const { count: reservationCount } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("guest_id", id)
      .not("status", "in", '("cancelled","checked_out")');

    return Response.json({
      ...(guest as any),
      reservation_count: reservationCount || 0,
    });
  } catch (error) {
    console.error("Error fetching guest:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  _request: Request,
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

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    // Verify guest exists and belongs to org
    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .select("id")
      .eq("id", id)
      .eq("organization_id", (membership as any).organization_id)
      .single();

    if (guestError || !guest) {
      return Response.json({ error: "Guest not found" }, { status: 404 });
    }

    // Parse and validate update data
    const body = await _request.json();

    try {
      await updateGuestSchema.validate(body);
    } catch (validationError: any) {
      console.error("Validation error:", validationError);
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};

    // Only include fields that are provided, convert empty strings to null
    if (body.first_name !== undefined) updateData.first_name = body.first_name || null;
    if (body.last_name !== undefined) updateData.last_name = body.last_name || null;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.nationality !== undefined) updateData.nationality = body.nationality || null;
    if (body.document_type !== undefined) updateData.document_type = body.document_type || null;
    if (body.document_number !== undefined) {
      updateData.document_number = body.document_number || null;
      if (body.document_number) {
        const docType = body.document_type || updateData.document_type;
        const hashInput = docType
          ? `${docType}:${body.document_number}`
          : body.document_number;
        updateData.document_hash = crypto
          .createHash("sha256")
          .update(hashInput)
          .digest("hex");
      } else {
        updateData.document_hash = null;
      }
    }
    if (body.date_of_birth !== undefined) updateData.date_of_birth = body.date_of_birth || null;
    if (body.gender !== undefined) updateData.gender = body.gender || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.place_of_birth !== undefined) updateData.place_of_birth = body.place_of_birth || null;
    if (body.country_of_birth !== undefined) updateData.country_of_birth = body.country_of_birth || null;
    if (body.place_of_residence !== undefined) updateData.place_of_residence = body.place_of_residence || null;
    if (body.country_of_residence !== undefined) updateData.country_of_residence = body.country_of_residence || null;
    if (body.document_expiry !== undefined) updateData.document_expiry = body.document_expiry || null;
    if (body.document_issued_place !== undefined) updateData.document_issued_place = body.document_issued_place || null;
    if (body.document_issued_date !== undefined) updateData.document_issued_date = body.document_issued_date || null;
    if (body.jmbg !== undefined) updateData.jmbg = body.jmbg || null;
    if (body.unique_master_citizen !== undefined) updateData.unique_master_citizen = body.unique_master_citizen || null;

    updateData.updated_at = new Date().toISOString();

    // Update guest
    const { error: updateError } = await (supabase
      .from("guests") as any)
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Update error:", updateError);
      return Response.json(
        { error: updateError.message || "Failed to update guest" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating guest:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
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

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    // Verify guest exists and belongs to org
    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .select("id")
      .eq("id", id)
      .eq("organization_id", (membership as any).organization_id)
      .single();

    if (guestError || !guest) {
      return Response.json({ error: "Guest not found" }, { status: 404 });
    }

    // Check for active reservations
    const { data: activeReservations, error: checkError } = await supabase
      .from("reservations")
      .select("id")
      .eq("guest_id", id)
      .not("status", "in", '("cancelled","checked_out")');

    if (checkError) {
      console.error("Check error:", checkError);
      return Response.json(
        { error: "Failed to check reservations" },
        { status: 400 }
      );
    }

    if (activeReservations && activeReservations.length > 0) {
      return Response.json(
        {
          error:
            "Cannot delete guest with active reservations. Please cancel or checkout all reservations first.",
        },
        { status: 409 }
      );
    }

    // Delete guest
    const { error: deleteError } = await supabase
      .from("guests")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return Response.json(
        { error: "Failed to delete guest" },
        { status: 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting guest:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
