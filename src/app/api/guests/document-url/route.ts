import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createServiceClient();

    // Get current user
    const authClient = await (async () => {
      const { createServerClient } = await import("@/lib/supabase/server");
      return await createServerClient();
    })();

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request
    const { filePath, guestId } = await request.json();

    if (!filePath || !guestId) {
      return Response.json(
        { error: "filePath and guestId required" },
        { status: 400 }
      );
    }

    // Verify user has access to this guest's organization
    const { data: membership, error: membershipError } = await authClient
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

    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .select("id, organization_id")
      .eq("id", guestId)
      .eq("organization_id", (membership as any).organization_id)
      .single();

    if (guestError || !guest) {
      return Response.json({ error: "Guest not found" }, { status: 404 });
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrl, error: signError } = await supabase.storage
      .from("guest-documents")
      .createSignedUrl(filePath, 3600); // 1 hour expiration

    if (signError) {
      console.error("Signed URL error:", signError);
      return Response.json(
        { error: "Failed to generate download URL" },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      url: signedUrl.signedUrl,
    });
  } catch (error) {
    console.error("Error generating document URL:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
