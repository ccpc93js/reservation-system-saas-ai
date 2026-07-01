import { createServerClient } from "@/lib/supabase/server";
import { canAddGuestBookEntry, getGuestBookLimit, getPlanLimits } from "@/lib/plan";

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
        guests(
          first_name, last_name, date_of_birth, nationality, country_of_birth,
          place_of_birth, document_type, document_number, document_issued_date,
          document_issued_place, document_expiry, jmbg
        ),
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

    // Enforce guest book plan limit
    const { data: orgRow } = await (supabase as any)
      .from("organizations").select("plan").eq("id", res.organization_id).single();
    const plan = orgRow?.plan ?? "free";
    const { count: currentCount } = await (supabase as any)
      .from("checkin_registry")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", res.organization_id);
    if (!canAddGuestBookEntry(plan, currentCount ?? 0)) {
      const limit = getGuestBookLimit(plan);
      return Response.json(
        { error: `Guest Book limit reached (${currentCount}/${limit} on ${plan} plan). Upgrade to add more entries.` },
        { status: 403 }
      );
    }

    // Check already registered
    const { data: existing } = await (supabase as any)
      .from("checkin_registry")
      .select("id")
      .eq("reservation_id", id)
      .maybeSingle();
    if (existing) return Response.json({ error: "Already registered in guest book" }, { status: 409 });

    const g = res.guests ?? {};
    const item = res.reservation_items?.[0];
    const bed = item?.beds;
    const room = bed?.rooms;

    const { error: insertError } = await (supabase as any)
      .from("checkin_registry")
      .insert({
        organization_id: res.organization_id,
        reservation_id: id,
        guest_id: res.guest_id,
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
        room_name: room?.name ?? null,
        bed_name: bed?.name ?? null,
        check_in: res.check_in,
        check_out: res.check_out,
        actual_check_in_at: res.actual_check_in_at,
        actual_check_out_at: res.actual_check_out_at,
        total_amount: res.total_amount,
        paid_amount: res.paid_amount,
        payment_currency: res.payment_currency,
      });

    if (insertError) return Response.json({ error: insertError.message }, { status: 400 });
    return Response.json({ success: true });
  } catch (err) {
    console.error("Registry error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
