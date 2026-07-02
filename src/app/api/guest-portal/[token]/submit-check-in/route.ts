import { createServiceClient } from "@/lib/supabase/server";
import { sendCheckInSubmittedEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function compressImage(file: File): Promise<Buffer> {
  // Convert file to buffer for processing
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // In production, use sharp library: const sharp = require('sharp');
  // For now, return buffer as-is (compression will be client-side)
  if (buffer.length > 2 * 1024 * 1024) {
    console.warn("Large image detected. Client-side compression recommended.");
  }

  return buffer;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = await createServiceClient();

    // Validate token & get reservation
    const { data: reservation, error: resError } = await supabase
      .from("reservations")
      .select("id, organization_id, check_in, guest_id")
      .eq("check_in_token", token)
      .single() as any;

    if (resError || !reservation) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 404 }
      );
    }

    // Check expiry
    const checkInDate = new Date(reservation.check_in);
    const expiryDate = new Date(checkInDate);
    expiryDate.setDate(expiryDate.getDate() + 1);

    if (new Date() > expiryDate) {
      return NextResponse.json(
        { error: "Check-in window has closed" },
        { status: 410 }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();

    const firstName = formData.get("first_name") as string;
    const lastName = formData.get("last_name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const nationality = formData.get("nationality") as string;
    const documentType = formData.get("document_type") as string;
    const documentNumber = formData.get("document_number") as string;
    const emergencyContact = formData.get("emergency_contact") as string;

    const idPhotoFront = formData.get("id_photo_front") as File;
    const idPhotoBack = formData.get("id_photo_back") as File | null;

    // Validate required fields
    if (!firstName || !lastName || !email || !idPhotoFront) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate file sizes
    if (idPhotoFront.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Front ID photo exceeds 5MB limit" },
        { status: 413 }
      );
    }

    if (idPhotoBack && idPhotoBack.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Back ID photo exceeds 5MB limit" },
        { status: 413 }
      );
    }

    // Validate file types
    if (!ALLOWED_TYPES.includes(idPhotoFront.type)) {
      return NextResponse.json(
        { error: "Front ID must be JPG, PNG, or WebP" },
        { status: 400 }
      );
    }

    if (idPhotoBack && !ALLOWED_TYPES.includes(idPhotoBack.type)) {
      return NextResponse.json(
        { error: "Back ID must be JPG, PNG, or WebP" },
        { status: 400 }
      );
    }

    // Upload images to guest-documents bucket (same as existing guest upload flow)
    const orgId = reservation.organization_id;
    const guestId = reservation.guest_id;

    const uploadToStorage = async (file: File, label: string) => {
      const buffer = await compressImage(file);
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${guestId}-${label}-${Date.now()}.${ext}`;
      const filePath = `${orgId}/${guestId}/${fileName}`;

      const { error } = await supabase.storage
        .from("guest-documents")
        .upload(filePath, buffer, { contentType: file.type, upsert: false });

      if (error) throw new Error(`Failed to upload ${label} ID photo: ${error.message}`);

      return supabase.storage.from("guest-documents").getPublicUrl(filePath).data.publicUrl;
    };

    let frontUrl: string;
    try {
      frontUrl = await uploadToStorage(idPhotoFront, "front");
    } catch (err: any) {
      console.error("Front ID upload error:", err);
      return NextResponse.json({ error: "Failed to upload front ID photo" }, { status: 500 });
    }

    let backPhotoUrl: string | null = null;
    if (idPhotoBack) {
      try {
        backPhotoUrl = await uploadToStorage(idPhotoBack, "back");
      } catch (err) {
        console.warn("Back ID upload failed, continuing:", err);
      }
    }

    // Append to guest document_url array (same as upload-document route)
    const { data: currentGuest } = await supabase
      .from("guests")
      .select("document_url")
      .eq("id", guestId)
      .single();

    const existingDocs = currentGuest && (currentGuest as any).document_url
      ? JSON.parse((currentGuest as any).document_url)
      : [];

    const newDocs = [
      ...existingDocs,
      { url: frontUrl, fileName: `front-id`, uploadedAt: new Date().toISOString(), type: idPhotoFront.type },
      ...(backPhotoUrl ? [{ url: backPhotoUrl, fileName: `back-id`, uploadedAt: new Date().toISOString(), type: idPhotoBack!.type }] : []),
    ];

    await supabase.from("guests").update({ document_url: JSON.stringify(newDocs) }).eq("id", guestId);

    // Store submitted data in reservation
    const { error: updateError } = await supabase
      .from("reservations")
      .update({
        self_check_in_submitted_at: new Date().toISOString(),
        self_check_in_data: {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          nationality,
          document_type: documentType,
          document_number: documentNumber,
          emergency_contact: emergencyContact,
        },
        id_photos: [
          { url: frontUrl, type: "front", uploaded_at: new Date().toISOString() },
          ...(backPhotoUrl ? [{ url: backPhotoUrl, type: "back", uploaded_at: new Date().toISOString() }] : []),
        ],
      })
      .eq("id", reservation.id);

    if (updateError) {
      console.error("Reservation update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save check-in data" },
        { status: 500 }
      );
    }

    // Update guest data (optional: only if provided and different)
    if (reservation.guest_id) {
      const { error: guestUpdateError } = await supabase
        .from("guests")
        .update({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          nationality,
          document_type: documentType,
          document_number: documentNumber,
        })
        .eq("id", reservation.guest_id);

      if (guestUpdateError) {
        console.warn("Guest update warning:", guestUpdateError);
        // Don't fail, just warn
      }
    }

    // Send confirmation email
    await sendCheckInSubmittedEmail(
      email,
      firstName,
      (reservation as any).reservation_number || "RES-XX-XXXX",
      reservation.check_in
    ).catch((err) => console.error("Email send failed:", err));

    return NextResponse.json({
      success: true,
      check_in_status: "submitted",
      message: "Check-in submitted. Staff will verify within 24 hours.",
    });
  } catch (error) {
    console.error("Guest portal check-in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
