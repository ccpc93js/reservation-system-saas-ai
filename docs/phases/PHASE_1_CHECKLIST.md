# Phase 1 Checklist — 8 Simple Steps

Copy this checklist and check off each step as you complete it:

```
[ ] Step 1: Get service_role key from Supabase Dashboard → Settings → API
[ ] Step 1b: Paste it into .env.local (replace PASTE_SERVICE_ROLE_KEY_HERE)
[ ] Step 2: Run: npm install
[ ] Step 3: Copy schema.sql → Run in Supabase SQL Editor
[ ] Step 4: Sign up at http://localhost:3000/login OR create user in Supabase Auth
[ ] Step 5: Get your User UUID from Supabase Auth → Users
[ ] Step 6: Replace 'YOUR-USER-UUID-HERE' in seed.sql with your UUID
[ ] Step 6b: Copy seed.sql → Run in Supabase SQL Editor
[ ] Step 7: Run: npm run dev
[ ] Step 8: Go to http://localhost:3000/calendar → See Hostel Darko's 18 beds
```

---

## Quick Reference

| File | Location | What it does |
|------|----------|------------|
| `.env.local` | Root | Supabase credentials (fill in service role key) |
| `schema.sql` | `supabase/` | Creates 9 database tables |
| `seed.sql` | `supabase/` | Populates Hostel Darko data (update your UUID) |
| `package.json` | Root | Dependencies |
| `src/app/(dashboard)/calendar/page.tsx` | Source | Calendar page that loads beds & reservations |
| `src/components/calendar/tape-chart.tsx` | Source | The visual tape chart component |

---

## Expected Result

After Step 8, you should see in your browser:

```
Calendar
Drag to create reservations · Click to edit

[Tape Chart with 45 days across, 18 beds down]
PLAVA (Blue dorm)
  Bed 101  [Check-in block] [Gap] [Check-in block]
  Bed 102  [Check-in block]
  Bed 103
  ...
ŽUTA (Yellow dorm)
  Bed 201
  ...
Studio 403, 404
Family rooms 501-505
Small room 601-A, 601-B
```

Colored blocks = sample reservations from seed.sql

---

## If You Get Stuck

1. **"No beds set up yet"** → schema.sql or seed.sql didn't run. Check Supabase SQL Editor for errors.
2. **"Unauthorized"** → Wrong credentials in .env.local. Copy-paste them exactly.
3. **"relation 'public.beds' does not exist"** → schema.sql failed to run.
4. **Can't log in** → Create account at http://localhost:3000/signup

---

## Time to Complete

- Steps 1-2: 5 minutes (environment setup)
- Step 3: 2 minutes (schema.sql runs instantly)
- Step 4: 2 minutes (sign up)
- Step 5: 1 minute (copy UUID)
- Step 6: 2 minutes (seed.sql runs instantly)
- Step 7: 3 minutes (dev server startup)
- Step 8: 1 minute (view result)

**Total: ~16 minutes**

---

## After Phase 1 Completes

You'll have:
✅ Database with real Hostel Darko structure
✅ Tape chart rendering all 18 beds
✅ Sample reservations visible on the calendar
✅ Authentication working
✅ Ready to build Phase 2: click-to-create reservations

**See PHASE_1_SETUP.md for detailed instructions.**
