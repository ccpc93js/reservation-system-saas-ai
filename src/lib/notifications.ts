import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

export type NotificationType =
  | "checkin_submitted"
  | "reservation_created"
  | "reservation_cancelled"
  | "duplicate_guest"
  | "channel_sync_failed";

export async function notifyOrg(
  organizationId: string,
  type: NotificationType,
  data: Record<string, unknown>,
  link?: string,
  excludeUserId?: string
): Promise<void> {
  try {
    const service = await createServiceClient();
    const { data: members, error: membersError } = await service
      .from("memberships")
      .select("user_id")
      .eq("organization_id", organizationId);

    if (membersError || !members?.length) {
      if (membersError) console.error("notifyOrg: failed to load members", membersError);
      return;
    }

    const rows = members
      .filter((m) => m.user_id !== excludeUserId)
      .map((m) => ({
        organization_id: organizationId,
        user_id: m.user_id,
        type,
        data: data as Json,
        link: link ?? null,
      }));

    if (rows.length === 0) return;

    const { error } = await service.from("notifications").insert(rows);
    if (error) console.error("notifyOrg: insert failed", error);
  } catch (err) {
    console.error("notifyOrg: unexpected error", err);
  }
}
