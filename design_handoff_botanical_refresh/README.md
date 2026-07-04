# Handoff: HostMagSmart — Botanical Refresh

## Overview
A modern, artistic re-skin of the HostMagSmart PMS. Muted-botanical palette
(moss green, cream, clay, soft gold), an editorial serif-display + clean-sans
type pairing, and warm "plants in a room" imagery on the landing + login only.
The app screens stay image-free and dense — the mood carries through palette
and typography, not photos.

## About the design files
`HostMagSmart Refresh.dc.html` is a **design reference built in HTML** — a
prototype showing intended look and behavior, NOT production code to copy. The
task is to **recreate these designs inside the existing Next.js 15 + Tailwind +
Radix + lucide-react codebase**, using its established components and patterns.
Do not ship the HTML.

## Fidelity
**High-fidelity.** Final colors, type, spacing, and layout. Recreate pixel-close
using the codebase's existing libraries. Every screen mirrors a real route under
`src/app/[locale]/[slug]/…`, plus `/onboarding`, `/invite`, and the guest portal.

## How to apply (fastest path)
1. **Tokens** — replace the light + `.dark` variable blocks in
   `src/app/globals.css` with `globals.botanical.css`. Because the whole app
   reads `hsl(var(--x))`, this alone re-skins every screen.
2. **Fonts** — wire Cormorant Garamond (serif) + Hanken Grotesk (sans) per
   `fonts-and-tailwind.ts`; add the `fontFamily` keys to `tailwind.config.ts`.
   Apply `font-serif` to page headings + big numbers only.
3. **Accents** — keep the 9-preset `organizations.theme_color` system; swap the
   hex values for the artistic set listed in `globals.botanical.css`. Default
   moves from purple → moss. All accent washes use
   `color-mix(in srgb, hsl(var(--accent)) N%, …)`.
4. **Components** — no interaction models changed. Restyle only: card =
   `bg-surface border border-border rounded-xl`; status pills use the muted
   colors in the cheatsheet. Reuse your Radix Dialog/Dropdown as-is.
5. **Imagery** — landing + login only. Put the user's room photos in `public/`;
   accent washes are pure CSS `radial-gradient`s (no assets).

## Design tokens
- Paper `#F3EEE2` · Surface `#FBF8F1` · Border `#E7DFCE`
- Text `#2A2823` · Muted `#7C776B`
- Accent default (moss) `#5F7048`, hover `#4C5B3A`
- 9 tenant accents: moss `#5F7048`, sage `#7F8A58`, fern `#4C6B4A`,
  teal `#3F7168`, ocean `#3D6A86`, clay `#B07D54`, terracotta `#B0604A`,
  plum `#7A5570`, ink `#3A3D34`
- Status: Confirmed `#E0EADB`/`#4A6740` · Pending `#F0E6CD`/`#8A6A16` ·
  Checked-In `#DDE7F0`/`#3A5F82` · Checked-Out `#E8E2D4`/`#6F6857` ·
  Cancelled `#EEDCD5`/`#9C4A37`
- Radius 12px · Sidebar 248px
- Type: display = Cormorant Garamond 600; body = Hanken Grotesk 400–600
- Heading sizes: page H1 ~32px, hero ~74px, stat numbers ~42px (all serif)

## Screens (all in the .dc.html, switch via the top bar + sidebar)
Landing, Login (split w/ art panel), Dashboard, Tape Calendar, Reservations,
Pending Check-Ins, Guest Book (14-col compliance table), Analytics, Channel
Manager, Guest Directory, Room Inventory (3-level), Housekeeping, Settings
(Property / Team / Billing), Guest self check-in, Onboarding, Invite.
Copy, columns, and statuses were lifted from `messages/en.json`.

## Interactions
Sidebar nav switches sections; top meta bar jumps between Landing / Login / App
/ Guest check-in / Onboarding / Invite. The "Tenant accent" swatches live-retint
every screen (proves the design works across all 9 presets). RTL: use logical
properties (ps-/pe-/ms-/me-) — the layout must survive `dir="rtl"`.

## Assets
- `assets/logo.png` — the app logo (green H / house / monstera), white knocked
  out to transparent. Reuse as the sidebar + auth mark.
- `assets/room-bedroom.png`, `assets/room-living.png` — reference room photos
  (landing hero + login panel). Replace with the user's own.

## Files
- `HostMagSmart Refresh.dc.html` — the full design reference
- `globals.botanical.css` — paste-ready token block
- `fonts-and-tailwind.ts` — font wiring + Tailwind diff + usage cheatsheet
- `assets/` — logo + room photos
