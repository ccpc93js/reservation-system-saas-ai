import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_UPDATE_FIELDS = [
  "first_name", "last_name", "date_of_birth", "nationality", "country_of_birth",
  "place_of_birth", "document_type", "document_number", "document_issued_date",
  "document_issued_place", "document_expiry", "jmbg",
  "service_type", "room_name", "bed_name",
  "check_in", "check_out", "actual_check_in_at", "actual_check_out_at",
  "total_amount", "paid_amount", "payment_currency",
];

async function getEntryAndVerify(supabase: any, id: string, userId: string) {
  const { data: entry } = await supabase
    .from("checkin_registry")
    .select("id, organization_id")
    .eq("id", id)
    .single();
  if (!entry) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", entry.organization_id)
    .eq("user_id", userId)
    .single();
  if (!membership) return null;

  return entry;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const entry = await getEntryAndVerify(supabase, id, user.id);
    if (!entry) return Response.json({ error: "Not found or forbidden" }, { status: 404 });

    const body = await request.json();
    const updateData: Record<string, any> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in body) updateData[key] = body[key];
    }
    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error: updateError } = await (supabase as any)
      .from("checkin_registry")
      .update(updateData)
      .eq("id", id);

    if (updateError) return Response.json({ error: updateError.message }, { status: 400 });
    return Response.json({ success: true });
  } catch (err) {
    console.error("Registry patch error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const entry = await getEntryAndVerify(supabase, id, user.id);
    if (!entry) return Response.json({ error: "Not found or forbidden" }, { status: 404 });

    const { error: deleteError } = await (supabase as any)
      .from("checkin_registry")
      .delete()
      .eq("id", id);

    if (deleteError) return Response.json({ error: deleteError.message }, { status: 400 });
    return Response.json({ success: true });
  } catch (err) {
    console.error("Registry delete error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
