import { createServerClient } from "@/lib/supabase/server";
import { getGuestBookLimit } from "@/lib/plan";

const GUEST_IDENTITY_FIELDS = `
  id, first_name, last_name, date_of_birth, nationality, country_of_birth,
  place_of_birth, document_type, document_number, document_issued_date,
  document_issued_place, document_expiry, jmbg
`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: resRaw } = await supabase
      .from("reservations")
      .select(`
        organization_id, guest_id, reservation_number, service_type,
        check_in, check_out, actual_check_in_at, actual_check_out_at,
        total_amount, paid_amount, payment_currency, status,
        guests(${GUEST_IDENTITY_FIELDS}),
        reservation_items(beds(name, rooms(name)))
      `)
      .eq("id", id)
      .single();
    const res = resRaw as any;
    if (!res) return Response.json({ error: "Reservation not found" }, { status: 404 });

    const { data: membership } = await supabase
      .from("memberships").select("role")
      .eq("organization_id", res.organization_id).eq("user_id", user.id).single();
    if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

    // Occupants: every guest on the reservation (primary + companions).
    // Falls back to the reservation's primary guest for pre-companion data.
    const { data: rgRows } = await (supabase as any)
      .from("reservation_guests")
      .select(`is_primary, guests(${GUEST_IDENTITY_FIELDS})`)
      .eq("reservation_id", id)
      .order("is_primary", { ascending: false });

    let occupants: { is_primary: boolean; guest: any }[] =
      (rgRows ?? [])
        .filter((r: any) => r.guests)
        .map((r: any) => ({ is_primary: r.is_primary, guest: r.guests }));
    if (occupants.length === 0 && res.guests) {
      occupants = [{ is_primary: true, guest: res.guests }];
    }
    if (occupants.length === 0) {
      return Response.json({ error: "Reservation has no guests to register" }, { status: 400 });
    }

    // Idempotent per guest: only insert occupants not registered yet.
    const { data: existingRows } = await (supabase as any)
      .from("checkin_registry")
      .select("guest_id")
      .eq("reservation_id", id);
    const registered = new Set((existingRows ?? []).map((r: any) => r.guest_id).filter(Boolean));
    const toAdd = occupants.filter((o) => !registered.has(o.guest.id));
    if (toAdd.length === 0) {
      return Response.json({ error: "All guests already registered in guest book" }, { status: 409 });
    }

    // Enforce guest book plan limit (one entry per occupant).
    const { data: orgRow } = await (supabase as any)
      .from("organizations").select("plan").eq("id", res.organization_id).single();
    const plan = orgRow?.plan ?? "free";
    const limit = getGuestBookLimit(plan);
    const { count: currentCount } = await (supabase as any)
      .from("checkin_registry")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", res.organization_id);
    if (limit !== -1 && (currentCount ?? 0) + toAdd.length > limit) {
      return Response.json(
        { error: `Guest Book limit reached (${currentCount}/${limit} on ${plan} plan). Upgrade to add more entries.` },
        { status: 403 }
      );
    }
    const bedNames = (res.reservation_items ?? [])
      .map((it: any) => it.beds?.name)
      .filter(Boolean);
    const roomName = res.reservation_items?.[0]?.beds?.rooms?.name ?? null;

    const rows = toAdd.map(({ is_primary, guest: g }) => ({
      organization_id: res.organization_id,
      reservation_id: id,
      guest_id: g.id,
      is_primary,
      reservation_number: res.reservation_number,
      first_name: g.first_name,
      last_name: g.last_name,
      date_of_birth: g.date_of_birth,
      nationality: g.nationality,
      country_of_birth: g.country_of_birth,
      place_of_birth: g.place_of_birth,
      document_type: g.document_type,
      document_number: g.document_number,
      document_issued_date: g.document_issued_date,
      document_issued_place: g.document_issued_place,
      document_expiry: g.document_expiry,
      jmbg: g.jmbg,
      service_type: res.service_type,
      room_name: roomName,
      bed_name: bedNames.length > 0 ? bedNames.join(", ") : null,
      check_in: res.check_in,
      check_out: res.check_out,
      actual_check_in_at: res.actual_check_in_at,
      actual_check_out_at: res.actual_check_out_at,
      // Financials only on the primary row so per-stay reports don't double-count.
      total_amount: is_primary ? res.total_amount : 0,
      paid_amount: is_primary ? res.paid_amount : 0,
      payment_currency: res.payment_currency,
    }));

    const { error: insertError } = await (supabase as any)
      .from("checkin_registry")
      .insert(rows);

    if (insertError) return Response.json({ error: insertError.message }, { status: 400 });
    return Response.json({ success: true, added: rows.length });
  } catch (err) {
    console.error("Registry error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
