"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Hotel, CalendarDays, Users, Wifi, BarChart3, Shield,
  CheckCircle, ArrowRight, Menu, X, Star, Globe,
  BedDouble, ClipboardCheck, CreditCard
} from "lucide-react";
import { FAQS } from "@/lib/seo-faq";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <Image src="/botanical/logo.png" alt="HostMagSmart" width={32} height={32} className="object-contain" />
            <span className="text-lg font-bold tracking-tight">HostMagSmart</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/demo"
              className="text-sm font-medium text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-background transition-colors">
              Try Demo
            </Link>
            <Link href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-background transition-colors">
              Sign In
            </Link>
            <Link href="/login?mode=signup"
              className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition-all"
              style={{ background: "linear-gradient(135deg, #5f7048, #7f8a58)", boxShadow: "0 4px 14px rgba(95,112,72,0.35)" }}>
              Get Started Free
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-background">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border px-6 py-4 space-y-3 bg-surface">
            <a href="#features" className="block text-sm font-medium text-muted-foreground py-2">Features</a>
            <a href="#how-it-works" className="block text-sm font-medium text-muted-foreground py-2">How it works</a>
            <a href="#pricing" className="block text-sm font-medium text-muted-foreground py-2">Pricing</a>
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/login" className="text-center text-sm font-medium text-muted-foreground py-2 border border-border rounded-lg">Sign In</Link>
              <Link href="/login?mode=signup" className="text-center text-sm font-semibold text-white py-2 rounded-lg"
                style={{ background: "linear-gradient(135deg, #5f7048, #7f8a58)" }}>
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-16 pb-28"
        style={{ backgroundImage: "radial-gradient(55% 45% at 15% 12%, color-mix(in srgb, hsl(var(--accent)) 13%, transparent), transparent 70%), radial-gradient(45% 55% at 92% 22%, rgba(176,125,84,.12), transparent 72%)" }}>

        <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-[1.05fr_.95fr] gap-12 items-center">
          {/* Left — copy */}
          <div>
            <h1 className="font-serif font-semibold tracking-tight leading-[0.98] text-6xl lg:text-7xl mb-6">
              Run your hostel
              <span className="block italic text-accent">with calm.</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-md mb-8 leading-relaxed">
              The all-in-one PMS for independent hostels and boutique hotels.
              Reservations, guests, channels and analytics — one quiet, considered dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link href="/login?mode=signup"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-accent text-accent-fg font-semibold text-base hover:bg-accent-hover transition-all">
                Start for free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/demo"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-surface text-foreground font-semibold text-base border border-border hover:bg-muted transition-all">
                Try demo
              </Link>
            </div>

            {/* Social proof strip */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex" style={{ color: "#c9a24b" }}>
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <span><strong className="text-foreground">4.9/5</strong> from 200+ hostel managers</span>
            </div>
          </div>

          {/* Right — hero art */}
          <div className="relative hidden lg:block">
            <div className="absolute -top-3 -right-3 w-28 h-28 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, color-mix(in srgb, hsl(var(--accent)) 22%, transparent), transparent 70%)" }} />
            <div className="aspect-[4/5] rounded-3xl overflow-hidden border border-border shadow-2xl">
              <Image src="/botanical/room-bedroom.png" alt="Cozy hostel room managed with the HostMagSmart PMS" width={640} height={800} className="w-full h-full object-cover" priority />
            </div>
          </div>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 text-center">

          {/* Dashboard preview */}
          <div className="mt-16 relative mx-auto max-w-5xl">
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-border"
              style={{ boxShadow: "0 32px 80px rgba(95,112,72,0.15), 0 8px 32px rgba(0,0,0,0.1)" }}>
              {/* Mock browser chrome */}
              <div className="bg-muted border-b border-border px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-surface rounded-lg px-3 py-1 text-xs text-muted-foreground text-center">
                    hostmagsmart.com/your-hostel/dashboard
                  </div>
                </div>
              </div>
              {/* Mock dashboard */}
              <div className="bg-background p-6">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Occupancy", value: "87%", color: "#5f7048" },
                    { label: "Arrivals Today", value: "12", color: "#10b981" },
                    { label: "Revenue", value: "€2,840", color: "#f59e0b" },
                    { label: "Avg Stay", value: "3.2 nights", color: "#6366f1" },
                  ].map((card) => (
                    <div key={card.label} className="bg-surface rounded-xl p-4 border border-border shadow-sm">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{card.label}</p>
                      <p className="text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-foreground">Tape Calendar</p>
                    <div className="flex gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">● Confirmed</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">● Pending</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {["Dorm A / Bed 1", "Dorm A / Bed 2", "Private Room / Bed 1"].map((bed, i) => (
                      <div key={bed} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-28 shrink-0">{bed}</span>
                        <div className="flex-1 h-6 bg-background rounded-lg overflow-hidden flex">
                          {i === 0 && <div className="h-full w-3/5 rounded-lg bg-[#B8C4A6] mr-1" />}
                          {i === 1 && <><div className="h-full w-1/4 rounded-lg bg-emerald-200 mr-1" /><div className="h-full w-2/5 rounded-lg bg-[#B8C4A6] ml-2" /></>}
                          {i === 2 && <div className="h-full w-4/5 rounded-lg bg-amber-200" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Everything you need</p>
            <h2 className="text-4xl font-extrabold tracking-tight mb-4">Built for hostel operators</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From the first booking to the final checkout — HostMagSmart covers every touchpoint of your operation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: CalendarDays,
                title: "Tape Calendar",
                desc: "Visual drag-and-drop reservation timeline. See every bed, every night, at a glance.",
                color: "#5f7048",
              },
              {
                icon: Users,
                title: "Guest Management",
                desc: "Digital check-in portal, OCR ID scanning, duplicate detection, and full guest history.",
                color: "#8b5cf6",
              },
              {
                icon: Wifi,
                title: "Channel Manager",
                desc: "Sync with Booking.com, Airbnb, and any OTA via iCal. Auto-import and block availability.",
                color: "#7f8a58",
              },
              {
                icon: BarChart3,
                title: "Analytics",
                desc: "Occupancy trends, revenue charts, booking sources. Make decisions with real data.",
                color: "#5f7048",
              },
              {
                icon: BedDouble,
                title: "Room Inventory",
                desc: "Manage room types, rooms, and individual beds. Define pricing per bed or per room.",
                color: "#4c5b3a",
              },
              {
                icon: ClipboardCheck,
                title: "Self Check-In",
                desc: "Send guests a unique link to pre-fill details, upload ID photos, and complete check-in before arrival.",
                color: "#4c6b4a",
              },
              {
                icon: Globe,
                title: "Multi-Tenant",
                desc: "Each property gets its own branded URL, color scheme, and logo. Perfect for hostel groups.",
                color: "#5f7048",
              },
              {
                icon: Shield,
                title: "Secure & Compliant",
                desc: "Row-level security on every table. Guest data isolated per property. Built for international operations.",
                color: "#8b5cf6",
              },
              {
                icon: CreditCard,
                title: "Payment Tracking",
                desc: "Track paid, unpaid, and partial payments per reservation. Clear financial overview at all times.",
                color: "#7f8a58",
              },
            ].map((feat) => (
              <div key={feat.title}
                className="group p-6 rounded-2xl border border-border hover:border-border hover:shadow-lg hover:shadow-black/5 transition-all bg-surface">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: feat.color + "15" }}>
                  <feat.icon className="w-5 h-5" style={{ color: feat.color }} />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24"
        style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Simple setup</p>
            <h2 className="text-4xl font-extrabold tracking-tight mb-4">Up and running in minutes</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              No training needed. No IT team. Just sign up and start managing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-0.5 bg-border" />

            {[
              {
                step: "01",
                title: "Create your property",
                desc: "Sign up, name your hostel, choose your URL slug and accent color. Takes under 2 minutes.",
                icon: Hotel,
              },
              {
                step: "02",
                title: "Add rooms & beds",
                desc: "Define room types, rooms, and individual beds. Set base prices and bed configuration.",
                icon: BedDouble,
              },
              {
                step: "03",
                title: "Start taking reservations",
                desc: "Create bookings, sync your OTA channels, and send guests a self check-in link.",
                icon: CalendarDays,
              },
            ].map((s) => (
              <div key={s.step} className="relative bg-surface rounded-2xl p-8 border border-border shadow-sm">
                <div className="text-5xl font-black text-[#cfc7b3] mb-4 leading-none">{s.step}</div>
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-accent-fg" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Pricing</p>
            <h2 className="text-4xl font-extrabold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground">Start free. Upgrade when you grow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "Free",
                period: "forever",
                desc: "Perfect for small hostels getting started.",
                features: ["Up to 20 beds", "Reservations & calendar", "Guest management", "1 team member"],
                cta: "Get started",
                highlight: false,
                planKey: "",
              },
              {
                name: "Pro",
                price: "€19",
                period: "/ month",
                desc: "For growing hostels with OTA connections.",
                features: ["Up to 60 beds", "Channel Manager (iCal)", "Self check-in portal", "3 team members", "Analytics & reports", "Custom branding"],
                cta: "Get started",
                highlight: true,
                planKey: "pro",
              },
              {
                name: "Scale",
                price: "€39",
                period: "/ month",
                desc: "For hostel groups and multi-property operators.",
                features: ["Everything in Pro", "Unlimited properties", "Custom branding per property", "Unlimited team members", "API access", "Dedicated support"],
                cta: "Get started",
                highlight: false,
                planKey: "scale",
              },
            ].map((plan) => (
              <div key={plan.name}
                className={`rounded-2xl p-8 border ${plan.highlight
                  ? "border-accent shadow-xl shadow-black/5 relative"
                  : "border-border"}`}>
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="text-xs font-bold text-white px-3 py-1 rounded-full"
                      style={{ background: "linear-gradient(135deg, #5f7048, #7f8a58)" }}>
                      Most Popular
                    </span>
                  </div>
                )}
                <p className="text-sm font-semibold text-muted-foreground mb-1">{plan.name}</p>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground mb-1">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{plan.desc}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                      <CheckCircle className="w-4 h-4 text-accent shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.planKey ? `/login?mode=signup&plan=${plan.planKey}` : "/login?mode=signup"}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${plan.highlight
                    ? "text-white"
                    : "text-foreground border border-border hover:border-accent/40 hover:bg-[color-mix(in_srgb,hsl(var(--accent))_10%,transparent)]"}`}
                  style={plan.highlight ? { background: "linear-gradient(135deg, #5f7048, #7f8a58)" } : {}}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl font-semibold tracking-tight mb-4">Frequently asked questions</h2>
            <p className="text-muted-foreground">Everything about the HostMagSmart hostel PMS.</p>
          </div>
          <div className="space-y-4">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-2xl border border-border bg-surface p-6">
                <h3 className="font-semibold text-foreground mb-2">{f.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="py-20" style={{ background: "linear-gradient(135deg, #5f7048 0%, #4c6b4a 50%, #7f8a58 100%)" }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
            Ready to run your hostel smarter?
          </h2>
          <p className="text-[#cfc7b3] text-lg mb-8 max-w-xl mx-auto">
            Join hundreds of hostel managers who save hours every week with HostMagSmart.
            Free to start. No credit card required.
          </p>
          <Link href="/login?mode=signup"
            className="inline-flex items-center gap-2 bg-surface text-accent font-bold px-8 py-4 rounded-2xl text-base hover:bg-[color-mix(in_srgb,hsl(var(--accent))_10%,transparent)] transition-colors shadow-xl">
            Create your free account <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="text-muted-foreground py-12" style={{ background: "#2A2823" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <Image src="/botanical/logo.png" alt="HostMagSmart" width={28} height={28} className="rounded-md bg-white/90 p-0.5 object-contain" />
              <span className="font-bold text-white">HostMagSmart PMS</span>
            </Link>
            <div className="flex gap-6 text-sm">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <Link href="/login" className="hover:text-white transition-colors">Login</Link>
              <Link href="/login?mode=signup" className="hover:text-white transition-colors">Sign Up</Link>
            </div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} HostMagSmart. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
