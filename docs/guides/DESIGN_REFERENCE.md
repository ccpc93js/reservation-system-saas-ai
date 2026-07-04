# Design Reference — HostMagSmart PMS

Paste this into a Claude Artifacts conversation when designing a new UI/visual style for this app.

## What this app is

A multi-tenant hostel/hotel Property Management System (PMS). Each tenant (a hostel/property) has its own subdomain-style slug (`/{locale}/{slug}/...`), own branding (logo, accent color), and own staff (owner/manager/staff roles). Staff manage reservations, guests, rooms/beds, housekeeping, and channel-manager (OTA) sync; guests get a separate, unauthenticated self-check-in portal.

## Tech constraints (mockups should stay compatible with these)

- **Next.js 15 (App Router) + TypeScript**
- **Tailwind CSS** utility classes — no CSS-in-JS
- **Radix UI** primitives for interactive components (Dialog, DropdownMenu, etc.) — reuse these patterns rather than inventing new interaction models
- **lucide-react** icon set
- **next-intl** — every string must be translatable; avoid designs that bake fixed-width text into layout (button labels, table headers) since translated strings vary a lot in length
- **Arabic (RTL)** is one of the 11 supported languages — layouts must survive `dir="rtl"` mirroring (icon direction, padding/margin logical properties, text alignment)

## Current design tokens (`src/app/globals.css`)

HSL CSS variables, referenced everywhere as `hsl(var(--x))`. Light mode:

```css
--bg: 250 20% 98%;             /* #F8F7FC — cool off-white page background */
--surface: 0 0% 100%;          /* #FFFFFF — cards, panels */
--border: 250 15% 90%;         /* #E4E2F0 — dividers */
--text: 250 15% 10%;           /* #161520 — near-black, purple-tinted */
--text-muted: 250 8% 45%;      /* #6E6B80 */

--accent: 262 83% 54%;         /* #7C3AED — indigo-purple, default brand accent */
--accent-fg: 0 0% 100%;        /* white text on accent */
--accent-hover: 262 83% 46%;

--success: 142 72% 29%;        /* #147A45 */
--warning: 38 92% 40%;         /* #C97D0A */
--danger: 0 72% 44%;           /* #C02B2B */

--radius: 0.5rem;
--sidebar-width: 240px;
```

Dark mode (`.dark` class) swaps to a warm dark palette (`#161614` bg, `#1E1E1B` surface) with a lighter accent purple (`#A78BFA`) for contrast — not a simple invert.

Base font: system stack (`-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif`), 14px base, 1.5 line-height.

**Per-tenant theming already exists**: each hostel picks their own accent color from 9 presets in Settings → Property, stored as `organizations.theme_color`, plus their own logo:

```
purple #7c3aed (default) · indigo #4f46e5 · blue #2563eb · teal #0f766e
green #16a34a · rose #e11d48 · orange #ea580c · slate #334155 · black #09090b
```

**Decide upfront**: does the redesign keep this per-tenant accent-swap system, or replace it with something else? If kept, every screen's accent usage needs to work across all 9 (plus dark mode × 9 = 18 combinations).

## Full screen inventory (redesign should cover all of these for consistency)

**Staff-facing** (behind login, org-scoped at `/{locale}/{slug}/...`):
- Dashboard (today's arrivals, occupancy stats, quick actions)
- Tape Calendar (the core booking grid — beds × 60-day horizon, drag/click to book)
- Reservations (list, search, filters, status dropdown)
- Pending Check-Ins (guest self-check-in review queue, ID photo verification)
- Guest Book / Check-in History (Serbian police-registration compliance record, CSV export)
- Analytics (booking trends, revenue trends, top rooms, occupancy — charts via Recharts)
- Channel Manager (OTA connections: Booking.com/Airbnb/VRBO/etc., sync status)
- Guest Directory (guest CRUD, document upload/OCR, duplicate-merge flow)
- Room Inventory (room types → rooms → beds, 3-level CRUD)
- Housekeeping (per-bed status board: Clean/Dirty/Inspected/Out-of-Order)
- Settings: Property (branding/logo/accent/operations), Team (roles/invites), Billing (plan/Stripe)

**Guest-facing** (no login, token-based):
- Self check-in wizard (4 steps: details → ID photos → review → submit)
- Check-in success/confirmation page

**Shared chrome**: left sidebar nav (collapsible), top header (page title, global search, language switcher, notification bell, "New Booking" CTA, account menu).

## Notes on information density

Several screens are data-dense by necessity (the tape chart renders N beds × 60 days; the Guest Book table has 14+ columns for compliance data). A redesign needs a strategy for dense tabular/grid data, not just card-based marketing-site aesthetics.

## Reference screenshots available

The current session has screenshots of: Housekeeping board, Analytics page, Guest Book/Check-in History, Pending Check-Ins, and the Tape Calendar — ask if you want these attached to the Artifacts conversation for grounding.
