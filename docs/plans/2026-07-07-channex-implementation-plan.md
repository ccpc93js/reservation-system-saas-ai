# Channex Integration — Implementation Plan

Date: 2026-07-07
Status: PLAN — execute when 1–2 paying customers need real OTA sync
Design rationale: `2026-07-07-aggregator-selfservice-channel-manager.md`
Build aid: the `channex-pms-integration` skill is installed at
`.claude/skills/channex-pms-integration/` (SKILL.md + references/api.md with
verified endpoint shapes). Invoke it when implementing any phase below.

## Guiding decision

**iCal stays.** The existing iCal channel manager (bed + room-type modes)
remains fully supported as the free/simple tier. Channex is ADDED as a second
connection type — "API connection" — on the same Channels page. Both tiers
share the Phase B primitives (`free_beds`, auto-assign RPC, overbooking
notifications, folio).

```
Channels page
├── API connections (Channex)   ← new, Pro plan
│     Booking.com · Airbnb · Expedia · …  (real prices, guests, multi-bed)
└── iCal connections            ← existing, unchanged
      per-bed and room-type pooled channels
```

---

## Part 1 — Business steps (you, no code)

1. **Create a free sandbox account** at Channex staging
   (docs at docs.channex.io; staging environment is free, no contract).
   Get a test API key. Nothing to lose — do this anytime.
2. **Read their PMS integration guide** and note the current shape of:
   properties, room types, rate plans, ARI (availability/rates/inventory)
   updates, booking webhooks, and the channel-mapping flow (they provide a
   white-label iframe/wizard for the OTA connection step — verify current
   options in their docs).
3. **Apply as PMS partner** — Channex has a certification/partner process
   for PMS vendors (self-serve test checklist + review). Ask explicitly for:
   - white-label terms (customers must not need a Channex account/dashboard)
   - per-property pricing at your expected volumes (~$10–15/property/mo)
   - which OTAs are available at launch (confirm Hostelworld coverage —
     if missing and your customers need it, evaluate myallocator as a
     complement later)
4. **Sign + get the production master API key.** One contract, yours.
5. **Set your pricing**: fold into Pro or sell as an add-on
   ("Channel Manager Pro") with margin over the per-property fee.

Everything in Part 2 can be built against the sandbox before any contract.

---

## Part 2 — Technical implementation (phases)

### Phase 1 — Schema & provider plumbing  ✅ DONE (2026-07-21)

Built against staging; `GET /properties` returns 200 and lists the org's
property. Migration `supabase/migrations/20260721_channex_phase1.sql`, client
`src/lib/channels/channex.ts`, connectivity route
`GET /api/channels/channex/ping`. Mapping stored as a generic
`channel_provider_links (kind, local_id) → channex_id` table (serves
property/room_type/rate_plan now, booking dedupe later) rather than per-column.

- `channels` table: add `provider text not null default 'ical'`
  (`'ical' | 'channex'`). Existing rows untouched.
- New table `channel_provider_links` (or columns): per-org Channex ids —
  `channex_property_id`, and per room type `channex_room_type_id`,
  `channex_rate_plan_id`.
- Env: `CHANNEX_API_KEY`, `CHANNEX_BASE_URL` (staging vs prod),
  `CHANNEX_WEBHOOK_SECRET`.
- `src/lib/channels/channex.ts` — thin API client (fetch wrapper with the
  master key): createProperty, upsertRoomType, upsertRatePlan, updateARI,
  verifyWebhookSignature.

### Phase 2 — Provisioning (self-service "Connect")  ✅ DONE (2026-07-21)

App-driven, fully white-label — owner never opens Channex. `provisionOrg`
(`src/lib/channels/channex-provision.ts`) mirrors property → room types →
one rate plan each from PMS data, idempotent (POST unmapped / PUT mapped),
ids stored in `channel_provider_links`. Route `POST
/api/channels/channex/provision` (manager-only, 200 ok / 207 partial).
Mapping: dorm → per-bed (count_of_rooms = active beds, occ 1); private →
per-room (count_of_rooms = rooms, occ = capacity). Write payloads verified
against staging; `occ_children`/`occ_infants` required (0) despite docs.
NOTE: needs the Phase 1 migration applied first (writes channel_provider_links).

- API route `POST /api/channels/channex/provision`:
  1. create the Channex property from the org's data (name, address,
     currency, timezone — all already in `organizations`),
  2. mirror every `room_type` (capacity from bed count) + one rate plan
     each (base_price),
  3. store the ids in `channel_provider_links`.
- Idempotent: re-running syncs changes (renamed room types, new dorms).
- Re-provision hook: when a room type / bed count changes in the app,
  update Channex (or flag "out of sync" + a Sync Structure button — simpler
  v1).

### Phase 3 — Booking ingestion (webhook)  ✅ DONE (2026-07-22)

Feed poller + webhook, both funneling into `applyRevision`
(`src/lib/channels/channex-bookings.ts`). Migration
`20260722_channex_phase3_bookings.sql` adds `create_channex_reservation`
(multi-bed atomic assign under one advisory lock, real prices, null on
overbooking) + a partial index on `reservations(external_id)`. Routes:
`POST /api/channels/channex/feed` (cron/manager, drains account-wide feed,
acks on success, leaves hard errors un-acked + alerts) and `POST
/api/channels/channex/webhook` (shared-secret, pulls revision by id → apply
→ ack). new → create; cancelled → cancel by external_id; modified → flag +
notify a human (no auto-mutate); overbooking → notify, book nothing. Dedupe
by Channex booking_id in `reservations.external_id`. TODO: schedule the
poller (no vercel.json cron yet) and register the webhook once per env.

