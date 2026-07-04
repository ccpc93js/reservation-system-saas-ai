import { createServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { DocumentMetadata } from "@/lib/types/database";

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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const guestId = formData.get("guestId") as string;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!guestId) {
      return Response.json({ error: "Guest ID is required" }, { status: 400 });
    }

    // Verify guest exists and belongs to org
    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .select("id")
      .eq("id", guestId)
      .eq("organization_id", orgId)
      .single();

    if (guestError || !guest) {
      return Response.json({ error: "Guest not found" }, { status: 404 });
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${guestId}-${randomUUID()}.${fileExt}`;
    const filePath = `${orgId}/${guestId}/${fileName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("guest-documents")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return Response.json(
        { error: "Failed to upload document" },
        { status: 400 }
      );
    }

    // Generate public URL
    const { data: publicUrlData } = supabase.storage
      .from("guest-documents")
      .getPublicUrl(filePath);

    // Get current document_url if exists
    const { data: currentGuest } = await supabase
      .from("guests")
      .select("document_url")
      .eq("id", guestId)
      .single();

    // Store document URL in guest record
    const documentUrls: DocumentMetadata[] = currentGuest && (currentGuest as any).document_url
      ? JSON.parse((currentGuest as any).document_url)
      : [];

    // Add new document to array
    documentUrls.push({
      url: publicUrlData.publicUrl,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      type: file.type,
    });

    // Update guest with document URL array
    const updateData = { document_url: JSON.stringify(documentUrls) };
    const { error: updateError } = await ((supabase as any)
      .from("guests")
      .update(updateData)
      .eq("id", guestId));

    if (updateError) {
      console.error("Update error:", updateError);
      return Response.json(
        { error: "Failed to save document reference" },
        { status: 400 }
      );
    }

    return Response.json(
      {
        success: true,
        url: publicUrlData.publicUrl,
        fileName: file.name,
        filePath,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading document:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
