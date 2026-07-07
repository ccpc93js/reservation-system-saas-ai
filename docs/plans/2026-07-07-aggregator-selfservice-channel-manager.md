# Self-service OTA Channel Manager via Aggregator (Channex)

Date: 2026-07-07
Status: DESIGN — build when there are paying customers who need real OTA sync
Prerequisite reading: `2026-07-06-multibed-and-channel-manager.md` (Phase A/B, shipped)

## Problem

The current channel manager is iCal-based. It is already 100% self-service
(customers paste URLs themselves, guided by the Help Center), but iCal is
structurally limited: no prices, no real guest data, no multi-bed bookings in
one event, polling latency of hours, and **no Booking.com support for
multi-unit room types at all**.

Real OTA connectivity requires certified API partnerships per OTA
(Booking.com Connectivity Partner, Airbnb API, Hostelworld partner program) —
months of certification each, minimum property counts. Not viable directly.

## The aggregator model

An aggregator already holds those certifications. We integrate ONE API and it
relays every OTA:

```
Booking.com ─┐
Airbnb      ─┤── Aggregator (Channex) ──► JSON API + webhooks ──► our app
Hostelworld ─┘      (certified)
```

What it adds over iCal:

| Capability | iCal (today) | Aggregator API |
|---|---|---|
| Prices & rate breakdown | ❌ (reservations arrive at 0) | ✅ full payload |
| Real guest name/email/phone | ❌ (placeholder guests) | ✅ |
| Multi-bed booking in ONE reservation | ❌ (1 event = 1 bed) | ✅ units/quantity |
| Availability push | busy-date blocks only | ✅ numeric ("4 beds free") |
| Latency | OTA polls every 1–12 h | ✅ instant webhooks |
| Booking.com multi-unit dorms | ❌ impossible | ✅ |

## CRITICAL: the white-label / self-service requirement

The app is sold as SaaS — customers must configure everything themselves.
This rules out aggregators where each customer needs their own account.

**We sign ONE partner agreement and hold ONE master API key.** Customers
never see or know the aggregator. Everything per customer is created
programmatically through our backend:

- `POST /properties` — created automatically when the customer activates the feature
- `POST /room_types` + rate plans — **mirrored from our own DB** (room_types/beds already exist)
- channel mappings, availability push, booking webhooks — all API-driven

### The customer's self-service flow (target UX)

1. In our app: **"Connect Booking.com"** button on the Channels page.
2. Our backend auto-creates the property + room types in the aggregator.
3. The app shows the ONE manual step no technology can remove: in their
   Booking.com extranet → *Account → Connectivity provider → select
   "[OurApp]" → confirm*. This is the OTA-side authorization handshake
   (OAuth-like); every channel manager on earth works this way. Two clicks
   in the customer's own OTA account, guided by a Help Center article with
   screenshots. (Airbnb uses an OAuth redirect instead — even smoother.)
4. A webhook confirms the connection → our app auto-maps room types →
   done. Bookings flow in, availability flows out. **Zero work per
   customer for us.**

### Why Beds24 does NOT fit

Beds24 is a full PMS+CM aimed at hotels using it directly. Its API assumes
each property owns a Beds24 account (separate signup, separate billing,
their dashboard) — breaks white-label and self-service. That's why its
partner/API story looks unclear: third-party PMS vendors are not its
primary case.

### Aggregator comparison

| Aggregator | Fit | Notes |
|---|---|---|
| **Channex.io** | ★ best | API-first, built specifically for PMS vendors (white-label), free sandbox, ~$10–15/property/month, Booking.com/Airbnb/Expedia/Agoda/VRBO |
| myallocator (Cloudbeds) | good for hostels | Hostel heritage, strong Hostelworld support, PMS-partner program via Cloudbeds |
| Beds24 | ✗ | Cheap and open API, but per-customer accounts — not white-label |
| Direct OTA certification | later | Only worth it at large scale; months per OTA |

## Billing model

Channex bills US per connected property (~$10–15/mo). Options:

- absorb into the Pro plan price, or
- sell as an add-on ("Channel Manager Pro") with margin.

One contract (ours). No per-customer paperwork.

## Architecture: thin adapter over existing primitives

Phase B already built the domain layer; the aggregator integration is an
adapter, not a rewrite:

```
Channex webhook (booking.created) ─► adapter ─► create_ota_reservation_room_type()
                                                 (extend with p_quantity for multi-unit)
reservation change (any source)   ─► recompute ─► free_beds(room_type, dates)
                                                 ─► adapter ─► Channex availability push
```

Components to build:

1. **`channex` provider module** (`src/lib/channels/channex.ts`) — API client
   with the master key; property/room-type CRUD, availability update,
   webhook signature verification.
2. **Provisioning flow** — on "Connect OTA (API)": create property + mirror
   room_types → store `channex_property_id` / `channex_room_type_id`
   (new columns or a `channel_provider_links` table).
3. **Webhook endpoint** (`/api/channels/channex/webhook`) — booking
   created/modified/cancelled → map to reservation create/update/cancel.
   Multi-unit bookings: extend the room-type RPC with `p_quantity` (assign N
   free beds atomically — same advisory-lock pattern).
4. **Availability push job** — after any reservation create/cancel/date
   change, debounce and push `free_beds` per room type per date range to
   Channex. (Trigger points already centralized in the API routes.)
5. **UI** — Channels page gains an "API connection" tier above iCal:
   connect wizard, per-OTA status, mapping review. Help Center articles
   with extranet screenshots per OTA.
6. **Prices** — decision made 2026-07-07: keep OTA price handling as-is
   (iCal reservations stay at 0). With Channex, real prices arrive in the
   payload → write them into reservation_items directly.

## Build order

1. Channex sandbox account + spike: create property, push availability,
   receive test booking webhook end-to-end.
2. `p_quantity` support in the room-type RPC (multi-unit auto-assign).
3. Provisioning + webhook + availability push behind a feature flag.
4. Self-service connect wizard + Help Center articles.
5. First real customer property as pilot; then open to all Pro plans.

## What stays as-is

- iCal channels remain supported forever (free tier / simple cases / OTAs
  without aggregator coverage). The two tiers coexist on the Channels page.
- All Phase A/B primitives (`free_beds`, auto-assign RPC, overbooking
  notifications, folio) are shared by both tiers.

## Open questions (answer at build time)

- Channex vs myallocator: does the customer base skew hostel-dorm enough
  that Hostelworld coverage decides it?
- Pricing: absorb vs add-on, and at what price point.
- Rate push: do we also push prices to OTAs (needs a rate-plan editor in
  the app), or availability-only for v1? (Recommend availability-only v1.)
