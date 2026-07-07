"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Hotel, Loader2, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");
  const tBrand = useTranslations("auth.brand");
  const router = useRouter();
  const supabase = createBrowserClient();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // "verifying" while exchanging the ?code= link, "invalid" if it fails.
  const [linkStatus, setLinkStatus] = useState<"verifying" | "ready" | "invalid">("verifying");

  // Establish the recovery session from the link before showing the form.
  // PKCE links arrive as ?code=; older links set a session via the URL hash.
  useEffect(() => {
    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setLinkStatus(error ? "invalid" : "ready");
        return;
      }
      // No code — rely on an existing (hash-based or already-set) session.
      const { data: { session } } = await supabase.auth.getSession();
      setLinkStatus(session ? "ready" : "invalid");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error(t("toastPasswordMin")); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
    setTimeout(() => router.push("/"), 2000); // root resolves to /{slug}/dashboard
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-md w-full p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-white">
            <Hotel className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{tBrand("name")}</h2>
            <p className="text-xs text-muted-foreground">{tBrand("taglineShort")}</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-1">{t("title")}</h3>
        <p className="text-sm text-muted-foreground mb-6">{t("subtitle")}</p>

        {linkStatus === "verifying" ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> {t("verifyingLink")}
          </div>
        ) : linkStatus === "invalid" ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {t("linkInvalid")}
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {t("backToLogin")}
            </button>
          </div>
        ) : done ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
            {t("updatedRedirecting")}
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("newPasswordLabel")}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  className="w-full px-3 py-2 pr-10 border border-border rounded-lg text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? t("updating") : t("updatePassword")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
