# OTA Channel Manager — Setup Guide

How to connect your beds and dorms to OTAs (Airbnb, Booking.com, VRBO,
Hostelworld) using iCal calendar sync, and how to configure each side.

## How it works

The channel manager syncs **availability** (blocked dates) in both directions
using iCal calendar feeds:

- **Import** — the app reads the OTA's iCal feed and creates/updates/cancels
  reservations from its events.
- **Export** — the app publishes an Export URL per channel; the OTA reads it
  and blocks the dates you've sold elsewhere (direct bookings, other OTAs).

iCal carries **dates only, no prices** — OTA reservations arrive with a price
of 0 for staff to fill in. OTAs re-read your Export URL roughly every 1–12
hours (Airbnb ~4h); imports run when you press Sync or via the scheduled
sync-all job.

## Two mapping modes

| Mode | What it means | When to use |
|---|---|---|
| **Bed** | Channel is pinned to one physical bed | Private rooms; per-bed dorm listings |
| **Room type (pooled)** | Channel sells from the room type's pool; each incoming booking auto-assigns any free bed | Dorms — flexible, sells more nights |

Why pooled mode matters: with bed mapping, if a walk-in takes bed 101, that
listing shows closed even when 5 other beds are free. With room-type mapping
the listing stays open until the whole pool is exhausted.

## ⚠️ Booking.com limitation

