// ============================================================
// Font setup — src/app/layout.tsx (or your root layout)
// Cormorant Garamond = display/serif, Hanken Grotesk = body/sans
// ============================================================

import { Cormorant_Garamond, Hanken_Grotesk } from "next/font/google";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

// Apply BOTH variables on <html> (or <body>):
//   <html className={`${serif.variable} ${sans.variable}`}>
// Body default stays sans; serif is opt-in via `font-serif`.


// ============================================================
// tailwind.config.ts  — diff (merge into theme.extend)
// ============================================================
/*
  theme: {
    extend: {
      fontFamily: {
        sans:  ["var(--font-hanken)", "system-ui", "sans-serif"],
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
      },
      // colors already map to hsl(var(--x)) — no change needed if you
      // use the existing token mapping. If not, add:
      colors: {
        bg:        "hsl(var(--bg))",
        surface:   "hsl(var(--surface))",
        border:    "hsl(var(--border))",
        text:      { DEFAULT: "hsl(var(--text))", muted: "hsl(var(--text-muted))" },
        accent:    { DEFAULT: "hsl(var(--accent))", fg: "hsl(var(--accent-fg))", hover: "hsl(var(--accent-hover))" },
      },
      borderRadius: { DEFAULT: "var(--radius)" },
    },
  }
*/


// ============================================================
// Usage cheatsheet — where to apply font-serif
// ============================================================
// font-serif  → page H1s ("Today's Overview", section titles),
//               big stat numbers (10%, $324, 7.3), plan prices,
//               landing hero headline, auth headings.
// font-sans   → everything else (default). Do NOT serif table
//               cells, labels, buttons, or dense data.
//
// Card:        bg-surface border border-border rounded-xl
// Soft accent: bg-[color-mix(in_srgb,hsl(var(--accent))_13%,transparent)] text-accent
// Status pills (muted):
//   Checked In  bg-[#DDE7F0] text-[#3A5F82]
//   Checked Out bg-[#E8E2D4] text-[#6F6857]
//   Pending     bg-[#F0E6CD] text-[#8A6A16]
//   Cancelled   bg-[#EEDCD5] text-[#9C4A37]
//   Confirmed   bg-[#E0EADB] text-[#4A6740]
