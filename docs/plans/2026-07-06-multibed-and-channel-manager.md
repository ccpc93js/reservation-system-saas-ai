# Multi-bed reservations & room-type channel manager

Date: 2026-07-06
Status: Phase A shipped 2026-07-06 · Phase B (iCal-scope) shipped 2026-07-07 —
B1 schema + free_beds, B3 ingestion auto-assign (single-unit iCal events),
B2 export as blocked-date ranges, B4 overbooking notifications, B5 UI.
Still open: true multi-unit ingestion + numeric availability push (needs an
OTA API / aggregator, not possible over iCal).

## Problem

A single reservation must be able to span several beds — e.g. a group books
6 beds in an 8-bed dorm as one booking, one confirmation number, one lead
guest. Real hostel PMS and OTAs (Booking.com, Hostelworld) model dorms as a
*pooled room-type with an allotment*, not as N separate rooms. Our channel
manager must interoperate with that.

## How the industry works (reference)

Three inventory levels:

- **Physical bed** — the real unit (`beds`).
- **Room type (dorm)** — a pool of N identical, interchangeable beds
  (`room_types`).
- **OTA listing** — sold at room-type level with an *allotment* = number of
  beds currently free. The OTA does not care which physical bed.

When a guest books "6 beds in a dorm":

1. OTA creates ONE booking: room-type = "dorm bed", units = 6, one lead guest,
   one confirmation number.
2. The channel manager receives it as one reservation of "6 units of room-type X".
3. The PMS **auto-assigns** 6 physical beds internally. The guest never picks a bed.

Availability sync (PMS → OTA): push, per room-type per date, the number of
free beds. After *any* booking anywhere, recompute the free count and re-push
to every channel so nobody oversells.

Booking ingestion (OTA → PMS): the OTA pushes a booking with room-type + N
beds → the PMS creates a reservation and auto-assigns N free beds.

### The iCal limitation

Our current channel manager is **iCal, per-bed** (`channels.bed_id`). iCal is
a per-unit busy/free feed — it cannot express "6 of 8 beds booked" as a single
booking. It works for:

- Private rooms (one unit), and
- Dorms only if every bed is listed as a *separate room* on the OTA (clumsy,
  and most hosts don't do this).

**True dorm sync with Booking.com / Hostelworld needs their APIs (XML /
partner API) or an aggregator (Beds24, Cloudbeds, NightsBridge).** iCal stays
as a stopgap for private rooms and per-bed listings.

## Data model

Already in place and sufficient for multi-bed:

```
reservations (1) ──< reservation_items (N)   -- each item = one bed + dates + price
reservations (1) ──< reservation_guests (N)  -- lead + companions
```

The core availability primitive that drives dorm booking, calendar counts,
AND channel allotment:

```
free_beds(room_type, from, to)
  = count(active beds in room_type)
  − count(distinct beds with an overlapping reservation_item
          whose reservation.status not in (cancelled, checked_out, no_show))
```

## Phase A — Multi-bed direct bookings — SHIPPED 2026-07-06

- `POST /api/reservations/create` accepts `bed_ids[]` (single `bed_id` kept as
  anchor/fallback for OTA imports). Conflict-checks every bed, inserts one
  item per bed, `total_amount = nights × rate × beds`.
- `GET /api/reservations/availability?room_id=…` returns per-bed availability
  for a room (`beds[]`, `free_count`, `total_count`).
- New-reservation drawer: for multi-bed rooms, a quantity stepper
  (auto-assign N free beds, anchor prioritised) + explicit bed checkboxes +
  "Whole room". Price summary shows `nights × beds`.
- Confirmation email / staff notification show `Room · N beds`.

Not included: per-bed guest assignment (guests stay at reservation level),
splitting a group across rooms in one action (staff can multi-select beds
across the room; cross-room needs separate bookings for now).

## Phase B — Room-type channel manager — DESIGN (not built)

### B1. Channel ↔ room-type mapping

Move channels from per-bed to per-room-type with an allotment cap:

```sql
alter table channels
  add column room_type_id uuid references room_types(id) on delete set null,
  add column allotment int,          -- max beds exposed to this channel (null = all)
  add column mapping_mode text default 'bed';  -- 'bed' (legacy iCal) | 'room_type'
```

Keep `bed_id` + `mapping_mode='bed'` for existing private-room / per-bed iCal
channels. New dorm channels use `mapping_mode='room_type'`.

### B2. Availability push (PMS → OTA)

- Compute `free_beds(room_type, date)` per day across the calendar horizon.
- Subtract the channel's allotment cap if set.
- Push to the OTA:
  - iCal export mode: aggregate busy blocks (only correct when allotment = 1).
  - API mode (Booking.com / Hostelworld / aggregator): push a numeric
    availability per room-type per date. **Required for real dorm sync.**
- Trigger a re-push after every reservation create/cancel/date-change
  (debounced) to prevent oversell.

### B3. Booking ingestion (OTA → PMS)

- Replace/extend `create_ota_reservation` to take `room_type_id` + `quantity`.
- Auto-assign: pick `quantity` free beds in that room-type for the dates
  (atomic; fail → mark channel error + notify, do not oversell).
- Insert one reservation + N items. Store `external_id`, `channel_id`.
- Idempotent on `(channel_id, external_id)` as today.

### B4. Overbooking protection

- Availability recompute is the single source of truth.
- On conflict at ingestion (allotment race), create the reservation flagged
  `overbooking` for staff to resolve rather than silently dropping — matches
  how CMs surface oversell.

### B5. UI

- Channel form: choose room-type + allotment (or legacy single bed).
- Channel dashboard: show pushed availability per room-type, last sync,
  oversell warnings.

### Build order for B

1. Schema (B1) + `free_beds` SQL function.
2. Ingestion with auto-assign (B3) — highest value, reuses Phase A assignment.
3. Availability push, API mode for one provider (B2).
4. Overbooking flagging (B4) + UI (B5).

### Open decision

Which OTA integration first? Options: (a) aggregator (Beds24/Cloudbeds) — one
integration, many OTAs, fastest; (b) Booking.com direct XML — most demand,
most work; (c) keep iCal + document the per-bed-listing workaround for now.
Recommendation: (a) aggregator when Phase B is scheduled.
