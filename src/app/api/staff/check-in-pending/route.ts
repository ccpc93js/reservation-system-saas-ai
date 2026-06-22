import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's org
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch pending check-ins (exclude verified and rejected)
    const { data: allPending, error } = (await supabase
      .from("reservations")
      .select(
        `
        id,
        check_in_token,
        reservation_number,
        check_in,
        self_check_in_submitted_at,
        self_check_in_data,
        id_photos,
        guests(first_name, last_name, email, phone),
        reservation_items(beds(name, rooms(name)))
      `
      )
      .eq("organization_id", membership.organization_id)
      .not("self_check_in_submitted_at", "is", null)
      .is("check_in_verified_at", null)
      .order("self_check_in_submitted_at", { ascending: false })) as any;

    // Filter out rejected check-ins (those with rejection_reason in self_check_in_data)
    const pending = allPending?.filter(
      (res: any) => !res.self_check_in_data?.rejection_reason
    ) || [];

    if (error) {
      console.error("Pending check-ins fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch pending check-ins" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      pending: pending?.map((res: any) => ({
        id: res.id,
        check_in_token: res.check_in_token,
        reservation_number: res.reservation_number,
        check_in: res.check_in,
        submitted_at: res.self_check_in_submitted_at,
        guest: res.guests
          ? {
              first_name: res.guests.first_name,
              last_name: res.guests.last_name,
              email: res.guests.email,
              phone: res.guests.phone,
            }
          : null,
        room: res.reservation_items?.[0]?.beds?.rooms?.name || "Unknown",
        self_check_in_data: res.self_check_in_data,
        id_photos: res.id_photos,
      })) || [],
      count: pending?.length || 0,
    });
  } catch (error) {
    console.error("Staff pending check-ins error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
