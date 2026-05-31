-- ─────────────────────────────────────────────────────────────────────────────
-- Serbia Guest Registration Fields
-- Run this AFTER schema.sql
--
-- Serbian law requires hostels to register all foreign guests with the
-- police ("prijava stranaca"). These fields match the BOOK tab in Hostel
-- Darko's Excel sheet and the official tourist registration form.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add Serbia-specific fields to guests table
alter table guests
  add column if not exists place_of_birth        text,           -- Mesto rodjenja
  add column if not exists country_of_birth      text,           -- Drzava rodjenja
  add column if not exists place_of_residence    text,           -- Mesto stanovanja
  add column if not exists country_of_residence  text,           -- Drzava stanovanja
  add column if not exists unique_master_citizen text,           -- JMBG (Serbian citizens only)
  add column if not exists document_expiry       date,           -- Datum isteka dokumenta
  add column if not exists document_issued_place text,           -- Mesto izdavanja dokumenta
  add column if not exists document_issued_date  date;           -- Datum izdavanja dokumenta

-- Add Serbia-specific fields to reservations table
alter table reservations
  add column if not exists entry_place_serbia    text,           -- Mesto ulaska u Srbiju (e.g. "Beograd")
  add column if not exists entry_date_serbia     date,           -- Datum ulaska u Srbiju
  add column if not exists stay_approved_until   date,           -- Odobren boravak do
  add column if not exists service_type         text default 'prenociste',  -- Vrsta usluge (overnight = Prenoćište)
  add column if not exists key_deposit_paid     boolean default false,
  add column if not exists key_deposit_item     text,           -- Passport / ID / €10 / 1200 din
  add column if not exists city_tax_paid        boolean default false,
  add column if not exists city_tax_amount      numeric(10,2) default 0;

-- Index for quick Serbia-required lookup
create index if not exists idx_guests_document
  on guests(organization_id, document_type, document_number);
