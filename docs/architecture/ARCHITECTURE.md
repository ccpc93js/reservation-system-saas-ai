# 🏗️ HostelHub Architecture & Design

Complete technical overview of the system.

---

## 📋 Project Goals

**Primary Goal:** Build a SaaS hostel PMS (Property Management System) to replace Excel spreadsheets.

**Phase 1 Goal:** Demo a working tape chart calendar with Hostel Darko's real room layout.

**10-Day Demo Plan:** Show the owner a fully functional booking system that can replace their Excel workflows.

**Business Goal:** Sell to other independent hostels as SaaS (€19-99/mo tiers).

---

## 🏪 Hostel Darko (First Customer)

**Location:** Belgrade, Serbia  
**Inventory:** 18 beds across 8 rooms

```
Room 100 "PLAVA" (Blue dorm):
  Beds 101-106 (6 beds)
  Type: Mixed dorm
  Price: €12/night

Room 200 "ŽUTA" (Yellow dorm):
  Beds 201-206 (6 beds)
  Type: Mixed dorm
  Price: €12/night

Studios 403, 404:
  2 private rooms
  Type: Private studio
  Price: €40/night

Family Rooms 501-505:
  5 private rooms
  Type: Family
  Price: €60/night

Small Room 601:
  Beds 601-A, 601-B (2 beds)
  Type: Private small
  Price: €35/night
```

**Serbia-Specific Requirements:**
- All foreign guests must be registered with police ("prijava stranaca")
- Must track: passport, date/place of birth, nationality, entry date to Serbia
- No metal coins accepted (cash must be paper)
- Physical passport required (not phone photo)
- Key deposit: passport/ID/€10/1200 dinars

---

## 🏛️ Technical Stack

### Frontend
- **Next.js 15** — Server-side rendering, API routes
- **React 19** — UI components
- **TypeScript** — Type safety
- **Tailwind CSS 4** — Styling (utility-first)
- **Radix UI** — Headless components (accessible primitives)
- **Lucide React** — Icons

### Backend / Database
- **Supabase** — Postgres database + Auth + Storage + Realtime
- **Supabase Postgres** — Relational database with RLS (row-level security)
- **Supabase Auth** — User authentication (email/password, OAuth)
- **Supabase Realtime** — WebSocket subscriptions (for live updates later)

### Infrastructure
- **Vercel** — Hosting (deploy Next.js automatically from git)
- **Stripe** — Subscription billing (Phase 2+)
- **Google Document AI** — Passport OCR (Phase 2)
- **Resend** — Email delivery (Phase 2)

### Development
- **Node.js** — Runtime
- **Turbopack** — Fast bundler (Next.js 15 default)
- **pnpm** — Package manager
- **TypeScript** — Language
- **ESLint** — Code linting

---

## 🗂️ Folder Structure

```
HostelHub/
├── .vscode/
│   └── mcp.json                    # Model Context Protocol (Supabase integration)
├── supabase/
│   ├── schema.sql                  # Database schema (9 tables)
│   ├── serbia_registration_fields.sql  # Serbia-specific fields
│   ├── seed.sql                    # Sample data (Hostel Darko)
│   └── hostel_darko_rules.md       # Hostel operational rules (AI knowledge base)
├── src/
│   ├── app/
│   │   ├── (auth)/                 # Authentication pages (login, signup)
│   │   ├── (dashboard)/            # Protected dashboard (logged-in only)
│   │   │   ├── dashboard/          # Today's stats & arrivals
│   │   │   └── calendar/           # Tape chart view
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Home (redirect)
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser client (public key)
│   │   │   └── server.ts           # Server client (service role key)
│   │   ├── types/
│   │   │   └── database.ts         # TypeScript types for DB
│   │   └── utils.ts                # Helper functions
│   ├── components/
│   │   ├── calendar/
│   │   │   └── tape-chart.tsx      # Main calendar visualization
│   │   └── layout/
│   │       ├── sidebar.tsx         # Navigation menu
│   │       └── header.tsx          # Top bar
│   └── middleware.ts               # Auth protection
├── public/                         # Static assets
├── .env.local                      # Environment variables (secret)
├── .gitignore                      # Git ignore rules
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript config
├── tailwind.config.ts              # Tailwind config
├── next.config.ts                  # Next.js config
├── README.md                       # Auto-generated Next.js README
├── LAUNCH.md                       # Phase 1 setup guide (YOU ARE HERE)
├── PHASE_1_CHECKLIST.md            # Quick checklist
├── PHASE_1_SETUP.md                # Detailed setup guide
└── PROJECT_INDEX.md                # File reference guide
```

