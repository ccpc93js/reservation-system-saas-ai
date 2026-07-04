"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, ArrowRight, Loader2, ArrowLeft, Check, X, Link } from "lucide-react";
import { toast } from "sonner";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingPlan = searchParams.get("plan") ?? "";
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [slugError, setSlugError] = useState("");
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    city: "",
    country: "",
    timezone: "UTC",
    currency: "EUR",
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    if (key === "name") {
      setForm((f) => ({ ...f, name: value, slug: slugEdited ? f.slug : slugify(value) }));
    } else if (key === "slug") {
      setForm((f) => ({ ...f, slug: slugify(value) }));
      setSlugEdited(true);
    } else {
      setForm((f) => ({ ...f, [key]: value }));
    }
  };

  // Debounced slug availability check
  useEffect(() => {
    const slug = form.slug;
    if (!slug) { setSlugStatus("idle"); setSlugError(""); return; }
    if (slug.length < 2) { setSlugStatus("invalid"); setSlugError("Too short (min 2 characters)"); return; }
    if (slug.length > 63) { setSlugStatus("invalid"); setSlugError("Too long (max 63 characters)"); return; }

    setSlugStatus("checking");
    if (slugTimer.current) clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/check-slug?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (data.available) {
          setSlugStatus("available");
          setSlugError("");
        } else {
          setSlugStatus("taken");
          setSlugError(data.error || `"${slug}" is already taken`);
        }
      } catch {
        setSlugStatus("idle");
      }
    }, 400);
  }, [form.slug]);

  const slugOk = slugStatus === "available";
  const canProceed = form.name.trim().length >= 2 && slugOk;

  const handleCreate = async () => {
    if (!canProceed) return;
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/create-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, pendingPlan }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.field === "slug") { setStep(1); setSlugStatus("taken"); setSlugError(data.error); }
        throw new Error(data.error);
      }
      setLaunching(true);
      router.push(data.redirectTo ?? "/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create property");
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-border bg-background text-foreground px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent focus:bg-surface transition-all";
  const labelClass = "block text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-widest";

  const slugBorderClass = slugStatus === "taken" || slugStatus === "invalid"
    ? "border-red-300 bg-red-50"
    : slugStatus === "available"
    ? "border-emerald-300 bg-emerald-50"
    : "border-border bg-background";

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #ede9fe 100%)" }}>

      {/* Launch overlay */}
      {launching && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
          style={{ background: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #ede9fe 100%)" }}>
          <div className="relative flex items-center justify-center w-20 h-20">
            <div className="absolute inset-0 rounded-2xl animate-ping opacity-20"
              style={{ background: "linear-gradient(135deg, #5f7048, #7f8a58)" }} />
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #4c5b3a 0%, #7f8a58 100%)", boxShadow: "0 8px 32px rgba(95,112,72,0.4)" }}>
              <Building2 className="w-10 h-10 text-white" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-foreground">Launching your dashboard</h2>
            <p className="text-sm text-muted-foreground">Setting up <strong className="text-foreground">{form.name}</strong>…</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full"
                style={{ background: "#7f8a58", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-8px);opacity:1}}`}</style>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(95,112,72,0.08) 0%, transparent 70%)" }} />

      <div className="relative w-full max-w-md">
        <div className="rounded-3xl overflow-hidden"
          style={{ background: "#ffffff", border: "1px solid rgba(95,112,72,0.2)", boxShadow: "0 0 60px rgba(95,112,72,0.1), 0 24px 48px rgba(109,40,217,0.08)" }}>

          <div style={{ height: "3px", background: "linear-gradient(90deg, #5f7048, #7f8a58, #5f7048)" }} />

          <div className="p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
                style={{ background: "linear-gradient(135deg, #4c5b3a 0%, #7f8a58 100%)", boxShadow: "0 8px 32px rgba(95,112,72,0.35)" }}>
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Set up your property</h1>
              <p className="text-sm text-muted-foreground mt-2">Get your hostel configured in under a minute.</p>
            </div>

            {/* Progress */}
            <div className="flex gap-2 mb-8">
              {[1, 2].map((s) => (
                <div key={s} className="h-1 flex-1 rounded-full transition-all duration-500"
                  style={{ background: s <= step ? "linear-gradient(90deg, #5f7048, #7f8a58)" : "#f0f0f0" }} />
              ))}
            </div>

            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">
              Step {step} of 2 — {step === 1 ? "Property Info" : "Preferences"}
            </p>

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Property Name *</label>
                  <input
                    value={form.name}
                    onChange={set("name")}
                    placeholder="e.g. Hostel Beograd"
                    className={inputClass}
                    autoFocus
                  />
                </div>

                {/* Slug field — only show once name has content */}
                {form.name.trim().length >= 2 && (
                  <div>
                    <label className={labelClass}>
                      Your URL
                      <span className="ml-2 text-[9px] normal-case tracking-normal font-normal text-muted-foreground">auto-generated · editable</span>
                    </label>
                    <div className={`flex items-center rounded-xl border overflow-hidden transition-all ${slugBorderClass}`}>
                      <div className="flex items-center gap-1 pl-3 shrink-0">
                        <Link className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground pr-1 whitespace-nowrap">hostmagsmart.com/</span>
                      </div>
                      <input
                        value={form.slug}
                        onChange={set("slug")}
                        placeholder="my-hostel"
                        className="flex-1 py-3 pr-3 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none font-mono min-w-0"
                      />
                      <div className="pr-3 shrink-0">
                        {slugStatus === "checking" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                        {slugStatus === "available" && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                        {(slugStatus === "taken" || slugStatus === "invalid") && <X className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </div>
                    {slugError && <p className="text-[11px] text-red-500 mt-1">{slugError}</p>}
                    {slugStatus === "available" && <p className="text-[11px] text-emerald-600 mt-1">✓ Available</p>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>City</label>
                    <input value={form.city} onChange={set("city")} placeholder="Belgrade" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Country</label>
                    <input value={form.country} onChange={set("country")} placeholder="Serbia" className={inputClass} />
                  </div>
                </div>

                <button
                  onClick={() => canProceed && setStep(2)}
                  disabled={!canProceed}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all mt-2 disabled:opacity-30"
                  style={{ background: "linear-gradient(135deg, #5f7048 0%, #7f8a58 100%)", boxShadow: "0 4px 20px rgba(95,112,72,0.35)" }}
                >
                  {slugStatus === "checking"
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</>
                    : <>Continue <ArrowRight className="w-4 h-4" /></>
                  }
                </button>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div className="space-y-4">
                {/* URL confirm */}
                <div className="rounded-xl border border-border px-4 py-3" style={{ background: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)" }}>
                  <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">Your dashboard URL</p>
                  <p className="text-sm font-mono text-foreground break-all">
                    hostmagsmart.com/<span className="font-bold text-accent">{form.slug}</span>/dashboard
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Currency</label>
                  <select value={form.currency} onChange={set("currency")} className={inputClass}>
                    {["EUR", "USD", "GBP", "RSD", "HRK", "CHF"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Timezone</label>
                  <select value={form.timezone} onChange={set("timezone")} className={inputClass}>
                    {["UTC", "Europe/Belgrade", "Europe/London", "Europe/Paris", "Europe/Berlin",
                      "America/New_York", "America/Los_Angeles", "Asia/Tokyo"].map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 mt-2">
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-colors"
                    style={{ border: "1px solid #e5e7eb", background: "#f9fafb" }}>
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={handleCreate} disabled={saving}
                    className="flex-1 py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #5f7048 0%, #7f8a58 100%)", boxShadow: "0 4px 20px rgba(95,112,72,0.35)" }}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {saving ? "Creating..." : "Launch Property"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          HostMagSmart PMS · Secure property management
        </p>
      </div>
    </div>
  );
}
