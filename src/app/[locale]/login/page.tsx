"use client";

import { useState } from "react";
import { useRouter as useNextRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Hotel, Loader2, ArrowLeft, Mail, Eye, EyeOff } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tBrand = useTranslations("auth.brand");
  const router = useRouter(); // locale-aware, for /{slug}/dashboard
  const nextRouter = useNextRouter(); // plain, for the arbitrary ?redirect= param and /onboarding (not yet migrated)
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const supabase = createBrowserClient();

  const pendingPlan = searchParams.get("plan") ?? "";
  const initialMode = (searchParams.get("mode") === "signup" ? "signup" : "signin") as Mode;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [signupPendingConfirm, setSignupPendingConfirm] = useState(false);

  const inputClass =
    "w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white placeholder:text-slate-400";

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }

    if (redirect !== "/dashboard") {
      nextRouter.push(redirect);
      nextRouter.refresh();
      return;
    }

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, organizations(slug)")
      .eq("user_id", authData.user.id)
      .single();

    const slug = (membership as any)?.organizations?.slug;
    if (slug) {
      router.push(`/${slug}/dashboard`);
      router.refresh();
    } else {
      nextRouter.push("/onboarding");
      nextRouter.refresh();
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error(t("toastPasswordMin")); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${pendingPlan ? `?plan=${pendingPlan}` : ""}`,
        data: pendingPlan ? { pending_plan: pendingPlan } : {},
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }

    if (data.session) {
      toast.success(t("toastAccountCreated"));
      nextRouter.push(pendingPlan ? `/onboarding?plan=${pendingPlan}` : "/onboarding");
      nextRouter.refresh();
    } else {
      setSignupPendingConfirm(true);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { toast.error(t("toastEnterEmail")); return; }
    setLoading(true);
    // reset-password lives under the current locale prefix now
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname.split("/").slice(0, 2).join("/")}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setForgotSent(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/80 border border-slate-100 overflow-hidden">

          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

          <div className="p-10">

            {/* Branding */}
            <div className="flex items-center gap-4 mb-10">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <Hotel className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{tBrand("name")}</h1>
                <p className="text-xs text-slate-400 font-medium">{tBrand("tagline")}</p>
              </div>
            </div>

            {/* Tabs */}
            {mode !== "forgot" && (
              <div className="flex rounded-xl bg-slate-100 p-1 mb-8">
                <button
                  onClick={() => { setMode("signin"); setSignupPendingConfirm(false); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    mode === "signin"
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t("tabSignIn")}
                </button>
                <button
                  onClick={() => setMode("signup")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    mode === "signup"
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t("tabSignUp")}
                </button>
              </div>
            )}

            {/* ── SIGN IN ── */}
            {mode === "signin" && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">{t("signinTitle")}</h2>
                <p className="text-sm text-slate-500 mb-8">{t("signinSubtitle")}</p>
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{t("emailLabel")}</label>
                    <input type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      className={inputClass} autoComplete="email" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{t("passwordLabel")}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={inputClass + " pr-11"}
                        autoComplete="current-password"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
                      <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      {t("rememberMe")}
                    </label>
                    <button type="button" onClick={() => setMode("forgot")}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline">
                      {t("forgotPassword")}
                    </button>
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 mt-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading ? t("signingIn") : t("signIn")}
                  </button>
                </form>
                <p className="text-sm text-slate-400 text-center mt-6">
                  {t("haveInvite")}{" "}
                  <button onClick={() => setMode("signup")} className="text-indigo-600 font-medium hover:underline">
                    {t("createAnAccount")}
                  </button>
                </p>
              </div>
            )}

            {/* ── SIGN UP ── */}
            {mode === "signup" && (
              <div>
                {signupPendingConfirm ? (
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-8 text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto">
                        <Mail className="w-8 h-8 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-900">{t("checkInbox")}</p>
                        <p className="text-sm text-slate-500 mt-1">{t("confirmationSentTo")}</p>
                        <p className="text-sm font-semibold text-indigo-700 mt-0.5 break-all">{email}</p>
                      </div>
                      <div className="rounded-xl bg-white/80 border border-indigo-100 p-4 text-left space-y-2">
                        {[t("step1"), t("step2"), t("step3"), t("step4")].map((step) => (
                          <p key={step} className="text-xs text-slate-600">{step}</p>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => { setMode("signin"); setSignupPendingConfirm(false); }}
                      className="w-full py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" /> {t("backToSignIn")}
                    </button>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">{t("signupTitle")}</h2>
                    <p className="text-sm text-slate-500 mb-8">{t("signupSubtitle")}</p>
                    <form onSubmit={handleSignUp} className="space-y-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{t("emailLabel")}</label>
                        <input type="email" required value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t("emailPlaceholder")}
                          className={inputClass} autoComplete="email" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{t("passwordLabel")}</label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t("passwordMinPlaceholder")}
                            className={inputClass + " pr-11"}
                            autoComplete="new-password"
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5">{t("passwordMinHint")}</p>
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {loading ? t("creatingAccount") : t("createAccountContinue")}
                      </button>
                      <p className="text-xs text-slate-400 text-center">
                        {t("nextStepHint")}
                      </p>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ── FORGOT PASSWORD ── */}
            {mode === "forgot" && (
              <div>
                <button onClick={() => setMode("signin")}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> {t("backToSignInLink")}
                </button>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">{t("resetTitle")}</h2>
                <p className="text-sm text-slate-500 mb-8">{t("resetSubtitle")}</p>
                {forgotSent ? (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                      <Mail className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="font-semibold text-emerald-900">{t("resetLinkSent")}</p>
                    <p className="text-sm text-emerald-700">{t("checkInboxAt")} <strong>{email}</strong></p>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{t("emailLabel")}</label>
                      <input type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("emailPlaceholder")}
                        className={inputClass} />
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {loading ? t("sending") : t("sendResetLink")}
                    </button>
                  </form>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          {t("footer", { year: new Date().getFullYear() })}
        </p>
      </div>
    </div>
  );
}
