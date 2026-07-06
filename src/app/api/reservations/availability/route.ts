import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bedId = searchParams.get("bed_id");
    const roomId = searchParams.get("room_id");
    const checkIn = searchParams.get("check_in");
    const checkOut = searchParams.get("check_out");
    const excludeId = searchParams.get("exclude_id"); // for edits

    if ((!bedId && !roomId) || !checkIn || !checkOut) {
      return Response.json({ error: "bed_id or room_id, plus check_in and check_out, required" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Room-level mode: return per-bed availability for every bed in the room,
    // so the booking drawer can offer multi-bed selection / auto-assign.
    if (roomId) {
      const { data: beds } = await (supabase.from("beds") as any)
        .select("id, name, position, is_active")
        .eq("room_id", roomId)
        .order("position", { ascending: true })
        .order("name", { ascending: true });

      const bedIdList = (beds || []).map((b: any) => b.id);
      let booked: any[] = [];
      if (bedIdList.length > 0) {
        let bq = (supabase.from("reservation_items") as any)
          .select("bed_id, reservations!inner(id, status)")
          .in("bed_id", bedIdList)
          .lt("check_in", checkOut)
          .gt("check_out", checkIn)
          .not("reservations.status", "in", '("cancelled","checked_out","no_show")');
        if (excludeId) bq = bq.neq("reservations.id", excludeId);
        const { data } = await bq;
        booked = data || [];
      }
      const bookedSet = new Set(booked.map((b: any) => b.bed_id));

      const bedsOut = (beds || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        is_active: b.is_active,
        available: b.is_active && !bookedSet.has(b.id),
      }));

      return Response.json({
        beds: bedsOut,
        free_count: bedsOut.filter((b: any) => b.available).length,
        total_count: bedsOut.length,
      });
    }

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
