# HostelHub Phase 1: Tape Chart Demo Setup

**Goal:** Get the calendar page rendering with Hostel Darko's real rooms and beds.

**Timeline:** Complete this today to see the actual hostel inventory in the app.

---

## Prerequisites
- VS Code with Claude Code installed
- Supabase account (created ✅)
- Project ref: `foujdkwmekdrtztvieyl`
- Public key already in `.env.local` ✅

---

## Step 1: Get Your Supabase Service Role Key

The app needs permission to run server-side operations (creating reservations, etc.).

1. Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/settings/api
2. Scroll to **"Project API keys"**
3. Copy the **Service Role** key (starts with `sbpvt_...`)
4. Open `.env.local` in your project
5. Replace `PASTE_SERVICE_ROLE_KEY_HERE` with the key

```env
SUPABASE_SERVICE_ROLE_KEY=sbpvt_your_key_here
```

⚠️ **Security note:** This key is secret. Don't commit it to git. `.env.local` is already in `.gitignore`.

---

## Step 2: Install Dependencies

```bash
npm install
```

Wait for it to finish. You should see `added X packages` at the end.

---

## Step 3: Create Your Database Schema

The app uses 9 tables (organizations, beds, reservations, etc.). Run the schema now:

1. Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/sql/new
2. Click **"New Query"** (or top-left **"SQL"** tab)
3. Open this file: `supabase/schema.sql` (copy the entire contents)
4. Paste into the SQL Editor
5. Click **"Run"** (top-right)
6. Wait for `✓` — it will say "1 transaction executed"

**Do not skip this step** — the database will be empty without the schema.

---

## Step 4: Create Your User Account

The app uses Supabase Auth. You need a user account:

**Option A (Recommended): Sign up in the app**
1. Run the dev server: `npm run dev`
2. Go to http://localhost:3000
3. Click **"Sign up"** (bottom of login page)
4. Use your email and any password
5. You'll be logged in and see the dashboard

**Option B: Create via Supabase Dashboard**
1. Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/auth/users
2. Click **"Add user"** (top-right)
3. Enter your email and a password
4. Click **"Create user"**

---

## Step 5: Get Your User UUID

1. Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/auth/users
2. Find your email in the list
3. Click to open the user details
4. Copy the **User ID** (looks like `a1a2b3c4-...`)
5. Keep it handy — you'll paste it in the next step

---

## Step 6: Seed the Database

Now populate the database with Hostel Darko's real rooms, beds, and sample guests:

1. Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/sql/new
2. Click **"New Query"**
3. Open this file: `supabase/seed.sql`
4. **Find this line (around line 30):**
   ```sql
   'YOUR-USER-UUID-HERE',
   ```
5. **Replace it with your UUID** (from Step 5)
   ```sql
   'a1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6',
   ```
6. Copy the entire updated seed file
7. Paste into the SQL Editor
8. Click **"Run"**
9. Wait for `✓` — it will say "7 transactions executed"

**What this does:**
- Creates Hostel Darko organization
- Links you as the owner
- Adds all 18 beds (6 in Blue dorm, 6 in Yellow dorm, 2 studios, 4 family rooms, 2 in small room)
- Adds sample guests and reservations so the tape chart isn't empty

---

## Step 7: Run the Dev Server

If you haven't already:

```bash
npm run dev
```

You'll see:
```
- Local:        http://localhost:3000
- Turbopack:    ready in 1.8s
```

Open http://localhost:3000 in your browser.

---

## Step 8: View the Tape Chart

1. Log in with your email/password (from Step 4)
2. You'll see the **Dashboard** with today's stats
3. Click **"Calendar"** in the sidebar (or go to http://localhost:3000/calendar)

**You should now see:**
- Blue dorm (PLAVA) — 6 beds
- Yellow dorm (ŽUTA) — 6 beds
- Studio 403, 404
- Family rooms 501-505
- Small room 601-A, 601-B

With colored blocks showing sample reservations across 45 days.

---

## Troubleshooting

### "No beds set up yet"
The calendar page loaded but found no beds. This means:
- The schema.sql didn't run properly, or
- The seed.sql didn't run properly, or
- Your user ID in the memberships table doesn't match your actual user

**Fix:** Check the Supabase SQL Editor logs for errors. Run schema.sql, then seed.sql again.

### "Unauthorized" error
Your `.env.local` variables aren't set correctly. Double-check:
- `NEXT_PUBLIC_SUPABASE_URL` is exactly `https://foujdkwmekdrtztvieyl.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is exactly `sb_publishable_ETh4uKOX6GgskiHrb-GZXA_mD5StPfk`
- `SUPABASE_SERVICE_ROLE_KEY` doesn't have `PASTE_SERVICE_ROLE_KEY_HERE`

Then restart the dev server: `Ctrl+C`, then `npm run dev`.

### "relation 'public.beds' does not exist"
The schema didn't run. Go back to Step 3 and run schema.sql in the SQL Editor.

### You can't log in
Try signing up again at http://localhost:3000/signup. If the signup form doesn't show, you may need to enable email/password auth in Supabase:
- Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/auth/providers
- Find **"Email"** and make sure it's enabled

---

## Next: Phase 2

Once the tape chart renders with all 18 beds:
- **Day 3-4:** Click empty cell → create new reservation
- **Day 5:** Guest form for creating/editing guests
- **Day 6:** Passport OCR (Google Document AI)

For now, celebrate — you have a working hostel booking system! 🎉

---

## Password Reminder ⚠️

You shared your **database password** in chat. After you're done with setup:
1. Go to: https://supabase.com/dashboard/project/foujdkwmekdrtztvieyl/settings/database
2. Click **"Reset database password"**
3. Copy the new password to your password manager
4. Use the new password if you ever need direct database access

The **public anon key** (in `.env.local`) is fine to share — it has read-only access. Only the service role key and database password are sensitive.