---

## 🔄 Request Flow

### Unauthenticated User
```
Browser
  ↓ GET http://localhost:3000
  ↓ middleware.ts checks for auth cookie
  ↓ No auth → redirect to /login
  ↓ (auth)/login/page.tsx
  ↓ User enters email + password
  ↓ Calls supabase.auth.signInWithPassword()
  ↓ Supabase returns JWT token
  ↓ Browser stores JWT in cookie (via SSR)
  ↓ redirect("/dashboard")
```

### Authenticated User
```
Browser
  ↓ GET http://localhost:3000/calendar
  ↓ middleware.ts checks auth cookie ✓
  ↓ Allows access
  ↓ (dashboard)/calendar/page.tsx (server component)
  ↓ const supabase = await createServerClient()
  ↓ SELECT beds FROM beds WHERE org_id = ? ORDER BY position
  ↓ SELECT * FROM reservation_items WHERE org_id = ? AND check_out >= today
  ↓ Data passed to <TapeChart />
  ↓ Browser receives HTML with data embedded
  ↓ TapeChart (client component) renders the visual
```

---

## 🗄️ Database Schema

### Core Entities

```sql
organizations (hostel info)
├── id (UUID primary key)
├── name (e.g. "Hostel Darko")
├── slug (e.g. "hostel-darko")
├── city (e.g. "Belgrade")
├── country (e.g. "SRB")
├── timezone (e.g. "Europe/Belgrade")
└── locale (e.g. "sr" for Serbian)

room_types (room categories)
├── id
├── organization_id (FK)
├── name (e.g. "6-bed dorm")
├── type (enum: 'dorm' | 'private')
├── gender (enum: 'mixed' | 'female' | 'male' | null)
├── capacity (e.g. 6)
└── base_price (e.g. 12.00)

rooms (physical rooms)
├── id
├── organization_id (FK)
├── room_type_id (FK)
├── name (e.g. "Room 100")
├── floor
└── notes

beds (individual beds - atomic inventory unit)
├── id
├── organization_id (FK)
├── room_id (FK)
├── name (e.g. "Bed 101")
├── position (display order for tape chart)
└── is_active

guests (deduplicated people)
├── id
├── organization_id (FK)
├── first_name
├── last_name
├── email
├── phone
├── nationality (ISO 3166-1 alpha-3)
├── document_type (enum: 'passport' | 'national_id' | 'drivers_license')
├── document_number
├── document_hash (SHA-256 for dedup)
├── date_of_birth
└── gender
└── [Serbia fields] passport_issue_place, entry_date_to_serbia, etc.

reservations (booking header)
├── id
├── organization_id (FK)
├── guest_id (FK, nullable)
├── reservation_number (e.g. "RES-26-0001")
├── check_in (date)
├── check_out (date)
├── status (enum: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show')
├── channel (enum: 'walk_in' | 'phone' | 'email' | 'booking_com' | 'airbnb' | 'hostelworld' | 'direct_website' | 'other')
├── adults
├── children
├── total_amount
├── paid_amount
├── notes
├── special_requests
├── online_checkin_token
├── online_checkin_completed_at
└── created_by (user_id who created it)

reservation_items (bed allocations)
├── id
├── organization_id (FK)
├── reservation_id (FK)
├── bed_id (FK) ← key for tape chart
├── check_in (date)
├── check_out (date)
├── price_per_night
└── total_price

memberships (users ↔ organizations + roles)
├── id
├── organization_id (FK)
├── user_id (FK to auth.users)
├── role (enum: 'owner' | 'manager' | 'staff')
└── created_at
```

### Row-Level Security (RLS)

Users can only see their organization's data:
```sql
-- Example: users can only select beds from their org
SELECT * FROM beds
WHERE organization_id = (
  SELECT organization_id FROM memberships WHERE user_id = current_user_id()
)
```

---

## 🎨 Component Architecture

### Page Hierarchy
```
layout.tsx (root)
├── app/page.tsx (home redirect)
├── (auth)/layout.tsx (auth pages)
│   └── login/page.tsx (sign in/up)
└── (dashboard)/layout.tsx (protected, with sidebar)
    ├── dashboard/page.tsx (today's stats)
    └── calendar/page.tsx (tape chart)
        └── <TapeChart /> (client component)
```

