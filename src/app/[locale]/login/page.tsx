"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter as useNextRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Mail, Eye, EyeOff } from "lucide-react";
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
    "w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all bg-surface text-foreground placeholder:text-muted-foreground";
  const submitClass =
    "w-full bg-accent hover:bg-accent-hover text-accent-fg font-semibold py-3 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2";

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
    <div className="min-h-screen grid md:grid-cols-2 bg-background">

      {/* ── Art panel (left) ── */}
      <div
        className="relative hidden md:flex flex-col justify-between overflow-hidden p-11 text-[#f2ecdd]"
        style={{
          background:
            "radial-gradient(60% 60% at 25% 20%, color-mix(in srgb, hsl(var(--accent)) 45%, transparent), transparent 65%), radial-gradient(50% 60% at 85% 90%, rgba(201,162,75,.30), transparent 65%), hsl(var(--text))",
        }}
      >
        <a href="/" className="flex items-center gap-3 font-semibold hover:opacity-90 transition-opacity">
          <Image src="/botanical/logo.png" alt="HostMagSmart" width={38} height={38} className="rounded-lg bg-white/90 p-0.5" />
          <span className="text-base">HostMagSmart</span>
        </a>
        <div className="flex-1 flex items-center justify-center py-6">
          <div className="w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            <Image src="/botanical/room-living.png" alt="Cozy room with plants" width={480} height={640} className="w-full h-full object-cover" />
          </div>
        </div>
        <div>
          <p className="font-serif italic text-2xl leading-snug max-w-sm">&ldquo;The quietest front desk software we&apos;ve ever used.&rdquo;</p>
          <p className="mt-3 text-sm text-[#cbc3af]">— Boutique hostel, Belgrade</p>
        </div>
      </div>

      {/* ── Form panel (right) ── */}
      <div className="flex items-center justify-center p-6 sm:p-11">
        <div className="w-full max-w-md">

          {/* Branding */}
          <a href="/" className="flex items-center gap-3 mb-7 hover:opacity-90 transition-opacity">
            <Image src="/botanical/logo.png" alt="HostMagSmart" width={46} height={46} className="object-contain" />
            <div>
              <h1 className="text-lg font-bold text-foreground font-sans-force tracking-tight">{tBrand("name")}</h1>
              <p className="text-xs text-muted-foreground font-medium">{tBrand("tagline")}</p>
            </div>
          </a>

          {/* Tabs */}
          {mode !== "forgot" && (
            <div className="flex gap-1 p-1.5 rounded-xl mb-7" style={{ background: "color-mix(in srgb, hsl(var(--accent)) 8%, transparent)" }}>
              <button
                onClick={() => { setMode("signin"); setSignupPendingConfirm(false); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  mode === "signin" ? "bg-surface shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("tabSignIn")}
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  mode === "signup" ? "bg-surface shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("tabSignUp")}
              </button>
            </div>
          )}

          {/* ── SIGN IN ── */}
          {mode === "signin" && (
            <div>
              <h2 className="font-serif text-4xl font-semibold text-foreground mb-1.5">{t("signinTitle")}</h2>
              <p className="text-sm text-muted-foreground mb-7">{t("signinSubtitle")}</p>
              <form onSubmit={handleSignIn} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{t("emailLabel")}</label>
                  <input type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className={inputClass} autoComplete="email" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{t("passwordLabel")}</label>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" className="rounded border-border" style={{ accentColor: "hsl(var(--accent))" }} />
                    {t("rememberMe")}
                  </label>
                  <button type="button" onClick={() => setMode("forgot")}
                    className="text-sm text-accent hover:opacity-80 font-medium">
                    {t("forgotPassword")}
                  </button>
                </div>
                <button type="submit" disabled={loading} className={submitClass + " mt-1"}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? t("signingIn") : t("signIn")}
                </button>
              </form>
              <p className="text-sm text-muted-foreground text-center mt-6">
                {t("haveInvite")}{" "}
                <button onClick={() => setMode("signup")} className="text-accent font-medium hover:opacity-80">
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
                  <div className="rounded-2xl border border-border p-8 text-center space-y-4" style={{ background: "color-mix(in srgb, hsl(var(--accent)) 8%, transparent)" }}>
                    <div className="w-16 h-16 rounded-2xl bg-surface shadow-md flex items-center justify-center mx-auto">
                      <Mail className="w-8 h-8 text-accent" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground">{t("checkInbox")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("confirmationSentTo")}</p>
                      <p className="text-sm font-semibold text-accent mt-0.5 break-all">{email}</p>
                    </div>
                    <div className="rounded-xl bg-surface/80 border border-border p-4 text-left space-y-2">
                      {[t("step1"), t("step2"), t("step3"), t("step4")].map((step) => (
                        <p key={step} className="text-xs text-muted-foreground">{step}</p>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => { setMode("signin"); setSignupPendingConfirm(false); }}
                    className="w-full py-3 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> {t("backToSignIn")}
                  </button>
                </div>
              ) : (
                <div>
                  <h2 className="font-serif text-4xl font-semibold text-foreground mb-1.5">{t("signupTitle")}</h2>
                  <p className="text-sm text-muted-foreground mb-7">{t("signupSubtitle")}</p>
                  <form onSubmit={handleSignUp} className="space-y-5">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{t("emailLabel")}</label>
                      <input type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("emailPlaceholder")}
                        className={inputClass} autoComplete="email" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{t("passwordLabel")}</label>
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">{t("passwordMinHint")}</p>
                    </div>
                    <button type="submit" disabled={loading} className={submitClass}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {loading ? t("creatingAccount") : t("createAccountContinue")}
                    </button>
                    <p className="text-xs text-muted-foreground text-center">
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
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-7 transition-colors">
                <ArrowLeft className="w-4 h-4" /> {t("backToSignInLink")}
              </button>
              <h2 className="font-serif text-4xl font-semibold text-foreground mb-1.5">{t("resetTitle")}</h2>
              <p className="text-sm text-muted-foreground mb-7">{t("resetSubtitle")}</p>
              {forgotSent ? (
                <div className="rounded-2xl border p-6 text-center space-y-2" style={{ background: "hsl(var(--success-bg))", borderColor: "color-mix(in srgb, hsl(var(--success)) 30%, transparent)" }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: "color-mix(in srgb, hsl(var(--success)) 18%, transparent)" }}>
                    <Mail className="w-6 h-6" style={{ color: "hsl(var(--success))" }} />
                  </div>
                  <p className="font-semibold" style={{ color: "hsl(var(--success))" }}>{t("resetLinkSent")}</p>
                  <p className="text-sm text-muted-foreground">{t("checkInboxAt")} <strong className="text-foreground">{email}</strong></p>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{t("emailLabel")}</label>
                    <input type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      className={inputClass} />
                  </div>
                  <button type="submit" disabled={loading} className={submitClass}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading ? t("sending") : t("sendResetLink")}
                  </button>
                </form>
              )}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-8">
            {t("footer", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </div>
  );
}
