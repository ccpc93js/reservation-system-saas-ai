"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Hotel, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");
  const tBrand = useTranslations("auth.brand");
  const router = useRouter();
  const supabase = createBrowserClient();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Hotel className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{tBrand("name")}</h2>
            <p className="text-xs text-slate-500">{tBrand("taglineShort")}</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-900 mb-1">{t("title")}</h3>
        <p className="text-sm text-slate-500 mb-6">{t("subtitle")}</p>

        {done ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
            {t("updatedRedirecting")}
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("newPasswordLabel")}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
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
