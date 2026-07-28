import { createServerClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import NotificationsClient from "@/components/notifications/notifications-client";

export default async function NotificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations("notifications");

  if (!user) return <div>{t("empty")}</div>;

  return <NotificationsClient userId={user.id} orgSlug={slug} />;
}
