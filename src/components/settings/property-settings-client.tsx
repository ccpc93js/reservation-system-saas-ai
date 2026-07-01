"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Globe, Clock, Save, Palette, Upload, X, ImageIcon, ChevronDown } from "lucide-react";
import { Country, City } from "country-state-city";
import { createBrowserClient } from "@/lib/supabase/client";
import LogoCropModal from "./logo-crop-modal";

const ALL_COUNTRIES = Country.getAllCountries();

const CURRENCIES = ["EUR", "USD", "GBP", "RSD", "HRK", "CHF", "CZK", "PLN", "HUF"];
const TIMEZONES = [
  "UTC", "Europe/Belgrade", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Europe/Rome", "Europe/Madrid", "Europe/Amsterdam", "America/New_York",
  "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Tokyo",
  "Asia/Singapore", "Australia/Sydney",
];

const PRESET_COLORS = [
  { label: "Purple", value: "#7c3aed" },
  { label: "Indigo", value: "#4f46e5" },
  { label: "Blue", value: "#2563eb" },
  { label: "Teal", value: "#0f766e" },
  { label: "Green", value: "#16a34a" },
  { label: "Rose", value: "#e11d48" },
  { label: "Orange", value: "#ea580c" },
  { label: "Slate", value: "#334155" },
  { label: "Black", value: "#09090b" },
];

interface Props {
  org: Record<string, any>;
  userRole: string;
}

