"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Building2, Loader2 } from "lucide-react";

export default function DemoPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [status, setStatus] = useState("Preparing demo environment…");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function startDemo() {
      try {
        // 1. Prepare demo org + user (idempotent — creates if not exists)
        setStatus("Preparing demo environment…");
        const prepRes = await fetch("/api/demo/prepare", { method: "POST" });
        const prepData = await prepRes.json();
        if (!prepRes.ok) throw new Error(prepData.error);

        if (cancelled) return;

        // 2. Reset data — fresh slate for every new session
        setStatus("Resetting demo data…");
        const resetRes = await fetch("/api/demo/reset", { method: "POST" });
        if (!resetRes.ok) {
          const resetData = await resetRes.json();
          throw new Error(resetData.error);
        }

        if (cancelled) return;

        // 3. Sign in as demo user
        setStatus("Signing you in…");
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: prepData.email,
          password: prepData.password,
        });
        if (signInErr) throw signInErr;

        if (cancelled) return;

        // 4. Clear welcome modal flag so it shows on every new session
        localStorage.removeItem("demo_welcome_dismissed");

        // 5. Redirect to demo dashboard
        setStatus("Loading your demo…");
        router.push(`/${prepData.slug}/dashboard`);
        router.refresh();
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to start demo");
      }
    }

    startDemo();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #ede9fe 100%)" }}>
      <div className="text-center space-y-6">
        {error ? (
          <>
            <p className="text-red-500 font-medium">{error}</p>
            <a href="/" className="text-sm text-purple-600 hover:underline">← Back to home</a>
          </>
        ) : (
          <>
            <div className="relative inline-flex items-center justify-center w-20 h-20">
              <div className="absolute inset-0 rounded-2xl animate-ping opacity-20"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }} />
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #6d28d9, #a855f7)", boxShadow: "0 8px 32px rgba(139,92,246,0.4)" }}>
                <Building2 className="w-10 h-10 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Launching demo</h2>
              <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {status}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
