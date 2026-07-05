import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// Per-request memoized so a layout and its page (same render pass) share one
// Supabase client + one auth validation instead of each re-creating/re-fetching.
// React cache() dedupes by call within a single server request.
export const getServerClient = cache(async () => {
  return createServerClient();
});

export const getServerUser = cache(async () => {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
});
