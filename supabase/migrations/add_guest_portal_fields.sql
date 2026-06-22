-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9: Guest Self-Service Portal — Schema Migration
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

-- Add new columns to reservations table
alter table reservations
add column if not exists check_in_token uuid unique default uuid_generate_v4();

alter table reservations
add column if not exists self_check_in_submitted_at timestamptz;

alter table reservations
add column if not exists self_check_in_data jsonb;

alter table reservations
add column if not exists id_photos jsonb;

alter table reservations
add column if not exists check_in_verified_at timestamptz;

alter table reservations
add column if not exists check_in_verified_by uuid references auth.users(id) on delete set null;

-- Add indexes for performance
create index if not exists idx_reservations_check_in_token on reservations(check_in_token);
create index if not exists idx_reservations_self_check_in on reservations(organization_id, self_check_in_submitted_at desc);
