"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

// Country the property operates in (from onboarding). Used to gate
// country-specific features (e.g. Serbia's JMBG / police-registration fields).
export function useOrgCountry(orgId: string | undefined | null): string | null {
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => {
    if (!orgId) return;
    let active = true;
    const supabase = createBrowserClient();
    (supabase as any)
      .from("organizations")
      .select("country")
      .eq("id", orgId)
      .single()
      .then(({ data }: { data: { country?: string | null } | null }) => {
        if (active) setCountry(data?.country ?? null);
      });
    return () => { active = false; };
  }, [orgId]);
  return country;
}

export const isSerbia = (country: string | null | undefined) => {
  const c = (country || "").trim().toLowerCase();
  return c === "serbia" || c === "republic of serbia" || c === "rs" || c === "srb";
};
