import { createServiceClient } from "@/lib/supabase/server";

const DEMO_SLUG = "demo-hostel";

export async function POST() {
  try {
    const service = await createServiceClient();

    const { data: org } = await service
      .from("organizations")
      .select("id")
      .eq("slug", DEMO_SLUG)
      .maybeSingle();

    if (!org) return Response.json({ error: "Demo org not found" }, { status: 404 });

    const orgId = org.id;

    // Wipe all data in FK order
    await service.from("reservation_items").delete().eq("organization_id", orgId);
    await service.from("reservations").delete().eq("organization_id", orgId);
    await service.from("channels").delete().eq("organization_id", orgId);
    await service.from("guests").delete().eq("organization_id", orgId);
    await service.from("beds").delete().eq("organization_id", orgId);
    await service.from("rooms").delete().eq("organization_id", orgId);
    await service.from("room_types").delete().eq("organization_id", orgId);

    // Re-seed room types
    const { data: rt } = await service.from("room_types").insert([
      { organization_id: orgId, name: "Mixed Dormitory", type: "dorm", gender: "mixed", capacity: 6, base_price: 18 },
      { organization_id: orgId, name: "Female Dormitory", type: "dorm", gender: "female", capacity: 4, base_price: 20 },
      { organization_id: orgId, name: "Private Room", type: "private", gender: "mixed", capacity: 2, base_price: 55 },
    ]).select();

    if (!rt) return Response.json({ error: "Failed to seed room types" }, { status: 500 });
    const [mixedDorm, femaleDorm, privateRoom] = rt;

    // Re-seed rooms
    const { data: rooms } = await service.from("rooms").insert([
      { organization_id: orgId, room_type_id: mixedDorm.id, name: "Dorm 101", floor: 1 },
      { organization_id: orgId, room_type_id: mixedDorm.id, name: "Dorm 102", floor: 1 },
      { organization_id: orgId, room_type_id: femaleDorm.id, name: "Dorm 201", floor: 2 },
      { organization_id: orgId, room_type_id: privateRoom.id, name: "Private 301", floor: 3 },
      { organization_id: orgId, room_type_id: privateRoom.id, name: "Private 302", floor: 3 },
    ]).select();

    if (!rooms) return Response.json({ error: "Failed to seed rooms" }, { status: 500 });
    const [d101, d102, d201, p301, p302] = rooms;

    // Re-seed beds
    const dormBedNames = ["A", "B", "C", "D", "E", "F"];
    const bedInserts: any[] = [];
    for (const [room, count] of [[d101, 6], [d102, 6], [d201, 4]]) {
      for (let i = 0; i < (count as number); i++) {
        bedInserts.push({ organization_id: orgId, room_id: (room as any).id, name: `Bed ${dormBedNames[i]}`, position: i + 1 });
      }
    }
    for (const room of [p301, p302]) {
      bedInserts.push({ organization_id: orgId, room_id: room.id, name: "Bed 1", position: 1 });
      bedInserts.push({ organization_id: orgId, room_id: room.id, name: "Bed 2", position: 2 });
    }
    await service.from("beds").insert(bedInserts);

    // Re-seed guests
    const guestData = [
      { first_name: "Emma", last_name: "Wilson", email: "emma.w@email.com", nationality: "British", document_type: "passport", document_number: "PAS123456" },
      { first_name: "Lucas", last_name: "Martin", email: "lucas.m@email.com", nationality: "French", document_type: "passport", document_number: "FR789012" },
      { first_name: "Sofia", last_name: "García", email: "sofia.g@email.com", nationality: "Spanish", document_type: "national_id", document_number: "ES345678" },
      { first_name: "James", last_name: "Chen", email: "james.c@email.com", nationality: "American", document_type: "passport", document_number: "US901234" },
      { first_name: "Anna", last_name: "Kowalski", email: "anna.k@email.com", nationality: "Polish", document_type: "passport", document_number: "PL567890" },
      { first_name: "Marco", last_name: "Rossi", email: "marco.r@email.com", nationality: "Italian", document_type: "national_id", document_number: "IT234567" },
      { first_name: "Yuki", last_name: "Tanaka", email: "yuki.t@email.com", nationality: "Japanese", document_type: "passport", document_number: "JP890123" },
      { first_name: "Lena", last_name: "Schmidt", email: "lena.s@email.com", nationality: "German", document_type: "passport", document_number: "DE456789" },
      { first_name: "Carlos", last_name: "Silva", email: "carlos.s@email.com", nationality: "Brazilian", document_type: "passport", document_number: "BR012345" },
      { first_name: "Mia", last_name: "Johnson", email: "mia.j@email.com", nationality: "Australian", document_type: "passport", document_number: "AU678901" },
    ];
    const { data: guests } = await service.from("guests")
      .insert(guestData.map((g) => ({ ...g, organization_id: orgId })))
      .select();

    // Re-seed reservations
    const { data: beds } = await service.from("beds").select("id").eq("organization_id", orgId).limit(16);
    if (beds && beds.length >= 4 && guests && guests.length >= 5) {
      const today = new Date();
      const d = (offset: number) => {
        const dt = new Date(today);
        dt.setDate(dt.getDate() + offset);
        return dt.toISOString().split("T")[0];
      };
      const reservations = [
        { guest_id: guests[0].id, bed_id: beds[0].id, check_in: d(-5), check_out: d(2), status: "checked_in", price: 18 },
        { guest_id: guests[1].id, bed_id: beds[1].id, check_in: d(-2), check_out: d(3), status: "checked_in", price: 18 },
        { guest_id: guests[2].id, bed_id: beds[2].id, check_in: d(1), check_out: d(5), status: "confirmed", price: 18 },
        { guest_id: guests[3].id, bed_id: beds[3].id, check_in: d(2), check_out: d(6), status: "confirmed", price: 18 },
        { guest_id: guests[4].id, bed_id: beds[4].id, check_in: d(0), check_out: d(4), status: "confirmed", price: 18 },
        { guest_id: guests[5].id, bed_id: beds[5].id, check_in: d(-1), check_out: d(2), status: "checked_in", price: 18 },
        { guest_id: guests[6].id, bed_id: beds[6].id, check_in: d(3), check_out: d(7), status: "pending", price: 20 },
        { guest_id: guests[7].id, bed_id: beds[7].id, check_in: d(-10), check_out: d(-7), status: "checked_out", price: 20 },
        { guest_id: guests[8].id, bed_id: beds[8].id, check_in: d(-8), check_out: d(-5), status: "checked_out", price: 55 },
        { guest_id: guests[9].id, bed_id: beds[9 % beds.length].id, check_in: d(5), check_out: d(9), status: "confirmed", price: 55 },
        { guest_id: guests[0].id, bed_id: beds[10 % beds.length].id, check_in: d(-15), check_out: d(-12), status: "cancelled", price: 18 },
        { guest_id: guests[1].id, bed_id: beds[11 % beds.length].id, check_in: d(7), check_out: d(11), status: "confirmed", price: 18 },
      ];
      for (const r of reservations) {
        const nights = Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000);
        const total = nights * r.price;
        const { data: res } = await service.from("reservations").insert({
          organization_id: orgId, guest_id: r.guest_id, check_in: r.check_in, check_out: r.check_out,
          status: r.status, channel_source: "direct", total_amount: total,
          paid_amount: r.status === "checked_out" ? total : 0,
          reservation_number: "",
        }).select("id").single();
        if (res) {
          await service.from("reservation_items").insert({
            organization_id: orgId, reservation_id: res.id, bed_id: r.bed_id,
            check_in: r.check_in, check_out: r.check_out, price_per_night: r.price, total_price: total,
          });
        }
      }
    }

    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