Booking.com only offers iCal sync for **single-unit properties** (apartments,
vacation homes). Hotel/hostel properties with multi-unit room types ("Bed in
6-bed dorm" × 6 units) require a certified connectivity partner — not
possible over iCal. For Booking.com dorms, either use the per-bed-listing
workaround (Example 2) where available, or wait for the API/aggregator
integration. Airbnb and VRBO provide iCal per listing.

---

## Example 1 — Private room (bed mode)

**On the OTA:** one listing, "Private Double Room", 1 unit. Open its calendar
sync settings: copy the OTA's **iCal export URL**; you'll paste the app's URL
back here in a moment.

**In the app:** Channels → *Individual beds* → the room's bed → **Connect
OTA** → pick the platform, paste the OTA's iCal URL → save → copy the
channel's **Export URL** → paste it into the OTA's "import calendar" field.

**What arrives:** each OTA reservation is one VEVENT:

```
BEGIN:VEVENT
UID:abc123@airbnb.com          ← stable id (dedupe / updates / cancellations)
DTSTART;VALUE=DATE:20260810    ← check-in
DTEND;VALUE=DATE:20260813      ← check-out
SUMMARY:Reserved - John (HMABC123)
END:VEVENT
```

The app creates one confirmed reservation on that bed and auto-creates a
guest from the summary.

## Example 2 — Dorm with one listing per bed (bed mode)

**On the OTA:** create one listing per bed — "Bed 1 in 6-bed dorm", "Bed 2…",
each 1 unit, each with its own iCal feed.

**In the app:** one channel per listing, each mapped to its physical bed.

**Drawback:** rigid. A walk-in on bed 101 closes listing 1 even if the other
five beds are free. Prefer Example 3 for dorms.

## Example 3 — Dorm with pooled beds (room-type mode) ★ recommended

**On the OTA (e.g. Airbnb):** create N identical listings, e.g. 4 × "Bed in
6-bed mixed dorm" — no specific bed, each with its own iCal.

**In the app:** Channels → *Room types (pooled beds)* → your dorm → **Connect
OTA** once per listing (4 channels, all on the same room type). Exchange the
iCal URLs both ways for each.

**Behaviour:**

- **Incoming** — every reservation auto-assigns any free bed in the dorm.
  Assignment is atomic (serialized per room type), so simultaneous syncs
  can't grab the same bed.
- **Outgoing** — each Export URL only blocks dates when the whole pool is
  exhausted, not when one particular bed is taken.
- **Overbooking** — if a booking arrives and no bed is free, staff get an
  OVERBOOKING notification instead of the booking being dropped silently.
- **Date changes** — if the OTA moves a booking's dates and the assigned bed
  now clashes, the app reassigns to another free bed automatically.

## Example 4 — Hold beds back for walk-ins (allotment)

Same setup as Example 3, but the hostel wants to sell at most 4 of the 6
dorm beds online and keep 2 for the front desk.

**In the app:** set **Allotment = 4** on the channel (at connect time or via
edit).

**Effect:** the Export URL blocks dates once only 2 beds remain free
(`sellable = free − (total − allotment)`). The last 2 beds are never sold
through that channel.

---

## Configuration cheat-sheet

| Client scenario | On the OTA | In the app |
|---|---|---|
| Private room | 1 listing, iCal on | 1 channel, **bed** mode |
| Dorm, per-bed control | 1 listing per bed | N channels, **bed** mode |
| Dorm, flexible (recommended) | N "bed in dorm" listings | N channels, **room-type** mode, same room type |
| Dorm + walk-in reserve | same | + **allotment** |
| Booking.com multi-unit hotel | ❌ no iCal | needs API/aggregator (future) |

## Troubleshooting

- **"No bed assigned to this channel"** — bed-mode channel without a bed;
  edit the channel and pick a bed, or use room-type mode.
- **OVERBOOKING notification** — a booking arrived with no free bed. Free a
  bed (move/cancel something) and press Sync again; the event is retried on
  every sync until it fits.
- **Reservation shows €0** — expected: iCal doesn't carry prices. Open the
  reservation and set the rate in Payment & Folio.
- **OTA still shows dates open after a direct booking** — OTAs poll your
  Export URL on their own schedule (up to ~12h). The URL itself is always
  current; you can verify by opening it in a browser.
- **Sync error / last_error on the channel** — the OTA feed URL is wrong or
  expired. Re-copy the iCal URL from the OTA and update the channel.

---

## For developers: testing without a real OTA listing

### Option A — Google Calendar as a fake OTA

Create a calendar, copy its **secret iCal address** (Settings → Integrate
calendar) and use it as a channel's iCal URL. Every event you add behaves
like an OTA booking; moving/deleting events exercises the update and
cancellation paths. Subscribe to the channel's Export URL from Google
Calendar ("From URL") to inspect the outgoing blocks visually.

### Option B — built-in mock OTA endpoint

`GET /api/dev/mock-ota` emits iCal feeds that replicate each platform's real
format (Airbnb `Reserved - HM…` + owner blocks, Booking.com's opaque
`CLOSED - Not available`, VRBO's `Reserved - {name}`). Disabled in production
unless `ALLOW_MOCK_OTA=true`.

| Param | Effect |
|---|---|
| `platform` | `airbnb` \| `booking_com` \| `vrbo` — feed format |
| `events` | number of bookings (default 2, max 20) |
| `nights` | nights per booking (default 2) |
| `start` | days from today of the first check-in (default 7) |
| `gap` | days between bookings; `0` stacks them on the same dates |
| `seed` | UID namespace — same seed = same UIDs across calls |
| `shift` | move ALL dates by N days, same UIDs → tests the update/reassign path |
| `drop=1` | omit the first event → tests orphan cancellation |
| `cancelled=1` | first event carries `STATUS:CANCELLED` |
| `block=1` | appends an owner "Not available" block (Airbnb/VRBO style) |

Test matrix (channel on a 6-bed dorm, room-type mode):

```
# 1. create: 3 bookings, same dates → 3 reservations, beds auto-assigned
/api/dev/mock-ota?platform=airbnb&events=3&seed=t1

# 2. idempotency: sync the same URL again → 0 created
# 3. update: shift dates 2 days, same UIDs → 3 updated (reassigned if needed)
/api/dev/mock-ota?platform=airbnb&events=3&seed=t1&shift=2

# 4. cancel: drop one → 1 cancelled on next sync
/api/dev/mock-ota?platform=airbnb&events=2&seed=t1&shift=2

# 5. overbooking: 7 stacked bookings on 6 beds → 6 created + OVERBOOKING alert
/api/dev/mock-ota?platform=booking_com&events=7&seed=t2

# 6. naming: booking_com summaries are "CLOSED - Not available" — guests must
#    be created as "Booking.com Guest", never the literal summary
```
