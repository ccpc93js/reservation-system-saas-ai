import { createServerClient } from "@/lib/supabase/server";

// Resolve the reservation's org and verify the caller is a member.
async function authorize(supabase: any, reservationId: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Unauthorized", status: 401 as const };

  const { data: res } = await supabase
    .from("reservations")
    .select("organization_id")
    .eq("id", reservationId)
    .single();
  if (!res) return { error: "Reservation not found", status: 404 as const };

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", res.organization_id)
    .eq("user_id", user.id)
    .single();
  if (!membership) return { error: "Forbidden", status: 403 as const };

  return { organizationId: res.organization_id as string };
}

// List all guests attached to a reservation (primary first).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const auth = await authorize(supabase, id);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const { data, error } = await (supabase as any)
      .from("reservation_guests")
      .select("id, is_primary, guest_id, created_at, guests(id, first_name, last_name, email, phone, document_type, document_number)")
      .eq("reservation_id", id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ guests: data ?? [] });
  } catch (err) {
    console.error("List reservation guests error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Attach an existing guest to the reservation as a companion.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const auth = await authorize(supabase, id);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const guestId = body?.guest_id as string | undefined;
    if (!guestId) return Response.json({ error: "guest_id is required" }, { status: 400 });

    // Guard: the guest must belong to the same org (RLS also enforces this).
    const { data: guest } = await (supabase as any)
      .from("guests")
      .select("id, organization_id, first_name, last_name")
      .eq("id", guestId)
      .single();
    if (!guest || guest.organization_id !== auth.organizationId) {
      return Response.json({ error: "Guest not found" }, { status: 404 });
    }

    // Capacity: total guests (primary + companions) cannot exceed the number
    // of beds booked (one reservation_item per bed).
    const [{ count: bedCount }, { count: guestCount }] = await Promise.all([
      (supabase as any).from("reservation_items").select("id", { count: "exact", head: true }).eq("reservation_id", id),
      (supabase as any).from("reservation_guests").select("id", { count: "exact", head: true }).eq("reservation_id", id),
    ]);
    if ((guestCount ?? 0) >= (bedCount ?? 0)) {
      return Response.json(
        { error: `Reservation is full — it has ${bedCount ?? 0} bed(s). Book more beds to add more guests.`, code: "reservation_full" },
        { status: 409 }
      );
    }

    const { data, error } = await (supabase as any)
      .from("reservation_guests")
      .insert({
        organization_id: auth.organizationId,
        reservation_id: id,
        guest_id: guestId,
        is_primary: false,
      })
      .select("id, is_primary, guest_id, created_at, guests(id, first_name, last_name, email, phone, document_type, document_number)")
      .single();

    if (error) {
      // Unique violation → guest already on the reservation.
      if (error.code === "23505") {
        return Response.json({ error: "Guest is already on this reservation" }, { status: 409 });
      }
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ guest: data });
  } catch (err) {
    console.error("Add reservation guest error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Remove a companion guest from the reservation.
// The primary guest cannot be removed here (change it via the reservation's guest_id instead).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const auth = await authorize(supabase, id);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get("guest_id");
    if (!guestId) return Response.json({ error: "guest_id is required" }, { status: 400 });

    const { data: row } = await (supabase as any)
      .from("reservation_guests")
      .select("id, is_primary")
      .eq("reservation_id", id)
      .eq("guest_id", guestId)
      .maybeSingle();
    if (!row) return Response.json({ error: "Guest not on this reservation" }, { status: 404 });
    if (row.is_primary) {
      return Response.json({ error: "Cannot remove the primary guest. Change the primary guest first." }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from("reservation_guests")
      .delete()
      .eq("reservation_id", id)
      .eq("guest_id", guestId);

    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ success: true });
  } catch (err) {
    console.error("Remove reservation guest error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
