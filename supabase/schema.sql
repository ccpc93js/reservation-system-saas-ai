-- ─────────────────────────────────────────────────────────────────────────────
-- HostelHub — Core Schema v1
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Each hostel is an "organization"
create table organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  email       text,
  phone       text,
  address     text,
  city        text,
  country     text,
  timezone    text not null default 'UTC',
  locale      text not null default 'es',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Users ↔ organizations (Supabase Auth handles the users table)
create table memberships (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('owner', 'manager', 'staff')),
  created_at      timestamptz not null default now(),
  unique(organization_id, user_id)
);

-- Room categories (e.g. "8-bed mixed dorm", "Private double")
create table room_types (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('dorm', 'private')),
  gender          text check (gender in ('mixed', 'female', 'male')),
  capacity        int not null default 1,
  base_price      numeric(10,2) not null default 0,
  description     text,
  created_at      timestamptz not null default now()
);

-- Physical rooms
create table rooms (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  room_type_id    uuid not null references room_types(id) on delete cascade,
  name            text not null,
  floor           int,
  notes           text,
  created_at      timestamptz not null default now()
);

-- Individual beds — the atomic inventory unit for a hostel
create table beds (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  room_id         uuid not null references rooms(id) on delete cascade,
  name            text not null,        -- e.g. "Bed 1", "Top Bunk A"
  position        int,                  -- display order in tape chart
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Guest records (deduplicated people)
create table guests (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  nationality     text,                 -- ISO 3166-1 alpha-3 (e.g. "ESP", "COL")
  document_type   text check (document_type in ('passport', 'national_id', 'drivers_license')),
  document_number text,
  document_hash   text,                 -- SHA-256(document_number + nationality) for dedup
  date_of_birth   date,
  gender          text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Reservation header
create table reservations (
  id                          uuid primary key default uuid_generate_v4(),
  organization_id             uuid not null references organizations(id) on delete cascade,
  guest_id                    uuid references guests(id) on delete set null,
  reservation_number          text not null,         -- auto-generated, e.g. RES-26-0001
  check_in                    date not null,
  check_out                   date not null,
  status                      text not null default 'pending'
                                check (status in ('pending','confirmed','checked_in','checked_out','cancelled','no_show')),
  channel                     text not null default 'walk_in'
                                check (channel in ('walk_in','phone','email','booking_com','airbnb','hostelworld','direct_website','other')),
  adults                      int not null default 1,
  children                    int not null default 0,
  total_amount                numeric(10,2) not null default 0,
  paid_amount                 numeric(10,2) not null default 0,
  notes                       text,
  special_requests            text,
  online_checkin_token        text unique,
  online_checkin_completed_at timestamptz,
  created_by                  uuid references auth.users(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (check_out > check_in)
);

-- Reservation line items — which bed, which nights, which price
create table reservation_items (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  reservation_id  uuid not null references reservations(id) on delete cascade,
  bed_id          uuid not null references beds(id) on delete restrict,
  check_in        date not null,
  check_out       date not null,
  price_per_night numeric(10,2) not null,
  total_price     numeric(10,2) not null,
  created_at      timestamptz not null default now(),
  check (check_out > check_in)
);

-- QR → phone camera scan sessions
create table scan_sessions (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by      uuid not null references auth.users(id) on delete cascade,
  token           text unique not null,
  status          text not null default 'pending'
                    check (status in ('pending','uploading','processed','failed','expired')),
  expires_at      timestamptz not null default (now() + interval '5 minutes'),
  extracted_fields jsonb,
  photo_path      text,
  created_at      timestamptz not null default now(),
  processed_at    timestamptz
);

-- Full audit trail
create table audit_log (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,
  action          text not null,         -- e.g. 'reservation.created'
  resource_type   text,
  resource_id     uuid,
  changes         jsonb,
  ip_address      text,
  created_at      timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_reservations_org_dates    on reservations(organization_id, check_in, check_out);
create index idx_reservations_status       on reservations(organization_id, status);
create index idx_reservation_items_bed     on reservation_items(bed_id, check_in, check_out);
create index idx_reservation_items_res     on reservation_items(reservation_id);
create index idx_beds_room                 on beds(room_id);
create index idx_rooms_org                 on rooms(organization_id);
create index idx_memberships_user          on memberships(user_id);
create index idx_guests_doc_hash           on guests(organization_id, document_hash);
create index idx_scan_sessions_token       on scan_sessions(token);
create index idx_audit_log_org             on audit_log(organization_id, created_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table organizations      enable row level security;
alter table memberships        enable row level security;
alter table room_types         enable row level security;
alter table rooms              enable row level security;
alter table beds               enable row level security;
alter table guests             enable row level security;
alter table reservations       enable row level security;
alter table reservation_items  enable row level security;
alter table scan_sessions      enable row level security;
alter table audit_log          enable row level security;

-- Helper: get all org IDs the current user belongs to
create or replace function get_user_org_ids()
returns setof uuid
language sql security definer stable
as $$
  select organization_id from memberships where user_id = auth.uid()
$$;

-- Helper: check if current user is owner/manager of an org
create or replace function is_org_admin(org_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and organization_id = org_id
      and role in ('owner', 'manager')
  )
$$;

-- Organizations
create policy "members_select_org" on organizations for select
  using (id in (select get_user_org_ids()));
create policy "admins_update_org" on organizations for update
  using (is_org_admin(id));

-- Memberships
create policy "members_select_memberships" on memberships for select
  using (organization_id in (select get_user_org_ids()));
create policy "admins_manage_memberships" on memberships for all
  using (is_org_admin(organization_id));

-- Room types, rooms, beds — all org members can read/write
create policy "members_all_room_types" on room_types for all
  using (organization_id in (select get_user_org_ids()));
create policy "members_all_rooms" on rooms for all
  using (organization_id in (select get_user_org_ids()));
create policy "members_all_beds" on beds for all
  using (organization_id in (select get_user_org_ids()));

-- Guests
create policy "members_all_guests" on guests for all
  using (organization_id in (select get_user_org_ids()));

-- Reservations + items
create policy "members_all_reservations" on reservations for all
  using (organization_id in (select get_user_org_ids()));
create policy "members_all_reservation_items" on reservation_items for all
  using (organization_id in (select get_user_org_ids()));

-- Scan sessions (also readable via public token for the phone capture page)
create policy "members_select_scan_sessions" on scan_sessions for select
  using (organization_id in (select get_user_org_ids()));
create policy "members_insert_scan_sessions" on scan_sessions for insert
  with check (organization_id in (select get_user_org_ids()));

-- Audit log — read only for members, insert via service role
create policy "members_select_audit_log" on audit_log for select
  using (organization_id in (select get_user_org_ids()));

-- ─── Functions & Triggers ────────────────────────────────────────────────────

-- Auto-generate reservation_number like RES-26-0001
create or replace function generate_reservation_number(org_id uuid)
returns text language plpgsql as $$
declare
  next_num int;
  year_str text;
begin
  year_str := to_char(now(), 'YY');
  select count(*) + 1 into next_num
  from reservations
  where organization_id = org_id
    and extract(year from created_at) = extract(year from now());
  return 'RES-' || year_str || '-' || lpad(next_num::text, 4, '0');
end;
$$;

create or replace function trg_set_reservation_number()
returns trigger language plpgsql as $$
begin
  if new.reservation_number is null or new.reservation_number = '' then
    new.reservation_number := generate_reservation_number(new.organization_id);
  end if;
  return new;
end;
$$;

create trigger reservation_number_trigger
  before insert on reservations
  for each row execute function trg_set_reservation_number();

-- Auto-update updated_at
create or replace function trg_update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger organizations_updated_at before update on organizations
  for each row execute function trg_update_updated_at();
create trigger guests_updated_at before update on guests
  for each row execute function trg_update_updated_at();
create trigger reservations_updated_at before update on reservations
  for each row execute function trg_update_updated_at();

-- ─── Seed data — replace with your boss's real hostel ────────────────────────
-- Run this AFTER creating your user via Supabase Auth signup

-- 1. Create org (replace 'your-user-id' with your actual Supabase user UUID)
-- insert into organizations (name, slug, city, country, timezone)
-- values ('Hostel El Ejemplo', 'hostel-el-ejemplo', 'Medellín', 'COL', 'America/Bogota')
-- returning id;

-- 2. Add yourself as owner (replace both UUIDs)
-- insert into memberships (organization_id, user_id, role)
-- values ('<org-id-from-step-1>', '<your-user-id>', 'owner');

-- 3. Create room types
-- insert into room_types (organization_id, name, type, gender, capacity, base_price)
-- values
--   ('<org-id>', '8-Bed Mixed Dorm', 'dorm', 'mixed', 8, 15.00),
--   ('<org-id>', 'Private Double', 'private', null, 2, 45.00);

-- 4. Create rooms
-- insert into rooms (organization_id, room_type_id, name)
-- values ('<org-id>', '<dorm-type-id>', 'Dorm A');

-- 5. Create beds
-- insert into beds (organization_id, room_id, name, position)
-- values
--   ('<org-id>', '<room-id>', 'Bed 1', 1),
--   ('<org-id>', '<room-id>', 'Bed 2', 2);
