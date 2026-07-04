import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
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

    const orgId = (membership as any).organization_id;

    // Parse request body
    const body = await request.json();
    const {
      existingGuestId,
      newGuestData,
      mergeSelections,
    }: {
      existingGuestId: string;
      newGuestData: any;
      mergeSelections: Record<string, "new" | "existing" | "combine">;
    } = body;

    // Verify existing guest exists and belongs to org
    const { data: existingGuest, error: existingError } = await supabase
      .from("guests")
      .select("*")
      .eq("id", existingGuestId)
      .eq("organization_id", orgId)
      .single();

    if (existingError || !existingGuest) {
      return Response.json({ error: "Existing guest not found" }, { status: 404 });
    }

    // Build merged guest object
    const mergedGuest: any = {
      ...existingGuest,
      updated_at: new Date().toISOString(),
    };

    // Apply field selections
    const fieldKeys = [
      "first_name",
      "last_name",
      "email",
      "phone",
      "nationality",
      "date_of_birth",
      "gender",
      "document_type",
      "document_number",
      "document_expiry",
      "document_issued_date",
      "document_issued_place",
      "place_of_birth",
      "country_of_birth",
      "place_of_residence",
      "country_of_residence",
      "jmbg",
      "unique_master_citizen",
      "notes",
      "document_url",
    ];

    for (const field of fieldKeys) {
      const selection = mergeSelections[field] || "existing";

      if (field === "document_url") {
        // Combine documents from both guests
        const newDocs = newGuestData.document_url
          ? typeof newGuestData.document_url === "string"
            ? JSON.parse(newGuestData.document_url)
            : Array.isArray(newGuestData.document_url)
            ? newGuestData.document_url
            : []
          : [];

        const existingDocs =
          (existingGuest as any).document_url && typeof (existingGuest as any).document_url === "string"
            ? JSON.parse((existingGuest as any).document_url)
            : Array.isArray((existingGuest as any).document_url)
            ? (existingGuest as any).document_url
            : [];

        // Combine arrays, avoiding duplicates
        const combined = [...existingDocs];
        for (const newDoc of newDocs) {
          if (!combined.some((d) => d.url === newDoc.url)) {
            combined.push(newDoc);
          }
        }

        mergedGuest.document_url = JSON.stringify(combined);
      } else if (field === "notes") {
        // Combine notes with separator
        const newNotes = newGuestData.notes || "";
        const existingNotes = (existingGuest as any).notes || "";

        if (selection === "combine") {
          const parts = [];
          if (existingNotes) parts.push(existingNotes);
          if (newNotes) parts.push(newNotes);
          const combined = parts.join("\n---\n");
          mergedGuest.notes =
            combined +
            `\n[MERGED FROM: ${newGuestData.first_name} ${newGuestData.last_name}]`;
        } else if (selection === "new") {
          mergedGuest.notes = newNotes || null;
        }
        // If "existing", keep the existing value (already set)
      } else if (selection === "new") {
        mergedGuest[field] = newGuestData[field] ?? null;
      }
      // If "existing", keep the existing value (already set)
    }

    // Document hash stays the same (immutable dedup key)
    // Don't modify document_hash

    // Update existing guest with merged data
    const { error: updateError } = await supabase
      .from("guests")
      .update(mergedGuest)
      .eq("id", existingGuestId);

    if (updateError) {
      console.error("Update error:", updateError);
      return Response.json(
        { error: "Failed to merge guests" },
        { status: 400 }
      );
    }

    return Response.json(
      {
        success: true,
        mergedGuestId: existingGuestId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error merging guests:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
