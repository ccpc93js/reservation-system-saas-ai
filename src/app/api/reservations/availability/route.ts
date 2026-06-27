import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bedId = searchParams.get("bed_id");
    const checkIn = searchParams.get("check_in");
    const checkOut = searchParams.get("check_out");
    const excludeId = searchParams.get("exclude_id"); // for edits

    if (!bedId || !checkIn || !checkOut) {
      return Response.json({ error: "bed_id, check_in, check_out required" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let query = (supabase
      .from("reservation_items") as any)
      .select("id, check_in, check_out, reservations!inner(id, reservation_number, status, guests(first_name, last_name))")
      .eq("bed_id", bedId)
      .lt("check_in", checkOut)
      .gt("check_out", checkIn)
      .not("reservations.status", "in", '("cancelled","checked_out","no_show")');

    if (excludeId) {
      query = query.neq("reservations.id", excludeId);
    }

    const { data: conflicts } = await query;

    return Response.json({
      available: !conflicts || conflicts.length === 0,
      conflicts: (conflicts || []).map((c: any) => ({
        check_in: c.check_in,
        check_out: c.check_out,
        reservation_number: c.reservations?.reservation_number,
        guest: c.reservations?.guests
          ? `${c.reservations.guests.first_name} ${c.reservations.guests.last_name}`
          : "Guest",
      })),
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
