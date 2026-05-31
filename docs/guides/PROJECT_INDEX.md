# 📚 HostelHub Project Index

Quick reference for all important files and what they do.

---

## 🚀 Phase 1 Setup (Start Here)

| File | Purpose |
|------|---------|
| **LAUNCH.md** | Main entry point — 30-minute setup guide with step-by-step instructions |
| **PHASE_1_CHECKLIST.md** | Quick 8-step checklist you can check off as you go |
| **PHASE_1_SETUP.md** | Detailed guide with troubleshooting for each step |
| **.env.local** | Environment variables (Supabase credentials, app config) |

---

## 🗄️ Database Setup

| File | What it does | Run where |
|------|------------|-----------|
| **supabase/schema.sql** | Creates 9 database tables (organizations, beds, reservations, etc.) | Supabase SQL Editor |
| **supabase/serbia_registration_fields.sql** | Adds Serbia-specific guest fields (passport, entry date, etc.) | Supabase SQL Editor (after schema.sql) |
| **supabase/seed.sql** | Populates with Hostel Darko's real data — edit your UUID before running | Supabase SQL Editor (after schema.sql) |
| **supabase/hostel_darko_rules.md** | Hostel's operational rules (payment, deposits, etc.) — knowledge base for AI chat later | Reference only |

---

## 🎯 App Structure

### Configuration
- **package.json** — Dependencies, scripts (npm install, npm run dev, npm run build)
- **next.config.ts** — Next.js configuration
- **tsconfig.json** — TypeScript configuration
- **tailwind.config.ts** — Tailwind CSS configuration
- **.vscode/mcp.json** — Model Context Protocol config for Supabase integration

### Client Setup
- **src/lib/supabase/client.ts** — Browser-side Supabase client (safe, for frontend use)
- **src/lib/supabase/server.ts** — Server-side Supabase client (has full permissions)
- **src/lib/types/database.ts** — TypeScript types for database rows
- **src/lib/utils.ts** — Utility functions

### Authentication
- **src/middleware.ts** — Protects dashboard routes, redirects to login
- **src/app/(auth)/layout.tsx** — Auth pages layout
- **src/app/(auth)/login/page.tsx** — Login/signup form

### Dashboard
- **src/app/(dashboard)/layout.tsx** — Sidebar, header, layout for logged-in users
- **src/app/(dashboard)/dashboard/page.tsx** — Today's stats (arrivals, departures, occupancy)
- **src/app/(dashboard)/calendar/page.tsx** — Loads beds & reservations, passes to TapeChart
- **src/components/layout/sidebar.tsx** — Navigation menu
- **src/components/layout/header.tsx** — Top bar with user menu

### Tape Chart (Core Feature)
- **src/components/calendar/tape-chart.tsx** — The visual calendar (45 days × beds grid)
  - Shows reservation blocks with guest names
  - Color-coded by status (confirmed, pending, checked-in, etc.)
  - TODOs: click to edit, drag to create

---

## 🔄 Data Flow

```
User logs in
     ↓
middleware.ts checks auth
     ↓
(auth)/login/page.tsx or dashboard redirects
     ↓
(dashboard)/dashboard/page.tsx
  → fetches today's data from Supabase
  → shows arrivals, departures, occupancy
     ↓
(dashboard)/calendar/page.tsx
  → fetches all beds from Supabase
  → fetches next 60 days of reservations
  → passes to TapeChart component
     ↓
TapeChart renders:
  → Groups beds by room
  → Draws 45-day grid
  → Plots reservation blocks
  → Shows guest names
```

---

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Run dev server (hot reload)
npm run dev
# Opens at http://localhost:3000

# Build for production
npm build

# Run production build
npm start

# Type check (no build)
npm run typecheck

# Lint code
npm run lint
```

---

## 🔐 Security & Environment

| Variable | Where | What it's for | Who can see it |
|----------|-------|--------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | .env.local | Supabase project URL | Public (browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | .env.local | Public API key (read-only) | Public (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | .env.local (secret) | Full permissions (server only) | **Secret** — never expose |
| `NEXT_PUBLIC_APP_URL` | .env.local | App domain (for redirects, links) | Public |

---

## 📊 Database Schema Overview

### Core Tables
- **organizations** — Hostel info (name, location, timezone)
- **memberships** — Users ↔ organizations + roles (owner, manager, staff)
- **room_types** — Room categories (e.g., "6-bed dorm", "private double")
- **rooms** — Physical rooms (e.g., "Room 100", "Room 200")
- **beds** — Individual beds (e.g., "Bed 101", "Bed 102") — the atomic inventory unit
- **guests** — Guest records (deduped by passport)
- **reservations** — Booking header (who, when, status, payment)
- **reservation_items** — Bed allocations (which bed for which night)

### Relationships
```
Organization
├── Room Types
├── Rooms → Room Types
│  └── Beds
├── Guests
├── Reservations (header)
│  └── Reservation Items (line items) → Beds
└── Memberships → Auth Users
```

---

## 🎨 UI Components Used

- **Radix UI** — Unstyled, accessible components (Dialog, Select, Tabs, etc.)
- **shadcn/ui** — Pre-styled Radix components (likely used in future phases)
- **Tailwind CSS** — Utility-first styling (configured in tailwind.config.ts)
- **Lucide React** — Icons (Calendar, Users, Bed, etc.)
- **Sonner** — Toast notifications

---

## 📱 Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `src/app/page.tsx` | Redirect to `/dashboard` or `/login` |
| `/login` | `src/app/(auth)/login/page.tsx` | Sign in / sign up |
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | Today's stats (arrivals, departures) |
| `/calendar` | `src/app/(dashboard)/calendar/page.tsx` | Tape chart (45-day view) |

---

## 🚧 To-Do (TODOs in Code)

- **tape-chart.tsx line 5:** Click empty cell → open NewReservationDrawer
- **tape-chart.tsx line 6:** Click existing block → open ReservationDrawer
- **tape-chart.tsx line 7:** Drag to create (add after click works)

These are Phase 2+ features.

---

## 📖 Documentation Files

| File | What it is |
|------|-----------|
| **README.md** | Project overview (auto-generated by Next.js) |
| **LAUNCH.md** | You are here — Phase 1 setup guide |
| **PHASE_1_CHECKLIST.md** | Quick checklist version |
| **PHASE_1_SETUP.md** | Detailed step-by-step guide |
| **PROJECT_INDEX.md** | This file — reference for developers |

---

## 🔗 External Resources

- **Supabase Dashboard:** https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl
- **SQL Editor:** https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/sql/new
- **Auth Users:** https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/auth/users
- **Settings/API:** https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/settings/api

---

## 🎯 Phase 1 Success Criteria

You're done with Phase 1 when:
- ✅ npm install completes
- ✅ schema.sql runs without errors
- ✅ seed.sql runs and creates Hostel Darko data
- ✅ npm run dev starts the server
- ✅ You can log in at http://localhost:3000
- ✅ Calendar page shows 18 beds (6+6 dorms, 2 studios, 5 family, 2 small)
- ✅ Sample reservations appear as colored blocks on the tape chart

---

## 📞 Getting Help

1. Check **PHASE_1_SETUP.md** "Troubleshooting" section
2. Look at Supabase SQL Editor error messages
3. Check browser console (F12) for TypeScript or runtime errors
4. Search for the table/function name in supabase/schema.sql to verify it exists

---

**Ready to start? Open LAUNCH.md and follow the 8 steps.** 🚀
