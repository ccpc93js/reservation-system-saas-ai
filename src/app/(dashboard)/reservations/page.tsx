import { createServerClient } from "@/lib/supabase/server";
import ReservationsListClient from "@/components/reservations/reservations-list-client";

export default async function ReservationsPage() {
  const supabase = await createServerClient();

  // Get org context
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("organization_id")
    .single();

  if (error || !membership) {
    return <div>Error loading reservations</div>;
  }

  const orgId = (membership as any).organization_id as string;

  // Load initial reservations (first page, 25 per page)
  const { data: reservations } = await supabase
    .from("reservations")
    .select(
      `
      id, reservation_number, check_in, check_out, status, channel,
      total_amount, paid_amount, created_at,
      guests(first_name, last_name),
      reservation_items(bed_id, beds(id, name, rooms(id, name)))
    `
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(25);

  // Get total count
  const { count: totalReservations } = await supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  return (
    <ReservationsListClient
      initialReservations={reservations ?? []}
      totalReservations={totalReservations ?? 0}
      orgId={orgId}
    />
  );
}
