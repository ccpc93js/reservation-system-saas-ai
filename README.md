# HostelHub — AI-Powered Hostel Reservation System

## Recent changes

- See `CHANGELOG.md` for the Tailwind stability fix and configuration notes.

## Get running in 30 minutes

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Copy your project URL and anon key from **Settings → API**
3. Copy the env template:
   ```bash
   cp .env.local.example .env.local
   ```
4. Fill in `.env.local` with your Supabase keys

### 3. Run the database schema

1. Open your Supabase project → **SQL Editor → New query**
2. Paste the full contents of `supabase/schema.sql`
3. Click **Run**

### 4. Create your first user

1. Go to Supabase → **Authentication → Users → Add user**
2. Enter your email and password
3. Copy the user UUID (you'll need it for the seed data)

### 5. Seed your hostel's data

Back in the SQL Editor, run the seed section at the bottom of `schema.sql`
(uncomment the INSERT statements and fill in the real UUIDs + your hostel's details).

**Pro tip for the demo:** Use your boss's actual room names and bed names — it will be
much more impressive when he sees "Dorm A, Bed 1" instead of "Room 1, Bed 1".

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to login.

---

## Project structure

```
src/
├── app/
│   ├── (auth)/login/         → Login page
│   ├── (dashboard)/
│   │   ├── dashboard/        → Today's arrivals + occupancy stats
│   │   ├── calendar/         → Tape chart (the main screen)
│   │   ├── reservations/     → Reservation list
│   │   └── guests/           → Guest database
│   └── api/scan-id/          → Passport OCR endpoint
├── components/
│   ├── layout/               → Sidebar + header
│   └── calendar/tape-chart   → The tape chart component
├── lib/
│   ├── supabase/             → client.ts + server.ts
│   ├── types/database.ts     → TypeScript types for DB
│   └── utils.ts              → cn(), formatCurrency(), etc.
└── middleware.ts              → Auth + redirect logic

supabase/schema.sql            → Full DB schema + RLS policies
```

---

## 10-day build plan

| Day | What to build |
|-----|---------------|
| 1 | This setup. Get to `npm run dev` with login working. |
| 2 | Seed real data. Tape chart renders with real beds. |
| 3–4 | Click empty cell → New reservation drawer. Save to DB. Appears on chart. |
| 5 | Guest form. Create/edit guests. Link to reservations. |
| 6 | Passport scan — upload photo → Document AI → pre-fill form. |
| 7 | QR handoff — desktop shows QR, phone scans, photo lands in form. |
| 8 | Today dashboard — arrivals, departures, occupancy count. |
| 9 | Polish + mobile responsiveness. Seed with real upcoming reservations from Excel. |
| 10 | Demo day. Show your boss. |

---

## The tape chart (your priority)

The tape chart is in `src/components/calendar/tape-chart.tsx`.

**Next TODOs on this component (in order):**
1. Click on empty day-cell → open a `NewReservationDrawer` component
2. `NewReservationDrawer` has a form: guest name, check-in, check-out, bed (auto-selected from click)
3. On save → `INSERT` into `reservations` + `reservation_items` → optimistically update the chart
4. Click on an existing block → open `ReservationDrawer` with full details + edit/cancel options
5. Drag to extend/create (do this last)

---

## Adding shadcn/ui components

```bash
npx shadcn@latest add button input label select dialog sheet
```

Run this for each component you need. Components land in `src/components/ui/`.

---

## Passport scanning setup (Day 6)

### Option A — Google Document AI (recommended)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Document AI API**
3. Create an **ID Document Parser** processor
4. Download a service account key JSON → save as `service-account.json` in project root
5. Fill in `GOOGLE_DOCUMENT_AI_*` vars in `.env.local`

### Option B — AWS Textract (faster to start)

1. Create AWS credentials with Textract permissions
2. Fill in `AWS_*` vars in `.env.local`
3. Use `@aws-sdk/client-textract` package

The API route is at `src/app/api/scan-id/route.ts` — build it on Day 6.

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add your `.env.local` variables in the Vercel dashboard under **Settings → Environment Variables**.

Your boss can access the live URL from his phone the same day you deploy.