### Key Components
- **TapeChart** — The tape chart visualization
  - Input: beds[], reservations[], orgId
  - Renders: 45 days × N beds grid
  - Colors by reservation status
  - Click handlers → TODOs for Phase 2

- **Sidebar** — Navigation
  - Links to Dashboard, Calendar
  - User menu (logout)

- **Header** — Top bar
  - Branding
  - User profile

---

## 🔐 Security Model

### Authentication
- Supabase Auth handles user credentials
- JWT token stored in httpOnly cookie (secure)
- Server-side middleware validates token
- Unauthenticated users redirected to /login

### Authorization
- Role-based access control (RBAC)
  - owner: Full access to organization
  - manager: Can manage reservations, guests
  - staff: Can view and check in guests
- Row-Level Security (RLS) enforces data isolation
  - Users can only see their organization's data

### Secrets
- Service role key kept in .env (never exposed to client)
- Anon key is public but has read-only access
- Database password should be rotated regularly

---

## 🚀 Deployment

### Development
```bash
npm run dev          # Turbopack hot reload at http://localhost:3000
```

### Production (via Vercel)
```bash
git push origin main → Vercel builds & deploys automatically
```

### Environment Variables (Production)
- Add to Vercel Settings → Environment Variables
- Same as .env.local keys

---

## 📈 Future Phases

### Phase 2 (Days 3-4)
- Click empty cell → New Reservation drawer
- Click existing block → Edit Reservation drawer
- Save to database
- Block turns color immediately

### Phase 3 (Days 5-6)
- Guest form (full profile: name, email, passport, DOB)
- Passport OCR (Google Document AI) → prefill form
- Deduplication (check if guest already in system)

### Phase 4 (Days 7-8)
- QR code generation (for check-in)
- Mobile check-in flow (guest scans QR → photo upload)
- Owner dashboard (occupancy %, arrivals/departures today)

### Phase 5+ (Future)
- Channel manager integration (Channex.io for Booking.com, Airbnb sync)
- Email confirmations (Resend)
- Stripe billing (collect payments, manage subscriptions)
- AI chat with hostel knowledge base (Claude API)
- Analytics (occupancy trends, revenue forecasts)
- Inventory management (toiletries, cleaning supplies)

---

## 💾 Data Lifecycle

### Creating a Reservation
```
1. User clicks empty cell on tape chart
2. NewReservationDrawer opens
3. User selects guest or creates new guest
4. User enters check-in, check-out dates
5. System creates:
   - reservations row (header)
   - reservation_items rows (one per bed × night)
6. TapeChart rerenders with new block
```

### Checking In a Guest
```
1. User finds guest in "Arriving today" list
2. User clicks "Check In"
3. System updates: reservations.status = 'checked_in'
4. TapeChart updates block color to green
```

### Checking Out a Guest
```
1. User clicks on block in tape chart
2. EditReservationDrawer opens
3. User clicks "Check Out"
4. System updates: reservations.status = 'checked_out'
5. TapeChart updates block color to gray
```

---

## 🧪 Testing Strategy

### Phase 1
- Manual testing in browser
- Verify schema.sql creates all tables
- Verify seed.sql populates data
- Verify tape chart renders all 18 beds

### Phase 2+
- Unit tests (Jest)
- E2E tests (Playwright)
- Load testing (many concurrent reservations)
- Security testing (RLS, CSRF, XSS)

---

## 🎯 Success Metrics

**Phase 1 Demo Success:**
- ✅ Tape chart renders without errors
- ✅ Shows all 18 Hostel Darko beds
- ✅ Sample reservations visible
- ✅ Colors are correct by status
- ✅ User can log out and log back in
- ✅ Data persists across page refreshes

**Phase 10 Demo Success (To Boss):**
- ✅ Create reservation in <3 clicks
- ✅ Check-in/check-out workflow
- ✅ Occupancy % calculated correctly
- ✅ Can export data to Excel
- ✅ Email confirmations sent to guests
- ✅ Looks more professional than Excel

---

## 📞 Key Contacts & Resources

- **Supabase Project:** https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl
- **Next.js Docs:** https://nextjs.org/docs
- **Supabase Docs:** https://supabase.com/docs
- **Tailwind Docs:** https://tailwindcss.com/docs
- **Radix UI:** https://www.radix-ui.com/docs/primitives/overview/introduction

---

**Now that you understand the architecture, start with LAUNCH.md to begin Phase 1!** 🚀
