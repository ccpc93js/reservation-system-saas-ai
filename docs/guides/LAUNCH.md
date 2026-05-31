# 🚀 Phase 1: Launch Instructions

Your reservation system for Hostel Darko is **ready to build**. Everything is scaffolded — now execute.

---

## ⚡ Start Here: 30 Minutes to Working Tape Chart

**What you're about to do:**
1. Give the app access to your database (service role key)
2. Install Node packages
3. Create the database structure
4. Create your user account
5. Populate with Hostel Darko's real data
6. Run the dev server
7. View the calendar

**When you're done:** You'll see all 18 beds in a Gantt-chart view, with sample reservations, ready for the next phase (click-to-create).

---

## 📋 Open These Files Now

In VS Code, open these side-by-side:
- `.env.local` — you'll edit this in Step 1
- `PHASE_1_CHECKLIST.md` — follow this as your guide
- `supabase/schema.sql` — you'll copy-paste this
- `supabase/seed.sql` — you'll copy-paste this (after editing)

---

## 🔑 Step 1: Service Role Key (5 min)

The app needs permission to perform database operations on your behalf.

1. Open: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/settings/api
2. Find **"Project API keys"** section
3. Copy **service_role** (the big one, starts with `sbpvt_`)
4. Go back to VS Code
5. Open `.env.local`
6. Replace `PASTE_SERVICE_ROLE_KEY_HERE` with that key

```env
# Before:
SUPABASE_SERVICE_ROLE_KEY=PASTE_SERVICE_ROLE_KEY_HERE

# After:
SUPABASE_SERVICE_ROLE_KEY=sbpvt_your_long_key_here...
```

Save the file.

**⚠️ Critical:** Don't commit this file. It's in `.gitignore` already — you're safe.

---

## 📦 Step 2: Install Packages (3 min)

Terminal:
```bash
npm install
```

Wait for the spinner. You'll see "added X packages" when done.

---

## 🗄️ Step 3: Create Database Schema (2 min)

1. Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/sql/new
2. Click **"New Query"** (top-left corner)
3. You'll see an empty SQL editor
4. Go to `supabase/schema.sql` in VS Code
5. Select all (`Ctrl+A`) and copy
6. Paste into the SQL editor
7. Click **"Run"** (top-right button)
8. Wait for the checkmark `✓` (says "1 transaction executed")

The database now has 9 tables: organizations, rooms, beds, guests, reservations, etc.

---

## 👤 Step 4: Create Your Account (2 min)

You need a user account. **Pick one:**

**Option A: In the app (easier)**
1. In terminal: `npm run dev`
2. Go to http://localhost:3000
3. You'll see a login page
4. Click the link at the bottom: **"Don't have an account? Sign up"**
5. Enter your email and a password (anything you remember)
6. You'll be logged in and on the dashboard

**Option B: Via Supabase Dashboard**
1. Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/auth/users
2. Click **"Add user"** (top-right)
3. Enter email and password
4. Click **"Create user"**

---

## 🆔 Step 5: Copy Your User UUID (1 min)

1. Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/auth/users
2. Find your email in the list
3. Click your email to open the details panel
4. You'll see **"User ID"** — it's a long UUID like `a1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6`
5. Copy it (click the copy icon next to it)

---

## 🌱 Step 6: Seed the Database (2 min)

This populates Hostel Darko data:

1. Go to `supabase/seed.sql` in VS Code
2. Find line 30 (around there):
   ```sql
   'YOUR-USER-UUID-HERE',
   ```
3. Replace `YOUR-USER-UUID-HERE` with your actual UUID from Step 5:
   ```sql
   'a1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6',
   ```
4. Select all the file and copy it
5. Go back to Supabase SQL editor: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/sql/new
6. Click **"New Query"**
7. Paste the seed file
8. Click **"Run"**
9. Wait for `✓` (says "7 transactions executed")

The database now has:
- Hostel Darko organization
- You as the owner
- All 18 beds (6 blue dorm, 6 yellow dorm, 2 studios, 4 family, 2 small)
- Sample guests and reservations

---

## 🔌 Step 7: Run Dev Server (3 min)

Terminal:
```bash
npm run dev
```

You'll see:
```
  ▲ Next.js 15.3.2
  - Local:        http://localhost:3000
  - Turbopack:    ready in 1.8s
```

---

## 📅 Step 8: View the Tape Chart (1 min)

1. Open http://localhost:3000 in your browser
2. Log in with your email/password
3. Click **"Calendar"** in the sidebar

**You should now see:**

```
Calendar
Drag to create reservations · Click to edit

[A 45-day × 18-bed tape chart]

PLAVA (Blue dorm)
  Bed 101  [reservation blocks in color]
  Bed 102
  Bed 103
  Bed 104
  Bed 105
  Bed 106
ŽUTA (Yellow dorm)
  Bed 201
  ... (6 more)
Studio 403
Studio 404
Family rooms 501-505
Small room 601-A, 601-B
```

Each colored block = a reservation. Hover over it to see the guest name and dates.

---

## ✅ You've Completed Phase 1!

The core of the app is working. You have:
- ✅ A working database with all 18 beds
- ✅ Real Hostel Darko structure visible
- ✅ Sample reservations on the calendar
- ✅ Authentication working
- ✅ 45-day view of occupancy

---

## 🚦 Phase 2: Next Steps (coming soon)

- **Days 3-4:** Click empty cell → open new reservation dialog → save to DB
- **Day 5:** Full guest form (name, email, passport, etc.)
- **Day 6:** Passport OCR (Google Document AI)
- **Day 7:** QR code handoff (guest scans to check in)
- **Day 8:** Owner dashboard (today's arrivals/departures, occupancy %)
- **Day 9:** Polish + seed real data from Excel
- **Day 10:** Demo to boss

---

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| "No beds set up yet" on calendar | schema.sql or seed.sql didn't run. Check Supabase SQL logs for errors. |
| "Unauthorized" error | Check `.env.local` — credentials must be exact. Restart dev server (`Ctrl+C`, `npm run dev`). |
| Can't log in | Create account at http://localhost:3000 (click "Sign up"). |
| "relation 'public.beds' does not exist" | schema.sql failed. Run it again in SQL editor. |
| Dev server won't start | Make sure port 3000 isn't in use. Or run `npm run dev -- --port 3001` |

---

## 📌 Important Reminders

1. **Reset your database password** after Phase 1 is done:
   - Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/settings/database
   - Click "Reset database password"
   - Update it in your password manager
   - (You shared the old one in chat — now it's rotated)

2. **Keep `.env.local` secret:**
   - The service role key is sensitive
   - It's in `.gitignore` — never commit it
   - The public anon key is safe to share

3. **Git is not initialized yet:**
   - When you're ready, run: `git init` && `git add .` && `git commit -m "Initial HostelHub setup"`
   - This project is ready for version control

---

## 🎯 Your Next Move

1. Follow `PHASE_1_CHECKLIST.md` for a step-by-step walkthrough
2. Or follow this file for the full explanation
3. When done, you'll have a working tape chart

**Estimated time: 16 minutes** (mostly waiting for npm install and dev server startup)

Good luck! 🚀