- `POST /api/channels/channex/webhook` — signature-verified.
- Events: booking new / modification / cancellation.
- Map payload → existing flow:
  - guest: real name/email/phone → create or match guest (reuse duplicate
    detection),
  - **multi-unit**: extend `create_ota_reservation_room_type` with
    `p_quantity int default 1` — assign N free beds under the same advisory
    lock, N reservation_items, ONE reservation,
  - prices: real `price_per_night`/`total_price` from the payload (replaces
    the iCal price-0 behavior for this tier),
  - modifications: date/occupancy changes reuse the reassignment logic,
  - cancellations: status update + per-reservation notification (existing).
- Overbooking (no N free beds): create nothing, notify OVERBOOKING
  (existing pattern), respond so Channex retries/flags.
- Idempotency: store Channex booking id in `external_id` (existing column),
  dedupe on it.

### Phase 4 — Availability push (ARI)  ✅ DONE (2026-07-22)

`pushAvailabilityForOrg` (`src/lib/channels/channex-availability.ts`) computes
free beds per room type from the PMS and pushes to Channex. Migrations
`20260722_channex_phase4_*` add `free_beds_calendar` (per-night) and
`free_beds_ranges` (gaps-and-islands SQL compression — one row per run, avoids
PostgREST's 1000-row cap that first truncated the push to 3 of 7 room types).
Scoped push fires inline in `applyRevision` after create/cancel (stay window);
full-horizon reconcile via `POST /api/channels/channex/push-availability`
(cron = all provisioned orgs / manager = own org, 365-day horizon). Verified on
staging: all 7 room types readback-correct; a 3-bed booking decremented Blue
Dorm 6→3 on the stay nights and back to 6 on checkout day. Never sends past
dates. Direct app-booking paths (create/cancel/update-dates/extend) now call
`syncAvailabilityWindow` inline (committed 3311bed) — VERIFIED live: an app
booking dropped Channex 6→3 within seconds, and the reconcile route corrected a
booking whose inline push had failed (drift → 2). Still TODO: the iCal-sync
path (bed-level model; nightly reconcile covers it meanwhile).

- After ANY reservation create/cancel/date-change (all sources, including
  direct bookings and iCal syncs): debounce (~5–10 s) then push
  `free_beds(room_type, date)` per affected date range to Channex
  `updateARI`.
- Implementation: a small queue table or in-process debounce keyed by
  `(org, room_type)`; a scheduled reconcile job (daily full push over a
  365-day horizon) as safety net against drift.
- Allotment: reuse the existing per-channel allotment semantics if exposed
  per OTA in Channex; otherwise property-level for v1.

### Phase 5 — UI & self-service onboarding  ✅ DONE (2026-07-22)

In-app white-label Connect flow. Backend: `channex-connect.ts`
(getConnectOptions → test_connection + mapping_details + our rate plans;
connectChannel → create+activate+persist as a channels row provider='channex';
disconnectChannel → deactivate+delete). Endpoints `POST
/api/channels/channex/connect/options`, `POST|DELETE
/api/channels/channex/connect` — manager-only, Pro-gated via
`hasFeature(plan,"channels")`. Migration `20260722_channex_phase5_*` adds
`channex_channel_id`/`hotel_id`/`channex_status` to channels. UI:
`ChannexSection` (Sync structure / Sync availability / connected list +
disconnect / Connect wizard with the manual OTA→rate-plan mapping screen),
mounted atop `ChannelsClient`; i18n keys added to all 11 locales (English
values — real translation pending). Channel API shapes verified live (groups,
test_connection, Booking.com mapping_details); create+activate is exercised per
real customer (needs the owner's hotel id + extranet authorization).
Follow-up: translate the new i18n keys; guided Booking.com extranet screen.

- Channels page: new "API connections" section above iCal:
  - **Connect** button per OTA → runs provisioning → shows the guided
    extranet step (Booking.com: Account → Connectivity provider → select
    us → confirm; Airbnb: OAuth redirect via Channex wizard/iframe),
  - connection status per OTA (pending / active / error) from Channex,
  - mapping review screen (our room types ↔ OTA rooms) — auto-mapped,
    editable.
- Paywall: feature-gate on plan (reuse `hasFeature(plan, "channels")` or a
  new `channels_api` feature flag for the add-on model).
- Help Center: new articles with per-OTA screenshots of the extranet step;
  update the OTA guide's Booking.com-limitation warning ("solved by the
  API connection").

### Phase 6 — Testing & rollout

- Sandbox end-to-end: provision test property → Channex test channel →
  push availability → fire test bookings (their sandbox can emit booking
  webhooks) → verify multi-unit auto-assign, prices, notifications, Guest
  Book flow.
- Load the webhook with the existing conflict tests (stacked bookings →
  overbooking path).
- Pilot: ONE real customer property behind a feature flag; watch a full
  week of bookings; then open to all Pro plans.

## Effort estimate

| Phase | Size |
|---|---|
| 1 Schema + client | small (1 session) |
| 2 Provisioning | small–medium |
| 3 Webhook + p_quantity | medium (the core) |
| 4 ARI push | medium (debounce + reconcile) |
| 5 UI + Help | medium |
| 6 Testing/pilot | ongoing |

Total: roughly 4–6 focused sessions against the sandbox, most of it
adapter code — the domain layer already exists.

## Explicit non-goals (v1)

- Rate push to OTAs (needs a rate-plan editor; availability-only v1 —
  prices continue to be managed inside each OTA).
- Replacing iCal — never; it stays as the free tier.
- Direct OTA certifications — only reconsider at large scale.