export default function PropertySettingsClient({ org, userRole }: Props) {
  const isAdmin = ["owner", "manager", "admin"].includes(userRole);
  const isDemo = typeof window !== "undefined" && window.location.pathname.startsWith("/demo-hostel");
  const supabase = createBrowserClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: org.name ?? "",
    email: org.email ?? "",
    phone: org.phone ?? "",
    address: org.address ?? "",
    city: org.city ?? "",
    country: org.country ?? "",
    website: org.website ?? "",
    description: org.description ?? "",
    timezone: org.timezone ?? "UTC",
    currency: org.currency ?? "EUR",
    check_in_time: org.check_in_time ?? "14:00",
    check_out_time: org.check_out_time ?? "11:00",
    theme_color: org.theme_color ?? "#7c3aed",
    logo_url: org.logo_url ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryRef = useRef<HTMLDivElement>(null);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const cityRef = useRef<HTMLDivElement>(null);

  const selectedCountry = ALL_COUNTRIES.find((c) => c.name === form.country);
  const cities = selectedCountry ? City.getCitiesOfCountry(selectedCountry.isoCode) ?? [] : [];
  const filteredCountries = ALL_COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );
  const filteredCities = cities.filter((c) =>
    c.name.toLowerCase().includes(citySearch.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setShowCountryDropdown(false);
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setShowCityDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Step 1: file selected → open crop modal
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB before crop)"); return; }
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    e.target.value = ""; // reset so same file can be re-selected
  };

  // Step 2: crop applied → upload blob
  const handleCroppedBlob = async (blob: Blob) => {
    setCropSrc(null);
    setUploading(true);
    try {
      const path = `${org.id}/logo.png?t=${Date.now()}`;
      const { error } = await supabase.storage.from("org-assets").upload(path, blob, {
        upsert: true,
        contentType: "image/png",
      });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from("org-assets").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: publicUrl }));

      await fetch("/api/settings/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: publicUrl }),
      });
      toast.success("Logo uploaded");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Apply theme color live
      document.documentElement.style.setProperty("--accent", hexToHsl(form.theme_color));
      toast.success("Settings saved");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50";

  return (
    <>
    {cropSrc && (
      <LogoCropModal
        src={cropSrc}
        onCrop={handleCroppedBlob}
        onCancel={() => { setCropSrc(null); URL.revokeObjectURL(cropSrc); }}
      />
    )}
    {/* -m-6 cancels main's p-6 so sticky top-0 reaches the scroll container edge */}
    <div className=" flex flex-col">
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="max-w-2xl p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "hsl(var(--text))" }}>Property Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your property info and branding</p>
          </div>
          {isAdmin && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>

    <div className="max-w-2xl px-6 py-6 space-y-8">

      {/* ── BRANDING ── */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Branding</h2>
        </div>

        {/* Logo upload */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Property Logo</label>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className="w-16 h-16 rounded-sm border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              {isDemo ? (
                <p className="text-xs text-muted-foreground">
                  Logo upload disabled in demo.{" "}
                  <a href="/signup" className="text-primary hover:underline font-medium">Create a free account</a> to upload.
                </p>
              ) : (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={!isAdmin} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={!isAdmin || uploading}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? "Uploading..." : "Upload Logo"}
                  </button>
                </>
              )}
              {form.logo_url && isAdmin && (
                <button
                  onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
              <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP or SVG · max 2MB · Shown in sidebar</p>
            </div>
          </div>
        </div>

        {/* Theme color */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-3">Accent Color</label>
          <div className="flex items-center gap-3 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => isAdmin && setForm((f) => ({ ...f, theme_color: c.value }))}
                title={c.label}
                disabled={!isAdmin}
                className="w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 disabled:hover:scale-100"
                style={{
                  backgroundColor: c.value,
                  borderColor: form.theme_color === c.value ? c.value : "transparent",
                  boxShadow: form.theme_color === c.value ? `0 0 0 3px ${c.value}33` : "none",
                }}
              />
            ))}
            {/* Custom color input */}
            <div className="relative">
              <input
                type="color"
                value={form.theme_color}
                onChange={(e) => isAdmin && setForm((f) => ({ ...f, theme_color: e.target.value }))}
                disabled={!isAdmin}
                className="w-8 h-8 rounded-lg cursor-pointer border border-border disabled:opacity-50"
                title="Custom color"
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground">{form.theme_color}</span>
          </div>
          {/* Live preview */}
          <div className="mt-3 flex items-center gap-3">
            <div className="h-8 px-4 rounded-lg text-white text-xs font-medium flex items-center" style={{ backgroundColor: form.theme_color }}>
              Button preview
            </div>
            <div className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: form.theme_color + "20", color: form.theme_color }}>
              Badge preview
            </div>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: form.theme_color }} />
          </div>
        </div>
      </section>

      {/* ── BASIC INFO ── */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Basic Information</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Property Name</label>
            <input value={form.name} onChange={set("name")} disabled={!isAdmin} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input type="email" value={form.email} onChange={set("email")} disabled={!isAdmin} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
            <input value={form.phone} onChange={set("phone")} disabled={!isAdmin} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
            <input value={form.address} onChange={set("address")} disabled={!isAdmin} className={inputClass} />
          </div>
          <div className="relative" ref={cityRef}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">City</label>
            <button
              type="button"
              onClick={() => isAdmin && selectedCountry && setShowCityDropdown((v) => !v)}
              disabled={!isAdmin || !selectedCountry}
              title={!selectedCountry ? "Select a country first" : undefined}
              className={inputClass + " text-left flex items-center justify-between"}
            >
              <span className={form.city ? "" : "text-muted-foreground"}>
                {form.city || (selectedCountry ? "Select city..." : "Select a country first")}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
            {showCityDropdown && selectedCountry && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
                <input
                  type="text"
                  autoFocus
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="Search city..."
                  className="w-full px-3 py-2 text-sm border-b border-border bg-background focus:outline-none"
                />
                <div className="max-h-48 overflow-y-auto">
                  {filteredCities.length > 0 ? (
                    filteredCities.map((c) => (
                      <button
                        key={`${c.name}-${c.latitude}-${c.longitude}`}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, city: c.name }));
                          setShowCityDropdown(false);
                          setCitySearch("");
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${form.city === c.name ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}
                      >
                        {c.name}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-sm text-center text-muted-foreground">No cities found</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="relative" ref={countryRef}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Country</label>
            <button
              type="button"
              onClick={() => isAdmin && setShowCountryDropdown((v) => !v)}
              disabled={!isAdmin}
              className={inputClass + " text-left flex items-center justify-between"}
            >
              <span className={form.country ? "" : "text-muted-foreground"}>
                {form.country || "Select country..."}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
            {showCountryDropdown && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
                <input
                  type="text"
                  autoFocus
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search country..."
                  className="w-full px-3 py-2 text-sm border-b border-border bg-background focus:outline-none"
                />
                <div className="max-h-48 overflow-y-auto">
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map((c) => (
                      <button
                        key={c.isoCode}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, country: c.name, city: f.country === c.name ? f.city : "" }));
                          setShowCountryDropdown(false);
                          setCountrySearch("");
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${form.country === c.name ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}
                      >
                        {c.name}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-sm text-center text-muted-foreground">No countries found</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea value={form.description} onChange={set("description")} disabled={!isAdmin} rows={3}
              className={inputClass + " resize-none"} />
          </div>
        </div>
      </section>

      {/* ── ONLINE ── */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Online Presence</h2>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Website</label>
          <input type="url" value={form.website} onChange={set("website")} disabled={!isAdmin}
            placeholder="https://yourhostel.com" className={inputClass} />
        </div>
      </section>

      {/* ── OPERATIONS ── */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Operations</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Default Check-In Time</label>
            <input type="time" value={form.check_in_time} onChange={set("check_in_time")} disabled={!isAdmin} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Default Check-Out Time</label>
            <input type="time" value={form.check_out_time} onChange={set("check_out_time")} disabled={!isAdmin} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Timezone</label>
            <select value={form.timezone} onChange={set("timezone")} disabled={!isAdmin} className={inputClass}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
            <select value={form.currency} onChange={set("currency")} disabled={!isAdmin} className={inputClass}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </section>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground text-center">Only admins can edit property settings.</p>
      )}
    </div>
    </div>
    </>
  );
}

// Convert hex color to HSL string for CSS variables
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
