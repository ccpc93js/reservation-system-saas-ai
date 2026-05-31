-- ─────────────────────────────────────────────────────────────────────────────
-- Hostel Darko — Real Seed Data
-- Run this AFTER schema.sql and AFTER creating your account via the login page
--
-- Steps:
--   1. Sign up at http://localhost:3000/login (or use Supabase Auth → Add user)
--   2. Go to Supabase Dashboard → Authentication → Users → copy your user UUID
--   3. Replace 'YOUR-USER-UUID-HERE' below with that UUID
--   4. Run this entire file in SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Organization ─────────────────────────────────────────────────────────
insert into organizations (id, name, slug, city, country, timezone, locale)
values (
  'a1000000-0000-0000-0000-000000000001',
  'Hostel Darko',
  'hostel-darko',
  'Belgrade',
  'SRB',
  'Europe/Belgrade',
  'sr'
)
on conflict (slug) do nothing;

-- ─── 2. Your membership as owner ─────────────────────────────────────────────
-- Replace 'YOUR-USER-UUID-HERE' with your actual Supabase user UUID
insert into memberships (organization_id, user_id, role)
values (
  'a1000000-0000-0000-0000-000000000001',
  'YOUR-USER-UUID-HERE',
  'owner'
)
on conflict (organization_id, user_id) do nothing;

-- ─── 3. Room types ───────────────────────────────────────────────────────────
insert into room_types (id, organization_id, name, type, gender, capacity, base_price)
values
  -- Blue dorm (PLAVA) — 6 beds
  ('b1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001',
   'Blue Dorm (PLAVA)', 'dorm', 'mixed', 6, 12.00),

  -- Yellow dorm (ŽUTA) — 6 beds
  ('b1000000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000001',
   'Yellow Dorm (ŽUTA)', 'dorm', 'mixed', 6, 12.00),

  -- Studio private rooms
  ('b1000000-0000-0000-0000-000000000003',
   'a1000000-0000-0000-0000-000000000001',
   'Studio', 'private', null, 2, 40.00),

  -- Family rooms
  ('b1000000-0000-0000-0000-000000000004',
   'a1000000-0000-0000-0000-000000000001',
   'Family Room', 'private', null, 4, 60.00),

  -- Small room
  ('b1000000-0000-0000-0000-000000000005',
   'a1000000-0000-0000-0000-000000000001',
   'Small Room', 'private', null, 2, 35.00)
on conflict (id) do nothing;

-- ─── 4. Physical rooms ───────────────────────────────────────────────────────
insert into rooms (id, organization_id, room_type_id, name, floor)
values
  -- Blue Dorm — Floor 1
  ('c1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000001',
   'Room 100 – PLAVA', 1),

  -- Yellow Dorm — Floor 2
  ('c1000000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000002',
   'Room 200 – ŽUTA', 2),

  -- Studios — Floor 4
  ('c1000000-0000-0000-0000-000000000003',
   'a1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000003',
   'Studio 403', 4),

  ('c1000000-0000-0000-0000-000000000004',
   'a1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000003',
   'Studio 404', 4),

  -- Family rooms — Floor 5
  ('c1000000-0000-0000-0000-000000000005',
   'a1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000004',
   'Family Room 501', 5),

  ('c1000000-0000-0000-0000-000000000006',
   'a1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000004',
   'Family Room 502', 5),

  ('c1000000-0000-0000-0000-000000000007',
   'a1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000004',
   'Family Room 503', 5),

  ('c1000000-0000-0000-0000-000000000008',
   'a1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000004',
   'Family Room 504', 5),

  ('c1000000-0000-0000-0000-000000000009',
   'a1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000004',
   'Family Room 505', 5),

  -- Small room — Floor 6
  ('c1000000-0000-0000-0000-000000000010',
   'a1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000005',
   'Small Room 601', 6)

on conflict (id) do nothing;

-- ─── 5. Beds ─────────────────────────────────────────────────────────────────
insert into beds (organization_id, room_id, name, position, is_active)
values
  -- Room 100 PLAVA — 6 beds
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '101', 1, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '102', 2, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '103', 3, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '104', 4, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '105', 5, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '106', 6, true),

  -- Room 200 ŽUTA — 6 beds
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', '201', 1, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', '202', 2, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', '203', 3, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', '204', 4, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', '205', 5, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', '206', 6, true),

  -- Studio 403 — 1 unit (private)
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Studio 403', 1, true),

  -- Studio 404 — 1 unit (private)
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'Studio 404', 1, true),

  -- Family rooms — 1 unit each (private; can add bed-level later)
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', 'Family 501', 1, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000006', 'Family 502', 1, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000007', 'Family 503', 1, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000008', 'Family 504', 1, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000009', 'Family 505', 1, true),

  -- Small Room 601 — 2 beds (appeared twice in Excel)
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000010', 'Small 601-A', 1, true),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000010', 'Small 601-B', 2, true);


-- ─── 6. Sample guests from the BOOK sheet ────────────────────────────────────
-- These match real guests visible in the Excel screenshots
insert into guests (
  organization_id, first_name, last_name,
  nationality, document_type, document_number,
  date_of_birth, gender
)
values
  ('a1000000-0000-0000-0000-000000000001',
   'Dinka', 'Kontić', 'HRV', 'national_id', 'LK.BR 117516043',
   '1973-03-12', 'F'),

  ('a1000000-0000-0000-0000-000000000001',
   'Arda', 'Kavak', 'TUR', 'passport', 'U32240803',
   '2025-05-27', 'M'),

  ('a1000000-0000-0000-0000-000000000001',
   'Carlos Adampol Galindo', 'Rodriguez', 'MEX', 'passport', 'N07381164',
   '1976-04-09', 'M'),

  ('a1000000-0000-0000-0000-000000000001',
   'Sreten', 'Koranlija', 'SRB', 'passport', '012792750',
   '1997-09-21', 'M'),

  ('a1000000-0000-0000-0000-000000000001',
   'Ahmet', 'Devecioglu', 'TUR', 'passport', 'U26730187',
   '1998-03-28', 'M');


-- ─── Verify everything looks right ───────────────────────────────────────────
-- Run these selects to confirm data is correct:

-- select name, slug from organizations;
-- select r.name as room, rt.name as type, count(b.id) as beds
--   from rooms r
--   join room_types rt on r.room_type_id = rt.id
--   left join beds b on b.room_id = r.id
--   group by r.name, rt.name
--   order by r.name;
-- select first_name, last_name, nationality from guests;
