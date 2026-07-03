import { createServiceClient } from "@/lib/supabase/server";
import { createGuestSchema } from "@/lib/validations/guest";
import { notifyOrg } from "@/lib/notifications";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const supabase = await createServiceClient();

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

    // Parse and validate request body
    const body = await request.json();
    console.log("Create guest request:", body);

    try {
      await createGuestSchema.validate(body);
    } catch (validationError: any) {
      console.error("Validation error:", validationError);
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const data = body;
    const orgId = (membership as any).organization_id;

    // Generate document hash if document_number provided
    // Prefer: type:number format, fallback to just number
    let documentHash = null;
    if (data.document_number) {
      const hashInput = data.document_type
        ? `${data.document_type}:${data.document_number}`
        : data.document_number;
      documentHash = crypto
        .createHash("sha256")
        .update(hashInput)
        .digest("hex");
    }

    // Check for existing guest with same document (deduplication)
    // Skip if force_create is true (user explicitly chose to create anyway)
    if (documentHash && !data.force_create) {
      const { data: existingGuest, error: queryError } = await ((supabase as any)
        .from("guests")
        .select("id, first_name, last_name, document_number, document_type")
        .eq("organization_id", orgId)
        .eq("document_hash", documentHash)
        .single());

      if (queryError && queryError.code !== "PGRST116") {
        // PGRST116 = no rows found (expected)
        console.error("Error checking for duplicate guest:", queryError);
      }

      if (existingGuest) {
        console.log("Duplicate guest detected:", existingGuest);
        await notifyOrg(
          orgId,
          "duplicate_guest",
          {
            guestName: `${existingGuest.first_name} ${existingGuest.last_name}`,
            documentNumber: existingGuest.document_number,
          },
          "/guests",
          user.id
        );
        return Response.json(
          {
            error: "Guest with this document already exists",
            duplicate: true,
            existingGuest: {
              id: existingGuest.id,
              name: `${existingGuest.first_name} ${existingGuest.last_name}`,
              document_type: existingGuest.document_type,
              document_number: existingGuest.document_number,
            },
          },
          { status: 409 }
        );
      }
    }

    // Remove force_create flag before storing
    const { force_create, ...guestData } = data;

    // Create guest
    const { data: newGuest, error: guestError } = await ((supabase as any)
      .from("guests")
      .insert({
        organization_id: orgId,
        first_name: guestData.first_name,
        last_name: guestData.last_name,
        email: guestData.email || null,
        phone: guestData.phone || null,
        nationality: guestData.nationality || null,
        document_type: guestData.document_type || null,
        document_number: guestData.document_number || null,
        document_hash: documentHash,
        date_of_birth: guestData.date_of_birth || null,
        gender: guestData.gender || null,
        notes: guestData.notes || null,
        place_of_birth: guestData.place_of_birth || null,
        country_of_birth: guestData.country_of_birth || null,
        place_of_residence: guestData.place_of_residence || null,
        country_of_residence: guestData.country_of_residence || null,
        document_expiry: guestData.document_expiry || null,
        document_issued_place: guestData.document_issued_place || null,
        document_issued_date: guestData.document_issued_date || null,
        jmbg: guestData.jmbg || null,
        unique_master_citizen: guestData.unique_master_citizen || null,
      })
      .select("id")
      .single());

    if (guestError) {
      console.error("Guest creation error:", guestError);
      return Response.json(
        { error: "Failed to create guest" },
        { status: 400 }
      );
    }

    return Response.json(
      { success: true, guest_id: (newGuest as any).id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating guest:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
