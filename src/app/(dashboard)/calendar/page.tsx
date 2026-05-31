import { createServerClient } from "@/lib/supabase/server";
import CalendarClient from "@/components/calendar/calendar-client";

export default async function CalendarPage() {
  const supabase = await createServerClient();

  // Get org context
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("organization_id")
    .single();

  if (error || !membership) {
    return <div>Error loading calendar</div>;
  }

  const orgId = (membership as any).organization_id as string;

  // Load beds with their rooms
  const { data: beds } = await supabase
    .from("beds")
    .select(
      `
      id, name, position,
      rooms(id, name,
        room_types(id, name, type)
      )
    `
    )
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("position");

  // Load reservations for the next 60 days
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 60);

  const { data: reservations } = await supabase
    .from("reservation_items")
    .select(
      `
      id, bed_id, check_in, check_out, price_per_night,
      reservations(
        id, reservation_number, status,
        guests(first_name, last_name)
      )
    `
    )
    .eq("organization_id", orgId)
    .gte("check_out", today.toISOString().split("T")[0])
    .lte("check_in", end.toISOString().split("T")[0]);

  return (
    <CalendarClient
      beds={beds ?? []}
      reservations={reservations ?? []}
      orgId={orgId ?? ""}
    />
  );
}
