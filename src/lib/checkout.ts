import { sendCheckoutConfirmationEmail, getOrgBranding } from "@/lib/email";
import type { createServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>;

export async function finalizeCheckout(
  supabase: SupabaseServerClient,
  reservationId: string
): Promise<void> {
  // Mark bed(s) dirty for housekeeping — never blocks checkout if this fails
  try {
    const { data: items } = await supabase
      .from("reservation_items")
      .select("bed_id")
      .eq("reservation_id", reservationId);

    if (items?.length) {
      const { error: bedError } = await supabase
        .from("beds")
        .update({
          housekeeping_status: "dirty",
          housekeeping_updated_at: new Date().toISOString(),
          housekeeping_updated_by: null,
        })
        .in("id", items.map((i) => i.bed_id))
        .neq("housekeeping_status", "out_of_order");

      if (bedError) {
        console.error("Failed to mark bed dirty on checkout:", bedError);
      }
    }
  } catch (bedErr) {
    console.error("Failed to mark bed dirty on checkout:", bedErr);
  }

  // Send checkout confirmation email — never blocks checkout if this fails
  try {
    const { data: reservation } = await supabase
      .from("reservations")
      .select("guest_id, check_out, organization_id")
      .eq("id", reservationId)
      .single();

    const guestId = reservation?.guest_id;
    if (guestId) {
      const { data: guest } = await supabase
        .from("guests")
        .select("first_name, last_name, email")
        .eq("id", guestId)
        .single();

      if (guest?.email && reservation) {
        const branding = await getOrgBranding(supabase, (reservation as any).organization_id);
        await sendCheckoutConfirmationEmail(
          guest.email,
          `${guest.first_name} ${guest.last_name}`,
          reservationId.substring(0, 8).toUpperCase(),
          reservation.check_out,
          branding
        ).catch((err) => console.error("Email send failed:", err));
      }
    }
  } catch (emailErr) {
    console.error("Failed to send checkout confirmation email:", emailErr);
  }
}
