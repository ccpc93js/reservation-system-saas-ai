## [688fe42] - 2026-07-07

docs: aggregator self-service channel manager design (Channex)

Design doc for the API-based channel manager phase: why an aggregator
(vs per-OTA certification), the white-label/self-service requirement -
ONE partner contract and master API key, per-customer provisioning done
programmatically so customers configure everything from our app (the
only manual step is the 2-click authorization in their OTA extranet).
Beds24 discarded (per-customer accounts break white-label); Channex.io
recommended. Includes capability comparison vs iCal, billing model,
adapter architecture over the existing Phase B primitives (free_beds,
auto-assign RPC + future p_quantity), build order, and open questions.
Price decision recorded: OTA reservations stay at 0 until real prices
arrive via the aggregator payload.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [54ced0f] - 2026-07-07

feat: per-reservation notifications from channel syncs

Syncs now emit the same per-reservation notifications as direct
bookings: each created OTA reservation raises reservation_created
("New reservation for {guest} ({number})") and each cancellation
(explicit STATUS:CANCELLED or orphaned event) raises
reservation_cancelled - both linking to the calendar. The aggregate
channel_synced summary now fires only for date-change updates, so
nothing is double-notified. Manual-sync triggerer still excluded.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [b17dc92] - 2026-07-07

feat: bell notification when a channel sync detects reservations

Syncs only notified on failure/overbooking. Now, when a sync creates,
updates or cancels reservations, staff get a channel_synced notification
("{channel}: N new, N updated, N cancelled") linking to the calendar.
No-change syncs stay silent. The user who triggered a manual sync is
excluded (they already see the toast); cron syncs notify everyone.
Wifi icon in the bell; i18n for all 11 locales.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [dabaa9c] - 2026-07-07

feat: mock OTA endpoint + realistic guest naming from OTA feeds

Test the channel manager end-to-end without owning a real OTA listing.

- GET /api/dev/mock-ota emits iCal feeds replicating each platform's
  documented format: Airbnb ("Reserved - HM..." + owner blocks +
  reservation-URL description), Booking.com (opaque "CLOSED - Not
  available" for everything), VRBO ("Reserved - {name}"). Deterministic
  UIDs via seed; params cover the whole sync surface: shift (update/
  reassign), drop (orphan cancellation), cancelled=1 (STATUS:CANCELLED),
  stacked events (overbooking), block=1 (owner blocks). Dev-only: 404 in
  production unless ALLOW_MOCK_OTA=true.
- Sync guest naming fixed: summaries carrying no real name ("CLOSED -
  Not available", "Reserved - HMXXXX", "Not available", "Blocked") fall
  back to the platform placeholder guest instead of creating guests
  literally named "CLOSED - Not available". VRBO-style names are
  extracted; the raw summary is preserved in guest notes.
- Developer testing guide (Google Calendar option, mock param table,
  6-step test matrix) appended to docs/guides/ota-channel-manager.md.
- Verified live: Airbnb and Booking.com feed shapes render correctly.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [unreleased] - 2026-07-07

feat: mock OTA endpoint + realistic guest naming from OTA feeds

Test the channel manager end-to-end without owning a real OTA listing:

- GET /api/dev/mock-ota emits iCal feeds replicating each platform's
  documented format — Airbnb ("Reserved - HM…" + owner blocks +
  reservation-URL description), Booking.com (opaque "CLOSED - Not
  available"), VRBO ("Reserved - {name}"). Deterministic UIDs (seed);
  params for update (shift), cancellation (drop / cancelled=1),
  overbooking (stacked events) and owner blocks. Dev-only (404 in prod
  unless ALLOW_MOCK_OTA=true).
- Sync guest naming fixed: summaries with no real name ("CLOSED - Not
  available", "Reserved - HMXXXX", "Not available", "Blocked") now fall
  back to the platform placeholder guest instead of creating guests
  literally named "CLOSED - Not available"; VRBO-style real names are
  extracted. Raw summary preserved in guest notes.
- Testing guide (Google Calendar option + mock param table + full test
  matrix) appended to docs/guides/ota-channel-manager.md.

## [9a96625] - 2026-07-07

docs: Help Center articles for every app section

Expanded the in-app Help Center from Channel Manager only to full
coverage: 17 searchable articles across 8 categories.

- Getting Started: property structure (room types/rooms/beds),
  navigation map
- Calendar & Bookings: tape calendar basics, multi-bed group bookings
- Reservations: the drawer, companion guests, add/remove beds,
  payment & folio
- Check-in & Guest Book: online check-in link/QR, pending review,
  per-occupant registry & CSV export
- Guests: profiles/ID scanning, duplicate merge
- Housekeeping: per-bed status board
- Settings & Billing: branding, team roles, plans
- Channel Manager: the existing 5 articles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [unreleased] - 2026-07-07

docs: Help Center articles for every app section

Expanded the Help Center from Channel Manager only to full coverage:
17 articles across 8 categories — Getting Started (property structure,
navigation map), Calendar & Bookings (tape basics, multi-bed groups),
Reservations (drawer, companions, add/remove beds, payment & folio),
Check-in & Guest Book (online link/QR, pending review, per-occupant
registry), Guests (profiles/ID scan, duplicate merge), Housekeeping
(board), Settings & Billing (branding, team roles, plans), plus the
existing 5 Channel Manager articles. All searchable.

## [f4221d7] - 2026-07-07

feat: in-app Help Center with search + OTA channel manager guide

Users can now self-serve documentation without support:

- New Help page (sidebar -> Help) with client-side search across
  article titles, summaries, keywords and body text, plus category
  filter chips and a full article view
- Typed article registry (src/lib/help/articles.ts) with structured
  blocks (steps, tables, callouts, code) so new sections plug in as
  they ship
- First category: Channel Manager - 5 articles covering how iCal sync
  works, private-room setup, pooled dorm setup with auto-assign,
  allotment for walk-ins, and troubleshooting (incl. the Booking.com
  multi-unit iCal limitation)
- Markdown companion guide at docs/guides/ota-channel-manager.md
- Articles in English; page chrome i18n for all 11 locales

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [unreleased] - 2026-07-07

feat: in-app Help Center with search + OTA channel manager guide

New Help section (sidebar → Help) with client-side search across article
titles, summaries, keywords and body text, category filters, and a typed
article registry (src/lib/help/articles.ts) ready to grow to every app
section. First category shipped: Channel Manager (5 articles — overview,
private room setup, pooled dorm setup, allotment, troubleshooting).
Articles in English; page chrome translated in all 11 locales. Companion
markdown guide at docs/guides/ota-channel-manager.md.

## [b014167] - 2026-07-07

feat: Phase B - room-type channel manager (pooled beds, auto-assign)

Channels can now map to a ROOM TYPE (pool of beds) instead of one fixed
bed, matching how real channel managers sell dorms.

- Schema: channels.mapping_mode (bed|room_type), room_type_id,
  allotment; free_beds(room_type, dates) SQL primitive
- Ingestion: create_ota_reservation_room_type RPC auto-assigns a free
  bed, serialized per room type via advisory lock; returns null when
  full and the sync then notifies OVERBOOKING instead of silently
  dropping; OTA date changes reassign the bed if the old one clashes
- Export: room-type channels export BLOCKED date ranges when no
  sellable bed remains (sellable = free minus held-back via allotment),
  180-day horizon, consecutive days merged
- Both OTA RPCs now record the primary guest in reservation_guests
- UI: Channels page gains a "Room types (pooled beds)" section with
  per-room-type OTA connect + optional allotment; inline allotment edit
- Regenerated DB types from live schema (was stale: missing
  reservation_guests, is_primary, channel fields, new RPCs)
- RPC verified in prod: assigned bed 101, free_beds 6->5->6 after
  cleanup; i18n for all 11 locales

Still open (needs OTA API/aggregator, impossible over iCal): multi-unit
bookings in one event and numeric availability push. Design doc updated.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [unreleased] - 2026-07-07

feat: Phase B — room-type channel manager (pooled beds, auto-assign)

Channels can now map to a ROOM TYPE (pool of beds) instead of one fixed
bed — how real channel managers sell dorms.

- Schema: channels.mapping_mode ('bed'|'room_type'), room_type_id,
  allotment; free_beds(room_type, dates) SQL primitive
- Ingestion: create_ota_reservation_room_type RPC auto-assigns a free
  bed (advisory-lock serialized per room type); returns null when full →
  sync notifies OVERBOOKING instead of silently dropping; date changes
  reassign the bed if the old one now clashes
- Export: room-type channels export BLOCKED date ranges when no sellable
  bed remains (sellable = free − held-back via allotment), 180-day horizon
- Both OTA RPCs now record the primary guest in reservation_guests
- UI: Channels page gains a Room types (pooled beds) section — connect
  OTA per room type with optional allotment; edit allotment inline
- Regenerated DB types; RPC verified in prod (assign, free-count, cleanup)
- i18n for all 11 locales

iCal limits remain: one event = one bed. True multi-unit bookings and
numeric availability push need an OTA API/aggregator (doc updated).

## [d8a1f90] - 2026-07-07

feat: per-occupant Guest Book entries (Serbian registry compliance)

The check-in registry now writes ONE row per guest on the reservation
(primary + companions), each with their own identity and document data,
as required by the Serbian knjiga gostiju / eTurista which register
every occupant individually.

- Migration: drop UNIQUE(reservation_id), add is_primary, partial
  unique index on (reservation_id, guest_id)
- Registry POST inserts a row per occupant and is idempotent per guest;
  adding a companion later re-enables Add to Guest Book and registers
  only the missing person (409 only when everyone is registered)
- Financials recorded only on the primary row so reports do not
  double-count; plan limit now counts per person
- Drawer "in book" state = every occupant registered; refreshes on
  companion add/remove
- Legacy single-row snapshots (null guest_id) treated as the primary
- Unique constraint verified in DB (multi-row OK, duplicate rejected)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [d9e7859] - 2026-07-07

fix: multi-bed audit - date edits and extensions now cover every bed

Audit found two pre-existing flows still assuming one bed per
reservation:

- update-dates used only the FIRST bed and rebuilt items per-night, so
  editing dates on a multi-bed reservation silently dropped the other
  beds, exploded the folio into per-night segments, counted cancelled
  stays as conflicts (no status filter) and rejected back-to-back dates
  (gte overlap). Now rebuilds one item per bed spanning the new stay
  with each bed rate kept, and conflict-checks every bed with the
  standard status filter and strict overlap. Trade-off: collapses prior
  extension segments into a single stay line.
- extend only extended the first bed (other beds were released mid-stay
  for the extension nights) and created per-night items. Now extends
  every bed with one item per bed for the extension range; conflict
  message names the blocking beds.

Also from the audit:
- reservations list shows "101 +3" for multi-bed bookings
- Guest Book snapshots record all bed names ("101, 102, 103")
- checkout already marked all beds dirty (verified, no change)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [unreleased] - 2026-07-07

fix: multi-bed audit — date edits and extensions now cover every bed

Audit of the multi-bed implementation found two pre-existing flows still
assuming one bed per reservation:

- update-dates used only the FIRST bed and rebuilt items per-night:
  editing dates on a multi-bed reservation silently dropped the other
  beds. Now rebuilds one item per bed spanning the new stay (per-bed rate
  kept), conflict-checks every bed with the standard status filter and
  strict overlap (back-to-back allowed). Note: collapses prior extension
  segments into a single stay line.
- extend only extended the first bed (other beds were released mid-stay)
  and created per-night items. Now extends every bed with one item per
  bed for the extension range.
- Reservations list shows "101 +3" for multi-bed bookings.
- Guest Book snapshots record all bed names ("101, 102, 103").

## [6d6f9af] - 2026-07-07

style: center drawer-launched modals in the visible area

Modals opened from the reservation drawer (cancel, checkout, guest
edit/create) centered on the full viewport, so the right-side drawer
(max-w-lg) half-covered them. On lg screens they now shift left by half
the drawer width (16rem), centering in the uncovered area. GuestDialog
gets an opt-in shiftLeft prop since it is also used without a drawer.
Mobile unchanged (drawer is full-width there).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [c823e29] - 2026-07-06

style: wrap folio segment row on mobile

On narrow screens the folio line (dates + nights x beds + rate input +
subtotal) overflowed the card. The row now wraps: dates take their own
line on mobile, rate and subtotal sit below; unchanged from sm: up.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [a05070a] - 2026-07-06

style: widen reservation drawers to max-w-lg

The folio line (dates + 3n x 4 beds + rate + subtotal) wrapped awkwardly
at max-w-md. Both the edit and new-booking drawers now use max-w-lg.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [57e2809] - 2026-07-06

fix: folio groups by date range and shows rate x nights x beds

The folio grouped items by creation batch (30s window), so a bed added
later to the SAME dates showed up as "Extension 1" and nights were
summed across beds (2 beds x 2n displayed as 4n). Now items group by
their date range: same-dates beds join one line shown as
(Nn x M beds) with subtotal rate x nights x beds; only a different date
range (a real stay extension) gets its own Extension segment. Editing a
segment rate updates every bed in that segment (server already handled
multi-item updates). i18n key bedsTimes for all 11 locales.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [39b4a33] - 2026-07-06

feat: add/remove beds on an existing reservation from the drawer

An existing reservation can grow or shrink beds without rebooking.

- New API POST/DELETE /api/reservations/[id]/items: add beds (same room
  as the booking, conflict-checked, rate/dates inherited) or remove a
  bed. Keeps at least one bed and never drops beds below guest count.
  Recomputes total_amount.
- Edit drawer: Beds section listing booked beds with remove, plus an
  Add bed picker showing free beds in the same room for the dates.
- i18n for all 11 locales.

Decision: managed from the drawer only (unambiguous), same-room only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [unreleased] - 2026-07-06

feat: add/remove beds on an existing reservation from the drawer

An existing reservation can grow or shrink beds without rebooking. The
drawer gains a Beds section listing the booked beds; "Add bed" offers the
free beds in the same room for the reservation's dates, and each bed can
be removed. Totals recompute automatically.

- New API: POST/DELETE /api/reservations/[id]/items (same-room only,
  conflict-checked, keeps >=1 bed, never drops beds below guest count)
- Drawer Beds section (list, add, remove) with live total
- i18n for all 11 locales

## [0fed17e] - 2026-07-06

fix: cap reservation guests at the number of booked beds

Additional guests could exceed the reservation capacity. Total guests
(primary + companions) is now limited to one per booked bed.

- Server rejects adding a guest when the reservation is full (409)
- Drawer shows a live count (n/beds), hides the add actions and shows a
  hint once capacity is reached
- i18n for all 11 locales

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [ca309a2] - 2026-07-06

fix: raise duplicate-merge dialog above the reservation drawer

The merge-duplicate dialog used z-50, so when triggered from the guest
dialog opened over the reservation drawer (z-[10000]) it rendered behind
it. Bumped overlay/content to z-[10051]/z-[10052].

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [4dfd1c3] - 2026-07-06

feat: edit and create companion guests from the reservation drawer

Additional guests can now be edited in place (a pencil opens their full
guest form) and a new guest can be created and attached directly, for
when the companion is not already in the system.

- GuestDialog onGuestCreated now passes the new guest id
- companion rows get an edit action; the add flow gets Create new guest
- new guest is linked as a companion on save; edits refresh the list
- i18n for all 11 locales

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [unreleased] - 2026-07-06

feat: edit and create companion guests from the reservation drawer

Additional guests can now be edited in place (pencil opens their full
guest form) and a brand-new guest can be created and attached without
leaving the reservation — useful when the companion is not already in the
system. GuestDialog now reports the created guest's id so it can be linked
as a companion. i18n for all 11 locales.

## [97509d7] - 2026-07-06

fix: refill check-in when reopening the booking drawer on the same cell

The check-in effect only ran when the checkInDate prop changed, so
closing the drawer (which resets the form) and reopening the SAME calendar
cell left check-in blank. It now also depends on open, refilling the date
every time the drawer opens.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [52a888c] - 2026-07-06

fix: treat checked_out reservations as occupying their nights

Availability and conflict checks excluded checked_out, so a bed with a
checkout-status stay on given nights showed as free and could be double-
booked (the tape chart, which only hides cancelled/no_show, still drew
the block, so calendar and drawer disagreed).

You cannot sell the same bed-night twice, and checkout is an exclusive
end date so back-to-back turnover still works. Now availability, the
create conflict check and the extend conflict check exclude only
cancelled and no_show, matching the calendar.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [23f7fc0] - 2026-07-06

fix: force European dd/mm dates and open check-out picker on full-field click

- Dates always render dd/mm/yyyy (localized weekday) regardless of the
  active locale, so en no longer shows US mm/dd
- Clicking anywhere in the check-out field opens the native date picker
  via showPicker(), not only the small calendar indicator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [23f7fc0] - 2026-07-06

fix: force European dd/mm dates and open check-out picker on full-field click

- Dates always render dd/mm/yyyy (localized weekday) regardless of the
  active locale, so en no longer shows US mm/dd
- Clicking anywhere in the check-out field opens the native date picker
  via showPicker(), not only the small calendar indicator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [771b227] - 2026-07-06

feat: uniform locale date display for check-out in booking drawer

Check-out now reads as dd/mm/yyyy like check-in: a locale-formatted
display with a transparent native date input overlaid, so it stays
fully editable via the browser date picker. i18n for all 11 locales.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [7f3dc12] - 2026-07-06

fix: show booking dates in locale (European dd/mm) format

The drawer showed dates via native date inputs, which render in the
browser locale (US mm/dd), making the check-in easy to misread. Check-in
is now a read-only, locale-formatted display (weekday + dd/mm/yyyy) with
the real value in a hidden field; check-out keeps the native picker but
gains a lang hint and a formatted preview line. Dates parse with an
explicit local time so a YYYY-MM-DD string never shifts a day by timezone.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [ebecfad] - 2026-07-06

fix: block bed selection until a valid check-out date is chosen

The booking drawer listed dorm beds as selectable before dates were set,
using a provisional all-free state. That let staff pick (or Whole-room
select) beds that were actually booked, and only the server rejected it.

Now:
- beds are shown but disabled until check-out gives a positive stay
- a visible hint tells the user to pick a check-out date first
- once dates are set, availability is fetched and booked/inactive beds
  stay disabled and labelled, free beds become selectable
- multi-bed rooms require an explicit still-available selection (no
  fallback to a possibly-booked anchor bed)
- i18n for all 11 locales

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [68873a3] - 2026-07-06

fix: clear booking drawer form when it closes

The form only reset after a successful save, so closing via Cancel/X and
reopening kept the previous check-out date, guest and bed selection. Reset
on close so every reopen starts clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [d7f42bc] - 2026-07-06

fix: show multi-bed selector as soon as booking drawer opens on a dorm

The bed selector was hidden until a check-out date was picked (it waited
on the availability call). Now the room beds are listed immediately on
open; availability is refined once dates are chosen.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [2fe4f34] - 2026-07-06

feat: multi-bed reservations (book several beds in one reservation)

A single reservation can now span multiple beds (e.g. 6 beds in a dorm).
The schema already supported it via reservation_items; this wires the
direct booking flow end-to-end.

- Create API accepts bed_ids[] (bed_id kept as anchor/fallback for OTA
  imports); conflict-checks every bed, one item per bed, total =
  nights x rate x beds
- Availability endpoint gains room-level mode (?room_id=) returning
  per-bed availability + free/total counts
- New-booking drawer: quantity stepper (auto-assign N free beds) +
  explicit bed checkboxes + Whole room; price shows nights x beds
- Confirmation email / notification show Room . N beds
- i18n for all 11 locales
- Phase B design doc for the room-type channel manager / OTA dorm sync
  (docs/plans/2026-07-06-multibed-and-channel-manager.md)

Channel manager stays per-bed iCal for now; true dorm OTA sync via
room-type allotment is designed but not yet built.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [unreleased] - 2026-07-06

feat: multi-bed reservations (book several beds in one reservation)

One reservation can now span multiple beds — e.g. 6 beds in a dorm as a
single booking. The data model already supported this (reservation_items is
per-bed); this wires the direct booking flow end-to-end.

- Create API accepts bed_ids[] (bed_id kept as anchor/fallback for OTA
  imports); conflict-checks every bed, inserts one item per bed, total =
  nights × rate × beds
- Availability endpoint gains room-level mode (?room_id=) returning per-bed
  availability + free/total counts
- New-booking drawer: quantity stepper (auto-assign N free beds) + explicit
  bed checkboxes + "Whole room"; price shows nights × beds
- Confirmation email / notification show "Room · N beds"
- i18n for all 11 locales
- Design doc for Phase B (room-type channel manager / OTA dorm sync):
  docs/plans/2026-07-06-multibed-and-channel-manager.md

Channel manager stays per-bed iCal for now; true dorm OTA sync (room-type
allotment) is designed in the doc but not yet built.

## [b11584b] - 2026-07-06

feat: multiple guests per reservation (primary + companions)

Add a reservation_guests join table so several guests can be attached to
one reservation. The booker remains the primary/lead guest (kept in sync
with reservations.guest_id, which existing email/list code relies on);
additional companion guests are added/removed from the reservation drawer.
Each companion is a full guest record, so their ID and documents are
captured for check-in.

- Migration: reservation_guests table + RLS (select/insert/delete) +
  backfill of existing primary guests
- API: GET/POST/DELETE /api/reservations/[id]/guests
- Sync primary row on reservation create and on primary-guest change
- Reservation drawer: Additional guests section (search, add, remove)
- i18n keys for all 11 locales

No per-bed assignment: guests are listed at the reservation level.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [unreleased] - 2026-07-06

feat: multiple guests per reservation (primary + companions)

New reservation_guests join table links several guests to one reservation.
The booker stays the primary/lead guest (mirrors reservations.guest_id for
existing email/list code); additional companion guests can be added and
removed from the reservation drawer. Each companion is a full guest record,
so their ID/documents are captured for check-in. Backfilled existing
reservations, added RLS, synced primary on create + guest change. i18n for
all 11 locales. No per-bed assignment (guests listed at reservation level).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [032570e] - 2026-07-06

fix: clear edit dialogs to blank on create instead of last-edited data

react-hook-form reset(values) during an edit overwrites the internal
defaultValues, so a later bare reset() on Create restored the previous
record instead of a blank form. Pass explicit empty defaults on create.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [3f925e7] - 2026-07-06

feat: loading spinner in bed/room/room-type dialogs while data loads

Show a centered spinner overlay inside the edit dialogs while their
data is fetched on open, instead of briefly flashing an empty form.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [2132434] - 2026-07-06

fix: add missing rooms/room_types updated_at columns

Editing a room or room type failed with "Could not find the updated_at column
in the schema cache" — the PATCH routes set updated_at but the columns were
missing (same as beds). Add them + reload PostgREST schema. Migration included.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [e942c97] - 2026-07-06

feat: replace native confirm() with a styled confirm dialog

- Add promise-based confirmDialog() + ConfirmDialogHost (Radix, botanical,
  destructive styling, i18n common namespace), mounted once in the dashboard
  layout.
- Replace all 12 window.confirm() delete/remove prompts (rooms, room-types,
  beds, guests, channels, team, guest book, reservation drawer) with
  await confirmDialog(...).
- Add common.{confirm,cancel,delete,confirmTitle} keys across 11 locales.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [c287945] - 2026-07-06

fix: add missing beds.updated_at column

The beds PATCH route sets updated_at but the column did not exist, so editing a
bed failed with "Could not find the updated_at column of beds in the schema
cache". Add the column + reload PostgREST schema. Migration file included.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [3fa0fee] - 2026-07-06

fix: drop strict yup uuid() on room_type_id/room_id (rejected seed ids)

yup .uuid() requires a v1-5 UUID; seed/demo ids like
b1000000-0000-0000-0000-000000000000 are valid Postgres uuids but not v1-5, so
creating/editing rooms or beds failed with "must be a valid ID". The value comes
from a <select> of real ids and the DB FK enforces validity, so require a
non-empty string instead.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [43244cd] - 2026-07-06

fix: room/bed counts in tables + editable room-type/room selects

- Room Types table now shows the room count and Rooms table the bed count:
  add Supabase embedded aggregates (rooms(count) / beds(count)) in the rooms
  page and the /api/room-types + /api/rooms routes (clients refetch on mount),
  flattened to room_count / bed_count.
- Fix "Room type must be a valid ID" when editing a room: the native select
  dropped the value because it was reset before the options loaded. Make the
  room-type select (rooms-dialog) and room select (beds-dialog) controlled
  (value + setValue) and load options before reset.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [f59a9f4] - 2026-07-06

fix: prevent duplicate reservation numbers (atomic per-org counter)

generate_reservation_number used count(*)+1 of existing rows, which duplicates
on delete and under concurrent inserts (22 rows had only 12 distinct numbers).
Replace with an atomic reservation_number_counters table (upsert ... RETURNING,
SECURITY DEFINER), seed it from current max, renumber existing duplicates, and
add a UNIQUE (organization_id, reservation_number) backstop. DB-only change;
the insert trigger keeps generating the number. Migration file added for record.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [9f49e1c] - 2026-07-06

feat: searchable country/city selector on onboarding

Replace the free-text city/country inputs with a searchable country -> city
selector (country-state-city, lazy-loaded) in a reusable
components/ui/country-city-select.tsx. Produces canonical country/city names,
which also makes the Serbia feature-gating reliable.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [7775ee4] - 2026-07-06

feat: gate Serbia-only fields (JMBG, service type, police-registration) by property country

- Serbian police-registration fields now only show when the property country is
  Serbia (from onboarding). Matching is case-insensitive + variants (serbia,
  republic of serbia, rs, srb).
- Gated: JMBG in guest create/edit dialog; Guest Book JMBG + Service Type
  columns, the "Serbian police-registration record" subtitle, and the JMBG /
  service-type fields in its edit form; JMBG + unique_master_citizen in the
  duplicate-merge dialog.
- Add useOrgCountry hook (client dialogs) + isSerbia helper; Guest Book page
  passes org country server-side.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [1a44ff8] - 2026-07-06

fix: emails show real reservation_number (RES-26-XXXX) not the UUID prefix

Reservation confirmation, cancellation and checkout emails used
id.substring(0,8) instead of the reservation_number column. Now select and
pass reservation_number (fallback to the id prefix if absent). The cancellation
notification uses it too.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [1a44ff8] - 2026-07-06

fix: emails show real reservation_number (RES-26-XXXX) not the UUID prefix

Reservation confirmation, cancellation and checkout emails used
id.substring(0,8) instead of the reservation_number column. Now select and
pass reservation_number (fallback to the id prefix if absent). The cancellation
notification uses it too.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [32b0272] - 2026-07-06

feat: email from-name = property; validate reservation checkout >= check-in

- Emails now send as "<Property Name> <noreply@hostmagsmart.com>" (stable
  address, sanitized display name) with Reply-To set to the property email when
  available; getOrgBranding also returns the org email. Team invite gets the
  same display name.
- Edit reservation drawer: checkout date input now has min={check-in} so earlier
  dates cannot be selected (mobile included); existing <= validation stays as a
  backstop.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [52150a0] - 2026-07-06

feat: payment method (card/cash) in reservation Payment & Folio

- DB: add reservations.payment_method (card/cash/bank_transfer/other, checked,
  nullable).
- Payment API: allow payment_method in the update allowlist.
- Edit reservation drawer: Payment Method select next to Currency; loaded from
  the reservation, saved via Save Payment Info.
- i18n: payment method labels x11.

Also fix guest check-in form: render the back ID photo validation error (was
only shown for the front), tighten accept to jpeg/png/webp, reset the input
after a rejected file.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [26ccada] - 2026-07-06

feat: emails use property name + reservation email adds check-in link & QR

- Emails now show the tenant property name in the body/footer instead of the app
  name ("Hostmagsmart"). getOrgBranding(supabase, orgId) returns { logoUrl, name }
  and all senders take a branding object (brandName = branding.name || fallback).
- Reservation confirmation email now includes an online check-in call to action:
  a "Start online check-in" button, a scannable QR code, and the raw link — built
  from the reservation check_in_token (create route now selects + passes it).

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [96cd66b] - 2026-07-06

feat: use tenant org logo in emails (fallback to HostMagSmart)

- generateEmailHTML accepts an optional logoUrl; header uses it, falling back to
  the botanical logo.
- All transactional emails now pass the org logo: reservation confirmation +
  cancellation, check-in submitted/approved/rejected, checkout confirmation, and
  team invite. Added getOrgLogoUrl(supabase, orgId) helper.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [6950c6c] - 2026-07-06

feat: SEO — IndexNow instant indexing (Bing/Yandex)

- Add IndexNow key file (public/<key>.txt) and lib/indexnow.ts helper.
- Add GET /api/indexnow?key=<key> route that submits the public URLs to
  IndexNow; hit it after a deploy (or wire to a deploy hook).

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [6950c6c] - 2026-07-06

feat: SEO — IndexNow instant indexing (Bing/Yandex)

- Add IndexNow key file (public/<key>.txt) and lib/indexnow.ts helper.
- Add GET /api/indexnow?key=<key> route that submits the public URLs to
  IndexNow; hit it after a deploy (or wire to a deploy hook).

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [6af8cef] - 2026-07-06

feat: SEO content — landing FAQ + FAQPage schema, page metadata, alts

- Add a visible FAQ section to the landing (shared data in lib/seo-faq.ts) and
  emit matching FAQPage JSON-LD on the home page for FAQ rich results.
- Per-page metadata via co-located layouts: /login (sign in/up) and /demo, each
  with keyword-rich title/description + canonical.
- More descriptive/keyworded alt on the hero room image.

tsc + production build pass.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [820d790] - 2026-07-06

feat: SEO — rich metadata, robots, sitemap, manifest, OG image, JSON-LD

- Enrich root metadata: descriptive title/description, keywords, metadataBase,
  canonical, OpenGraph + Twitter cards, index/follow robots directives.
- Add app/robots.ts (allow public, disallow api/onboarding/auth/invite),
  app/sitemap.ts (home, signup, login, demo), app/manifest.ts (PWA, botanical
  colors + logo).
- Add dynamic botanical opengraph-image (next/og) for social/search previews.
- Home page: JSON-LD @graph (Organization + WebSite + SoftwareApplication).
- Tenant [slug] layout: robots noindex (private/auth-gated app).

tsc + production build pass.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [820d790] - 2026-07-06

feat: SEO — rich metadata, robots, sitemap, manifest, OG image, JSON-LD

- Enrich root metadata: descriptive title/description, keywords, metadataBase,
  canonical, OpenGraph + Twitter cards, index/follow robots directives.
- Add app/robots.ts (allow public, disallow api/onboarding/auth/invite),
  app/sitemap.ts (home, signup, login, demo), app/manifest.ts (PWA, botanical
  colors + logo).
- Add dynamic botanical opengraph-image (next/og) for social/search previews.
- Home page: JSON-LD @graph (Organization + WebSite + SoftwareApplication).
- Tenant [slug] layout: robots noindex (private/auth-gated app).

tsc + production build pass.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [9ddb7ed] - 2026-07-05

fix: mobile — calendar past-day color, palette preview + property grid equality

- Tape calendar: past (locked) day cells use a warm gray #D8D2C4 so they read
  as non-selectable; legend swatch matches.
- Property Settings: accent Button/Badge preview chips no longer wrap
  (whitespace-nowrap, row wraps).
- Property Settings Basic Info: full-width fields use sm:col-span-2 so on
  mobile (1-col grid) they no longer create an implicit auto column that made
  email/phone and city/country unequal — fields now stack full-width equally.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [628ebd2] - 2026-07-05

fix: mobile round 2 — date inputs, calendar z-index, cramped controls

- iOS date/datetime/time inputs no longer center their value (global
  ::-webkit-date-and-time-value left-align) — fixes DOB, drawer actual
  arrival/departure, reservation filters, guest-book date fields.
- Calendar sticky header no longer renders over the open sidebar: sidebar
  z-[60] / overlays z-[55] (were below the tape-chart z-50 sticky cells).
- Pending bulk bar: Approve/Reject/Clear wrap and fit (flex-wrap, full width
  on mobile, whitespace-nowrap) instead of clipping.
- Property Settings: Save button no longer wraps (whitespace-nowrap, title
  truncates); Basic Info + Operations field grids stack on mobile so the
  timezone/currency selects arent cut.
- Edit Reservation drawer: payment 2-col grids (deposit, actual arrival/
  departure, extend) stack on mobile.
- Analytics Top Rooms: responsive label/value widths so the bars are visible
  on phones.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [636b47e] - 2026-07-05

fix: mobile — sidebar scroll/close, modal grids, channel + calendar

- Sidebar: add min-h-0 so the nav actually scrolls (flex overflow gotcha; bottom
  items/settings were unreachable); close the sidebar after navigating on mobile.
- Verify Check-In modal: guest-info grid stacks to 1 col on mobile (email/phone
  were overlapping); pending bulk-action bar wraps.
- Channel Manager: platform row meta/actions wrap instead of overlapping the
  edit/delete icons on narrow screens.
- Tape Calendar: property/unit label column narrows to 132px on phones (was a
  fixed 220px eating the viewport); Sync Channels button no longer wraps.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [9e160ab] - 2026-07-05

fix: mobile topbar + guests table overflow

- Header: hide "New Booking" label on mobile (icon only), truncate long section
  title, tighter paddings/gaps (px-4 sm:px-6, gap-1.5 sm:gap-4) so the topbar
  no longer crowds on phones.
- Guests table: add min-w-[720px] so columns scroll horizontally instead of
  cramming on small screens.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [820772f] - 2026-07-05

fix: mobile responsiveness — modals, drawers, app shell

- checkout & cancel dialogs had no height cap/scroll (buttons unreachable on
  small screens): add max-h-[90dvh] overflow-y-auto.
- All centered dialogs vh -> dvh + side gutter w-[calc(100vw-2rem)]; wide
  dialogs use p-4 sm:p-6.
- Right drawers + app shell h-screen -> h-[100dvh].
- Shell mobile bug: opening sidebar pushed main ~288px off-screen (ml-72 with
  no breakpoint) -> lg:ml-72; main padding p-6 -> p-4 sm:p-6.
- Calendar tape-chart max-h vh -> dvh.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [Unreleased] - 2026-07-05

fix: mobile/tablet responsiveness — modals, drawers, app shell

- Fixed modals whose buttons were unreachable on small screens: checkout and
  cancel-reservation dialogs had no height cap/scroll — added
  `max-h-[90dvh] overflow-y-auto`.
- Switched all centered dialogs from `vh` to `dvh` (accounts for mobile browser
  chrome) and gave them a side gutter (`w-[calc(100vw-2rem)]`) so they no longer
  touch the screen edges; wide dialogs (OCR, duplicate-merge) use `p-4 sm:p-6`.
- Right drawers (new/edit reservation) and the app shell now use `h-[100dvh]`
  instead of `h-screen`.
- App-shell mobile bug: opening the sidebar pushed the main content ~288px
  off-screen (`ml-72` with no breakpoint) — now `lg:ml-72` (desktop only; the
  sidebar is an overlay on mobile). Main padding `p-6` → `p-4 sm:p-6`.
- Calendar tape-chart max height `vh` → `dvh`.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [75dedb6] - 2026-07-05

fix: new orgs default to botanical moss accent, not the retired purple

- create-org sets theme_color "#5f7048" explicitly on insert.
- DB: organizations.theme_color column default changed #7c3aed -> #5f7048;
  existing orgs on the old purple migrated to moss.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [Unreleased] - 2026-07-05

fix: new orgs default to botanical moss accent, not the retired purple

- create-org now sets `theme_color: "#5f7048"` explicitly on insert.
- DB: `organizations.theme_color` column default changed `#7c3aed` → `#5f7048`,
  and existing orgs still on the old purple were migrated to moss.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [0c17d7a] - 2026-07-05

feat: botanical email redesign (app emails + Supabase confirm-signup)

- Reskin shared generateEmailHTML wrapper (all 6 app emails: check-in
  submitted/approved/rejected, reservation confirmation/cancelled, checkout
  confirmation): cream card, moss header + logo, serif headings, moss CTA/info-box.
- Team invite email uses the same wrapper (was a standalone blue template);
  export generateEmailHTML for reuse.
- Botanical rewrite of Supabase confirm-signup template (table-based, email-safe,
  logo + serif, moss CTA, moss-tint step badges); {{ .ConfirmationURL }} kept.
  Must be pasted into Supabase Auth email templates to take effect.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [Unreleased] - 2026-07-05

feat: Botanical email redesign (app emails + Supabase confirm-signup)

- Reskinned the shared `generateEmailHTML` wrapper (used by all 6 app emails:
  check-in submitted/approved/rejected, reservation confirmation/cancelled,
  checkout confirmation) to the botanical system — cream card, moss header with
  logo, serif headings (Georgia), moss info-box accents and CTA button.
- Team invite email now uses the same wrapper (was a standalone blue-button
  template); exported `generateEmailHTML` for reuse.
- Botanical rewrite of the Supabase confirm-signup template
  (`supabase/email-templates/confirm-signup.html`) — table-based/email-safe,
  logo + serif heading, moss CTA, moss-tint step badges; `{{ .ConfirmationURL }}`
  preserved. (Must be pasted into Supabase → Auth → Email Templates to take effect.)

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [9dc5cb9] - 2026-07-05

fix: Stripe webhook applies plan reliably on newer API versions

- invoice.payment_succeeded no longer no-ops on Stripe API 2024+ (invoice.subscription
  removed): resolves sub id from parent.subscription_details / lines[], writes
  stripe_subscription_id and clears pending_plan.
- Handle customer.subscription.created (was only updated/deleted).
- Never downgrade a paid org to free on an unmapped price: fall back to
  subscription metadata.plan, skip if unresolved.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [Unreleased] - 2026-07-05

fix: Stripe webhook — apply plan reliably on newer API versions

- `invoice.payment_succeeded` no longer no-ops on recent Stripe API versions
  (2024+ removed `invoice.subscription`); resolves the subscription id from the
  newer `parent.subscription_details.subscription` / `lines[].subscription`
  locations too, and also writes `stripe_subscription_id` + clears `pending_plan`.
- Handle `customer.subscription.created` (was only `.updated` / `.deleted`).
- Never downgrade a paid org to `free` on an unmapped price id — fall back to the
  plan stored in subscription `metadata.plan` and skip the update if none resolves.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [e1af003] - 2026-07-05

fix: billing checkout loop, duplicate-email signup, favicon

- Billing gate loop: pending_plan was only cleared by the Stripe webhook, so a
  delayed/misconfigured webhook trapped users in
  dashboard-gate → billing?required=true → auto-checkout → Stripe. Add
  lib/billing-reconcile.ts, called from the tenant layout: when pending_plan is
  set, reconcile straight from Stripe (active/trialing sub → apply plan, clear
  pending_plan). Resilient to webhook failure; only runs while pending.
- Billing auto-checkout guards: skip after Stripe return (success), when already
  on the target plan, and after the first run per session; manage-billing card no
  longer gated on stripe_customer_id.
- Signup with an already-registered email now warns (empty identities[] detection)
  instead of showing the confirmation screen; new auth.login.toastEmailInUse x11.
- Favicon: botanical logo as src/app/icon.png + apple-icon.png.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [Unreleased] - 2026-07-05

fix: billing checkout loop, duplicate-email signup, favicon

- Billing payment-gate loop: after paying, the org's `pending_plan` is only
  cleared by the Stripe webhook, so if the webhook was delayed/misconfigured the
  dashboard-layout gate kept redirecting to `billing?required=true` → auto-checkout
  → Stripe again. Added `lib/billing-reconcile.ts` (`reconcilePendingPlan`) called
  from the tenant layout: whenever `pending_plan` is set it checks Stripe directly
  for an active/trialing subscription and applies `plan` + clears `pending_plan`,
  so the loop can't happen even if the webhook fails. Only runs while a plan is
  pending.
- Billing auto-checkout guards: the effect no longer re-fires after returning from
  Stripe (`success`), when already on the target plan, or more than once per
  session; the manage-billing card no longer requires `stripe_customer_id`.
- Signup with an already-registered email now shows an error toast
  ("This email is already registered…") instead of the "check your email" screen —
  detects Supabase's empty `identities[]` enumeration-protection response. New
  `auth.login.toastEmailInUse` key across 11 locales.
- Favicon: botanical logo added as `src/app/icon.png` + `src/app/apple-icon.png`
  (App Router auto-wires favicon + apple-touch icon).

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [606ca94] - 2026-07-05

feat: per-section prototype polish (analytics, channels, rooms, housekeeping, settings)

- Analytics: bar charts (sage/gold), fixed black-bar bug (real hex vs unresolved
  var), removed occupancy chart (stat kept), Top Rooms as horizontal bars, real
  "+X% vs prev 30d" deltas (60-day fetch, last-30 vs prior-30).
- Guest Directory: serif title, avatar initials, uppercase headers (appearance only).
- Channel Manager: serif title (grouped layout kept).
- Room Inventory: serif titles, uppercase table headers, botanical Active pill.
- Housekeeping: prototype cards grouped by room, status-pill dropdown, 5 filters.
- Property Settings: serif headers (icons removed), rounded-2xl cards.
- Team: serif title, avatar initials, two-line rows, botanical accents.
- Billing: 2-col top (current plan + usage bars kept + portal card), 3-card plans
  grid; manage-billing no longer gated on stripe_customer_id; Scale leads with
  "All Pro features".
- i18n: new keys across analytics/channels/housekeeping/billing/guest-book, all
  11 locales.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [d1ab4ce] - 2026-07-05

## [Unreleased] - 2026-07-05

feat: Botanical Refresh — per-section prototype polish (analytics, channels, rooms, housekeeping, settings)

- Analytics: booking + revenue trends switched to bar charts (sage / gold),
  fixed bars rendering black (unresolved `var(--color-*)` → real hex), removed
  the occupancy chart (occupancy still powers its stat card), Top Rooms shown as
  horizontal bars, chart-header icons dropped, and Bookings/Revenue cards now
  show real "+X% vs prev 30d" deltas (page fetches 60 days; client compares
  last-30 vs prior-30).
- Guest Directory: serif title, avatar initials, uppercase headers, text-sm,
  airier rows — appearance only.
- Channel Manager: serif title (grouped-by-bed layout kept per request).
- Room Inventory: serif page + section titles, uppercase table headers on
  muted header row, botanical rounded-full Active pill on beds — tables/search/
  sort/edit/delete unchanged.
- Housekeeping: rebuilt to prototype cards (bed-icon + name/room + status pill),
  still grouped by room; status pill is now a dropdown to change status; 5 filter
  pills (added Clean, Inspected); botanical status colors.
- Property Settings: serif section headers with icons removed, rounded-2xl cards.
- Team: serif title, avatar initials, two-line name/email/joined, rounded-2xl
  cards, botanical pending/remove accents.
- Billing & Plan: prototype layout — 2-column top (current-plan card with usage
  progress bars kept + billing-portal card) and a 3-card available-plans grid
  with CURRENT badge and per-card actions; manage-billing card no longer gated
  on stripe_customer_id; Scale plan now leads with "All Pro features".
- Header: dialog/modal titles and section titles carried to the serif face.
- i18n: added analytics (statVsPrev), channels (lastSyncLabel, andMore,
  unassigned), housekeeping (filter_clean, filter_inspected, changeStatus),
  guest-book (recordDescriptor), pending-check-in table, and billing
  (currentPlanHeading, currentPlanButton, renewalNote) keys, plus "All Pro
  features" on Scale — all across 11 locales.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [Unreleased] - 2026-07-05

feat: Botanical Refresh — per-section prototype polish (analytics, channels, rooms, housekeeping, settings)

- Analytics: booking + revenue trends switched to bar charts (sage / gold),
  fixed bars rendering black (unresolved `var(--color-*)` → real hex), removed
  the occupancy chart (occupancy still powers its stat card), Top Rooms shown as
  horizontal bars, chart-header icons dropped, and Bookings/Revenue cards now
  show real "+X% vs prev 30d" deltas (page fetches 60 days; client compares
  last-30 vs prior-30).
- Guest Directory: serif title, avatar initials, uppercase headers, text-sm,
  airier rows — appearance only.
- Channel Manager: serif title (grouped-by-bed layout kept per request).
- Room Inventory: serif page + section titles, uppercase table headers on
  muted header row, botanical rounded-full Active pill on beds — tables/search/
  sort/edit/delete unchanged.
- Housekeeping: rebuilt to prototype cards (bed-icon + name/room + status pill),
  still grouped by room; status pill is now a dropdown to change status; 5 filter
  pills (added Clean, Inspected); botanical status colors.
- Property Settings: serif section headers with icons removed, rounded-2xl cards.
- Team: serif title, avatar initials, two-line name/email/joined, rounded-2xl
  cards, botanical pending/remove accents.
- Billing & Plan: prototype layout — 2-column top (current-plan card with usage
  progress bars kept + billing-portal card) and a 3-card available-plans grid
  with CURRENT badge and per-card actions; manage-billing card no longer gated
  on stripe_customer_id; Scale plan now leads with "All Pro features".
- Header: dialog/modal titles and section titles carried to the serif face.
- i18n: added analytics (statVsPrev), channels (lastSyncLabel, andMore,
  unassigned), housekeeping (filter_clean, filter_inspected, changeStatus),
  guest-book (recordDescriptor), pending-check-in table, and billing
  (currentPlanHeading, currentPlanButton, renewalNote) keys, plus "All Pro
  features" on Scale — all across 11 locales.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [a762f1b] - 2026-07-05

perf: faster section navigation + per-section loading skeletons

- Add per-section loading.tsx skeletons (dashboard, analytics, calendar,
  reservations, check-in-pending, guest book, guests, rooms, channels,
  housekeeping) on shared primitives in components/loading/skeletons.tsx,
  plus a generic [slug] fallback. Sections stream a shape-matched skeleton
  instantly on nav instead of blocking on the full server render.
- Add lib/supabase/session.ts: React cache()-wrapped getServerUser/getServerClient;
  refactor tenant layout + 7 pages to share one auth validation + client init
  per request (drops a Supabase Auth round-trip per navigation).
- Middleware skips the Supabase session refresh for router prefetch requests,
  so hover-prefetch no longer fires an auth network call per link.
- Lazy-load country-state-city in property settings: the ~2MB country/city
  dataset becomes an async chunk, cutting first-load JS 2.37 MB -> ~201 kB.
- Guest Book placeholder JMBG -> Passport (11 locales); serif applied to every
  remaining dialog/modal title.

tsc clean, production build passes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [a762f1b] - 2026-07-05

perf: faster section navigation + per-section loading skeletons

- Add per-section loading.tsx skeletons (dashboard, analytics, calendar,
  reservations, check-in-pending, guest book, guests, rooms, channels,
  housekeeping) on shared primitives in components/loading/skeletons.tsx,
  plus a generic [slug] fallback. Sections stream a shape-matched skeleton
  instantly on nav instead of blocking on the full server render.
- Add lib/supabase/session.ts: React cache()-wrapped getServerUser/getServerClient;
  refactor tenant layout + 7 pages to share one auth validation + client init
  per request (drops a Supabase Auth round-trip per navigation).
- Middleware skips the Supabase session refresh for router prefetch requests,
  so hover-prefetch no longer fires an auth network call per link.
- Lazy-load country-state-city in property settings: the ~2MB country/city
  dataset becomes an async chunk, cutting first-load JS 2.37 MB -> ~201 kB.
- Guest Book placeholder JMBG -> Passport (11 locales); serif applied to every
  remaining dialog/modal title.

tsc clean, production build passes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [01fd346] - 2026-07-05

@
perf: faster section navigation + per-section loading skeletons

- Add per-section loading.tsx skeletons (dashboard, analytics, calendar,
  reservations, check-in-pending, guest book, guests, rooms, channels,
  housekeeping) on shared primitives in components/loading/skeletons.tsx,
  plus a generic [slug] fallback. Sections stream a shape-matched skeleton
  instantly on nav instead of blocking on the full server render.
- Add lib/supabase/session.ts: React cache()-wrapped getServerUser/getServerClient;
  refactor tenant layout + 7 pages to share one auth validation + client init
  per request (drops a Supabase Auth round-trip per navigation).
- Middleware skips the Supabase session refresh for router prefetch requests,
  so hover-prefetch no longer fires an auth network call per link.
- Lazy-load country-state-city in property settings: the ~2MB country/city
  dataset becomes an async chunk, cutting first-load JS 2.37 MB -> ~201 kB.
- Guest Book placeholder JMBG -> Passport (11 locales); serif applied to every
  remaining dialog/modal title.

tsc clean, production build passes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
@

## [Unreleased] - 2026-07-05

perf: faster section navigation + per-section skeletons; UI polish

Navigation performance
- Added per-section `loading.tsx` skeletons (dashboard, analytics, calendar,
  reservations, check-in-pending, guest book, guests, rooms, channels,
  housekeeping) built on shared primitives in `components/loading/skeletons.tsx`,
  plus a generic `[slug]/loading.tsx` fallback. Sections now stream a
  shape-matched skeleton instantly on navigation instead of blocking on the full
  server render.
- Added `lib/supabase/session.ts` with React `cache()`-wrapped `getServerUser()` /
  `getServerClient()`; refactored the tenant layout + 7 pages to share a single
  auth validation + client init per request (was ~2 each) — drops a Supabase Auth
  round-trip per navigation.
- Middleware now skips the Supabase session refresh for router prefetch requests,
  so hover-prefetch no longer fires an auth network call per link.
- Lazy-loaded `country-state-city` in property settings — the ~2MB worldwide
  country/city dataset is now an async chunk, cutting that page's first-load JS
  from 2.37 MB to ~201 kB.

UI polish
- Guest Book search placeholder: "JMBG" → "Passport" (all 11 locales); search
  input on near-white surface.
- Serif (Cormorant) applied to every remaining dialog/modal title across the app.

tsc clean, production build passes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [a73a3f4] - 2026-07-05

design pulishment over all app

## [a73a3f4] - 2026-07-05

design pulishment over all app

## [a73a3f4] - 2026-07-05

design pulishment over all app

Botanical Refresh — Stage 3 (in-app surfaces, dialogs, OCR, validation).

- Dashboard: stat cards restyled to the botanical card (p-6, no heavy shadow,
  moss-tinted rounded-square icons instead of big circles); "Today's Overview"
  and stat numbers set in the serif face.
- Analytics: added the 4 summary stat tiles (Total Bookings, Revenue 30d,
  Occupancy, ADR) computed from the trend arrays, moss-tint icon squares and
  serif values; page + section headings set in serif.
- Tape Calendar: serif page title, off-palette emerald "PRIVATE" chip and
  legend dots remapped to botanical moss/gold, and the room-section header made
  a solid sticky-left block (was translucent + backdrop-blur) so the room name
  and type chip stay pinned instead of smearing over the grid on horizontal
  scroll.
- Edit Reservation drawer: full botanical remap — Payment & Folio panel, folio
  ledger, Check Out / Save Payment / Confirm Extension buttons, the
  payment-confirmed toggle and input focus rings all moved from emerald/red/blue
  to the moss + status palette; serif title, moss Ref line.
- Reservations list: serif title, uppercase tracking table headers, rounded-full
  status pills, botanical paid-column colors, airier rows.
- Pending Check-Ins: rebuilt from the card list into a proper table (guest
  avatar, columns, moss Review button), "N guests waiting" pill, outlined
  Refresh, relative "submitted" time, botanical approve/reject colors;
  bulk-select retained.
- Guest Book: serif title with "Serbian police-registration record" descriptor,
  Export CSV/Excel moved into the header, cleaner rounded-2xl table (uppercase
  headers, no zebra, moss reservation #), near-white search input, and the
  search placeholder switched from "JMBG" to "Passport".
- Dialogs: every modal/dialog title across the app set in the serif face
  (new-reservation, beds, checkout, cancel-reservation, room-types, rooms,
  guest, OCR, duplicate-merge, paywall, demo-welcome, logo-crop, pending-checkin
  modals). Header section title also serif.
- OCR: gated to Pro/Scale plans (free plan warned + blocked), auth fixed to use
  the session-bound server client, model set to claude-sonnet-5, and the
  extraction dialog freeze/scroll fixed (non-modal Radix + manual wheel scroll).
- Validation: room floor/bed position accept empty (coerce NaN/empty → null),
  guest notes and document_issued_date made nullable; added the `ocr` plan flag.
- i18n: added analytics stat, pending-check-in table, guest-book descriptor and
  placeholder keys across all 11 locales.

tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [b9e7c89] - 2026-07-04

feat: Botanical Refresh — Stage 2 (login split-panel, landing hero, auth surfaces)

- Login: rebuilt as the botanical split-panel — left art panel (dark ink
  radial-gradient wash, botanical logo, room-living photo, serif pull-quote),
  right cream form panel with serif headings, accent tabs/buttons/inputs.
  All sign-in / sign-up / forgot-password logic unchanged; only presentation
  and token/accent classes swapped (indigo/slate/gradients → botanical).
- Landing: rebuilt the hero into the two-column editorial layout — serif
  "Run your hostel / with calm." headline with italic accent line, room-
  bedroom photo in a rounded art card, moss CTAs, ★ 4.9/5 strip; remapped the
  rest of the page (features / how-it-works / pricing / CTA / footer / preview
  mock) from bg-white/gray + purple utilities to design tokens + accent, with
  serif section headings.
- Reset-password, guest self check-in wizard, check-in success, onboarding,
  and demo pages remapped from slate/gray/white + indigo/violet utilities to
  the botanical token + accent system so the whole auth/guest flow reads
  consistently.

tsc clean, production build passes (48/48 pages).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [b9e7c89] - 2026-07-04

feat: Botanical Refresh — Stage 2 (login split-panel, landing hero, auth surfaces)

- Login: rebuilt as the botanical split-panel — left art panel (dark ink
  radial-gradient wash, botanical logo, room-living photo, serif pull-quote),
  right cream form panel with serif headings, accent tabs/buttons/inputs.
  All sign-in / sign-up / forgot-password logic unchanged; only presentation
  and token/accent classes swapped (indigo/slate/gradients → botanical).
- Landing: rebuilt the hero into the two-column editorial layout — serif
  "Run your hostel / with calm." headline with italic accent line, room-
  bedroom photo in a rounded art card, moss CTAs, ★ 4.9/5 strip; remapped the
  rest of the page (features / how-it-works / pricing / CTA / footer / preview
  mock) from bg-white/gray + purple utilities to design tokens + accent, with
  serif section headings.
- Reset-password, guest self check-in wizard, check-in success, onboarding,
  and demo pages remapped from slate/gray/white + indigo/violet utilities to
  the botanical token + accent system so the whole auth/guest flow reads
  consistently.

tsc clean, production build passes (48/48 pages).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [b9e7c89] - 2026-07-04

feat: Botanical Refresh — Stage 2 (login split-panel, landing hero, auth surfaces)

- Login: rebuilt as the botanical split-panel — left art panel (dark ink
  radial-gradient wash, botanical logo, room-living photo, serif pull-quote),
  right cream form panel with serif headings, accent tabs/buttons/inputs.
  All sign-in / sign-up / forgot-password logic unchanged; only presentation
  and token/accent classes swapped (indigo/slate/gradients → botanical).
- Landing: rebuilt the hero into the two-column editorial layout — serif
  "Run your hostel / with calm." headline with italic accent line, room-
  bedroom photo in a rounded art card, moss CTAs, ★ 4.9/5 strip; remapped the
  rest of the page (features / how-it-works / pricing / CTA / footer / preview
  mock) from bg-white/gray + purple utilities to design tokens + accent, with
  serif section headings.
- Reset-password, guest self check-in wizard, check-in success, onboarding,
  and demo pages remapped from slate/gray/white + indigo/violet utilities to
  the botanical token + accent system so the whole auth/guest flow reads
  consistently.

tsc clean, production build passes (48/48 pages).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [b9e7c89] - 2026-07-04

feat: Botanical Refresh — Stage 2 (login split-panel, landing hero, auth surfaces)

- Login: rebuilt as the botanical split-panel — left art panel (dark ink
  radial-gradient wash, botanical logo, room-living photo, serif pull-quote),
  right cream form panel with serif headings, accent tabs/buttons/inputs.
  All sign-in / sign-up / forgot-password logic unchanged; only presentation
  and token/accent classes swapped (indigo/slate/gradients → botanical).
- Landing: rebuilt the hero into the two-column editorial layout — serif
  "Run your hostel / with calm." headline with italic accent line, room-
  bedroom photo in a rounded art card, moss CTAs, ★ 4.9/5 strip; remapped the
  rest of the page (features / how-it-works / pricing / CTA / footer / preview
  mock) from bg-white/gray + purple utilities to design tokens + accent, with
  serif section headings.
- Reset-password, guest self check-in wizard, check-in success, onboarding,
  and demo pages remapped from slate/gray/white + indigo/violet utilities to
  the botanical token + accent system so the whole auth/guest flow reads
  consistently.

tsc clean, production build passes (48/48 pages).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [b9e7c89] - 2026-07-04

feat: Botanical Refresh — Stage 2 (login split-panel, landing hero, auth surfaces)

- Login: rebuilt as the botanical split-panel — left art panel (dark ink
  radial-gradient wash, botanical logo, room-living photo, serif pull-quote),
  right cream form panel with serif headings, accent tabs/buttons/inputs.
  All sign-in / sign-up / forgot-password logic unchanged; only presentation
  and token/accent classes swapped (indigo/slate/gradients → botanical).
- Landing: rebuilt the hero into the two-column editorial layout — serif
  "Run your hostel / with calm." headline with italic accent line, room-
  bedroom photo in a rounded art card, moss CTAs, ★ 4.9/5 strip; remapped the
  rest of the page (features / how-it-works / pricing / CTA / footer / preview
  mock) from bg-white/gray + purple utilities to design tokens + accent, with
  serif section headings.
- Reset-password, guest self check-in wizard, check-in success, onboarding,
  and demo pages remapped from slate/gray/white + indigo/violet utilities to
  the botanical token + accent system so the whole auth/guest flow reads
  consistently.

tsc clean, production build passes (48/48 pages).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [b9e7c89] - 2026-07-04

feat: Botanical Refresh — Stage 2 (login split-panel, landing hero, auth surfaces)

- Login: rebuilt as the botanical split-panel — left art panel (dark ink
  radial-gradient wash, botanical logo, room-living photo, serif pull-quote),
  right cream form panel with serif headings, accent tabs/buttons/inputs.
  All sign-in / sign-up / forgot-password logic unchanged; only presentation
  and token/accent classes swapped (indigo/slate/gradients → botanical).
- Landing: rebuilt the hero into the two-column editorial layout — serif
  "Run your hostel / with calm." headline with italic accent line, room-
  bedroom photo in a rounded art card, moss CTAs, ★ 4.9/5 strip; remapped the
  rest of the page (features / how-it-works / pricing / CTA / footer / preview
  mock) from bg-white/gray + purple utilities to design tokens + accent, with
  serif section headings.
- Reset-password, guest self check-in wizard, check-in success, onboarding,
  and demo pages remapped from slate/gray/white + indigo/violet utilities to
  the botanical token + accent system so the whole auth/guest flow reads
  consistently.

tsc clean, production build passes (48/48 pages).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [b9e7c89] - 2026-07-04

feat: Botanical Refresh — Stage 2 (login split-panel, landing hero, auth surfaces)

- Login: rebuilt as the botanical split-panel — left art panel (dark ink
  radial-gradient wash, botanical logo, room-living photo, serif pull-quote),
  right cream form panel with serif headings, accent tabs/buttons/inputs.
  All sign-in / sign-up / forgot-password logic unchanged; only presentation
  and token/accent classes swapped (indigo/slate/gradients → botanical).
- Landing: rebuilt the hero into the two-column editorial layout — serif
  "Run your hostel / with calm." headline with italic accent line, room-
  bedroom photo in a rounded art card, moss CTAs, ★ 4.9/5 strip; remapped the
  rest of the page (features / how-it-works / pricing / CTA / footer / preview
  mock) from bg-white/gray + purple utilities to design tokens + accent, with
  serif section headings.
- Reset-password, guest self check-in wizard, check-in success, onboarding,
  and demo pages remapped from slate/gray/white + indigo/violet utilities to
  the botanical token + accent system so the whole auth/guest flow reads
  consistently.

tsc clean, production build passes (48/48 pages).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [b9e7c89] - 2026-07-04

feat: Botanical Refresh — Stage 2 (login split-panel, landing hero, auth surfaces)

- Login: rebuilt as the botanical split-panel — left art panel (dark ink
  radial-gradient wash, botanical logo, room-living photo, serif pull-quote),
  right cream form panel with serif headings, accent tabs/buttons/inputs.
  All sign-in / sign-up / forgot-password logic unchanged; only presentation
  and token/accent classes swapped (indigo/slate/gradients → botanical).
- Landing: rebuilt the hero into the two-column editorial layout — serif
  "Run your hostel / with calm." headline with italic accent line, room-
  bedroom photo in a rounded art card, moss CTAs, ★ 4.9/5 strip; remapped the
  rest of the page (features / how-it-works / pricing / CTA / footer / preview
  mock) from bg-white/gray + purple utilities to design tokens + accent, with
  serif section headings.
- Reset-password, guest self check-in wizard, check-in success, onboarding,
  and demo pages remapped from slate/gray/white + indigo/violet utilities to
  the botanical token + accent system so the whole auth/guest flow reads
  consistently.

tsc clean, production build passes (48/48 pages).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [92ef7f7] - 2026-07-04

feat: apply Botanical Refresh design — foundation (tokens, fonts, accent, app re-skin)

Stage 1 of the botanical-refresh redesign from design_handoff_botanical_refresh/.
This re-skins the entire authenticated app; landing + login get a bespoke
redesign in a follow-up.

- Tokens (globals.css): replaced light + dark variable blocks with the warm
  botanical palette — cream paper #F3EEE2, surface #FBF8F1, warm near-black
  text, moss accent #5F7048, muted status colors, 12px radius, 248px sidebar.
  Warm charcoal dark mode with lighter-moss accent.
- Fonts: wired Cormorant Garamond (display serif) + Hanken Grotesk (body sans)
  via next/font in the root layout; added fontFamily.serif to tailwind and
  switched body default to Hanken. Base h1 rule renders every page title in
  the serif automatically.
- Accent presets: swapped the 9 per-tenant theme_color presets to the
  botanical set (moss/sage/fern/teal/ocean/clay/terracotta/plum/ink); default
  moved purple → moss everywhere it was hardcoded (tenant layout fallback,
  property settings, demo seed, demo banner gradient). Added color_* i18n
  keys for the new preset names across all 11 locales, removed the old ones.
- Status pills: reservation + tape-chart + team-role status colors retuned to
  the muted botanical palette (Confirmed/Pending/Checked-In/Checked-Out/
  Cancelled) per the handoff cheatsheet.
- App surfaces: remapped ~176 hardcoded slate/gray/white utility classes to
  design tokens (bg-surface/bg-muted/text-foreground/text-muted-foreground/
  border-border) across 12 app components that previously ignored the token
  system — chiefly the dashboard, which was fully hardcoded. Also swapped all
  inline purple hex/rgba gradients to moss/sage across shared surfaces.
- Assets: copied the botanical logo + room photos into public/botanical/.

Landing page, login split-panel, and onboarding keep their old purple styling
for now (Stage 2). tsc clean, production build passes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## [a01ae0e] - 2026-07-04

docs: add design reference doc for UI redesign via Claude Artifacts

Design tokens (light/dark), tech constraints, per-tenant accent
presets, full screen inventory, and density notes - for pasting into
a Claude Artifacts conversation to design a new UI style.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [abbd331] - 2026-07-04

fix: address remaining Phase 18 review findings

- src/lib/types/housekeeping.ts: new shared HOUSEKEEPING_STATUSES
  const + HousekeepingStatus type, replacing 3 independently hardcoded
  copies of the same 4-value list (API route, client STATUS_VALUES,
  STATUS_COLORS keys) - a future status addition/rename now only
  needs one edit instead of three with no compiler signal on drift.

- beds/[id]/housekeeping/route.ts: added the explicit membership
  check the sibling beds/[id]/route.ts CRUD endpoint already does,
  instead of relying solely on RLS - closes the inconsistent
  authorization-philosophy gap between two adjacent endpoints on the
  same resource. Also scopes the update itself to organization_id as
  defense in depth.

- use-housekeeping.ts: the initial fetch and the Realtime subscription
  now sequence properly (subscribe only after the fetch resolves),
  closing a race where a concurrent update from another user during
  the fetch window could be dropped and then overwritten by the
  fetch's stale snapshot. updateStatus also now checks response.ok,
  rolls back the optimistic UI update, and shows an error toast on
  failure, instead of silently leaving the UI showing a status that
  was never actually persisted.

- pending-check-ins-client.tsx: added a title hover-fallback to the
  3 cells (check-in date, room, submitted time) that lost their full
  value when truncate was added earlier this session to fix the
  card-overlap bug - only the email cell had gotten one.

- housekeeping-client.tsx: room groups are now keyed by roomId instead
  of roomName in the React .map() - two rooms sharing a display name
  would otherwise collide as the same React key.

Found during a full-phase code review (8-angle diff scan) requested
after Phase 18 shipped.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [5823c68] - 2026-07-04

fix: extract shared finalizeCheckout helper, fixing missing email on second checkout path

The "mark bed dirty" logic was duplicated verbatim across
/api/reservations/[id]/checkout and the generic /api/reservations/[id]
PATCH route (used by the Reservations list dropdown and
edit-reservation-drawer). Extracted both bed-dirtying and the
checkout confirmation email into src/lib/checkout.ts's
finalizeCheckout(), called from both routes.

This also fixes a real, previously-unnoticed gap: checking out via the
Reservations list or edit drawer never sent the checkout confirmation
email that the dedicated CheckoutDialog path sends - both paths now
behave identically. Each side effect (bed-dirty, email) keeps its own
inner try/catch so a failure in either can never block or fail the
checkout response.

Found during a full-phase code review requested after Phase 18
shipped.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [8f704bd] - 2026-07-04

fix: add missing local migration files for notifications and housekeeping

Both the Phase 17 notifications table and the Phase 18 beds
housekeeping_status columns were applied directly to the live
Supabase project via mcp__supabase__apply_migration, but never saved
as local .sql files under supabase/migrations/ - breaking the
established convention this project otherwise follows for every
schema change (10 prior migration files exist). Any environment
rebuilt from the checked-in migrations (fresh CI, supabase db reset,
staging re-provision) was missing both, and every housekeeping/
notifications code path would fail with a column/table-does-not-exist
error despite the app code being correct.

Filenames/timestamps match exactly what's already applied live, per
mcp__supabase__list_migrations (20260703140527_create_notifications_table,
20260703202235_add_housekeeping_status_to_beds) - these are the
historical record of what already ran, not a new migration to apply.

Found during a full-phase code review (8-angle diff scan) requested
after Phase 18 shipped.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [dab5375] - 2026-07-04

fix: prevent info card text overlap on Pending Check-Ins when sidebar is open

Root cause: the 4-column info grid (check-in date, room, email,
submitted time) had no min-w-0 on its grid cells. CSS grid/flex items
default to min-width: auto, which refuses to shrink below content
size — so a long, space-less email address overflowed its cell and
visually bled into the neighboring "Submitted" column instead of
wrapping or truncating. This only became visible once the sidebar
being open left less width for the content area.

Fixed by adding min-w-0 to every grid cell (and the outer flex
container, since the same min-width:auto default applies up the flex
chain) plus truncate on each value, with a title attribute on the
email so the full address is still available on hover. Grid also
goes 2 columns on narrow screens (sm:grid-cols-4) instead of always
cramming 4 in, matching the app's existing responsive patterns.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [c9f240c] - 2026-07-04

style: standardize refresh button style across housekeeping and analytics

Both switched from the rounded-full pill to the bordered rounded-xl
rectangle already used on the Guest Book page's Refresh/Export CSV
buttons, so all three pages now share one consistent refresh button
design.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [104bb3d] - 2026-07-04

feat: add refresh button to analytics page

Analytics is fully server-rendered with no client-side data fetching,
so refresh triggers a Next.js router.refresh() (wrapped in
useTransition for the pending/spin state) to re-run the server
component and pull fresh metrics. Same pill-button styling as the
housekeeping and checkin-history refresh buttons. New "refresh" key
added to the analytics i18n namespace across all 11 locales, 1139
keys total.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [e16c06f] - 2026-07-04

style: move Refresh/Export buttons from page header to table toolbar

Guest Book page header now shows only title/count; Refresh and Export
CSV/Excel moved to a toolbar row alongside the search input, directly
above the table — for consistency with other table-driven pages.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [d82c76e] - 2026-07-04

style: restyle housekeeping refresh button as a labeled pill

Icon-only square button changed to a rounded-full pill with icon +
"Refresh" label, matching the requested look.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [ecbf19a] - 2026-07-03

fix: show housekeeping status info on tape chart warning icon hover

Wraps the warning icon in a span with a native title attribute (lucide
icons don't accept title directly) so hovering shows "This bed needs
cleaning" / "This bed is out of order" as a tooltip. Also colors the
icon amber for dirty vs red for out_of_order, matching the housekeeping
board's own status colors, so the two states are visually distinct at
a glance without needing to hover.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [fc41ed4] - 2026-07-03

fix: mark bed dirty on checkout via the generic reservation PATCH route too

Root cause: checking out a guest through the Reservations list's inline
status dropdown or the edit-reservation-drawer's status field calls
PATCH /api/reservations/[id] (the generic update route), not the
dedicated /api/reservations/[id]/checkout route Task 2 of Phase 18
patched. That generic route already had its own special-cased
"if status === checked_out" block (for checkin_registry), so it was
the obvious place to have missed - confirmed via querying real
checked-out reservations and their beds' housekeeping_updated_at
timestamps, which showed no auto-dirty had ever fired for a bed
checked out through this path.

Same fix as Task 2: fetch reservation_items -> bed_id, mark dirty
excluding out_of_order, wrapped in its own inner try/catch so a bed
update failure can never turn an already-successful status update
into a false error response (the route already has one broad outer
try/catch).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [38467ac] - 2026-07-03

feat: add manual refresh button to housekeeping board

Wires the useHousekeeping hook's existing refetch() to a button next
to the filter tabs, with a spin animation while in flight. New
"refresh" key added to the housekeeping i18n namespace across all 11
locales, 1138 keys total.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [ee19a37] - 2026-07-03

docs: add Phase 18 housekeeping design doc and implementation plan

docs/phases/PHASE_18_PLAN.md - brainstorming skill output: understanding
summary, assumptions, decision log, full design (data model, auto-dirty
trigger, manual API, Realtime hook, UI, warning badge, edge cases).

docs/plans/2026-07-03-phase18-housekeeping.md - writing-plans skill
output: 11 bite-sized tasks executed via subagent-driven-development.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3ef75b3] - 2026-07-03

feat: translate housekeeping namespace into all 10 non-English locales

18 keys per locale (sidebar.nav, header.pageTitles, calendar.tapeChart
warnings x2, housekeeping namespace x13) - same script-based pattern
as every prior i18n stage. Verified identical key structure across
all 11 locales, 1137 keys total.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [58823ac] - 2026-07-03

feat: add housekeeping i18n keys to en.json

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [2a43e37] - 2026-07-03

feat: show housekeeping warning badge on tape chart bed rows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [16b2cfc] - 2026-07-03

feat: add housekeeping nav entry and page title

## [05dabd8] - 2026-07-03

feat: add housekeeping board page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [e148bc4] - 2026-07-03

feat: add useHousekeeping client hook with Realtime subscription

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [924600d] - 2026-07-03

feat: add manual housekeeping status API route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [924600d] - 2026-07-03

feat: add manual housekeeping status API route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [924600d] - 2026-07-03

feat: add manual housekeeping status API route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [924600d] - 2026-07-03

feat: add manual housekeeping status API route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [cb6cf3a] - 2026-07-03

feat: auto-mark bed dirty on guest checkout

## [31678ca] - 2026-07-03

feat: add housekeeping_status columns to beds table

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [791de7f] - 2026-07-03

feat: translate notifications namespace into all 10 non-English locales

8 keys per locale (title, markAllRead, empty, types.{5 events}) -
same script-based pattern used throughout Phase 16. Verified identical
key structure across all 11 locales via flatten-and-diff script,
1119 keys total.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [2d6746f] - 2026-07-03

feat: add notifications i18n namespace to en.json

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [d8b18d8] - 2026-07-03

feat: replace placeholder bell with real NotificationBell dropdown

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [9a1d8c9] - 2026-07-03

feat: add useNotifications client hook with Realtime subscription

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [69c2656] - 2026-07-03

feat: add mark-as-read and mark-all-read notification endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [87f325a] - 2026-07-03

feat: notify staff on channel sync failure

Two insertion points: the inner catch for iCal-fetch failures, and
the outer catch for anything else. Hoisted `orgId` out of the `try`
block (it needs to be readable from the `catch` block, which is a
separate scope in TS/JS — a `let` declared inside `try` isn't visible
there) and added an explicit `if (!orgId)` guard so the rest of the
function keeps a definite `string` type. Uses `channel.name` for the
notification's display label (verified against channels-client.tsx —
that's the primary label shown in the UI; `platform` is a secondary
badge).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3f2d9bd] - 2026-07-03

feat: notify staff on duplicate guest detection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3f2d9bd] - 2026-07-03

feat: notify staff on duplicate guest detection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3f2d9bd] - 2026-07-03

feat: notify staff on duplicate guest detection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [273777a] - 2026-07-03

feat: notify staff on reservation cancellation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [86ddd13] - 2026-07-03

feat: notify staff on new reservation created

## [f6877da] - 2026-07-03

feat: notify staff on guest check-in submission

## [c8a1570] - 2026-07-03

docs: add Phase 17 notifications design doc and implementation plan

docs/phases/PHASE_17_PLAN.md - brainstorming skill output: understanding
summary, assumptions, decision log, full design (data model, server
triggers, client/Realtime, UI, edge cases, verification strategy).

docs/plans/2026-07-03-phase17-notifications.md - writing-plans skill
output: 14 bite-sized tasks executed via subagent-driven-development.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [dc24e4c] - 2026-07-03

fix: regenerate Supabase database types to include notifications table

src/lib/types/database.ts was stale — it predated the Task 1 migration,
so `.from("notifications")` didn't typecheck without an `any` escape
hatch. Regenerated via mcp__supabase__generate_typescript_types and
restored the hand-appended convenience type aliases (Room, Bed,
RoomType, DocumentMetadata, etc.) that the raw generator output
doesn't include, plus a new `Notification` alias.

Removed the `any` cast from src/lib/notifications.ts now that the
table is properly typed; kept a narrow `data as Json` cast at the
insert boundary since caller-supplied `Record<string, unknown>`
genuinely isn't statically assignable to the generated `Json` type.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [ed426a8] - 2026-07-03

feat: add notifyOrg helper for Phase 17 notifications

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [e1403b0] - 2026-07-03

feat: Phase 16 - translate document upload, merge/OCR dialogs, cancel/checkout dialogs

Final batch of the 8-file gap list found by a full next-intl audit
sweep (grep -L "next-intl" across src/app and src/components):

- src/components/guests/document-upload.tsx
- src/components/guests/duplicate-merge-dialog.tsx
- src/components/guests/ocr-extraction-dialog.tsx
- src/components/reservations/cancel-reservation-dialog.tsx
- src/components/reservations/checkout-dialog.tsx

duplicate-merge-dialog.tsx and ocr-extraction-dialog.tsx both stripped
the English `label` field off their GUEST_FIELDS arrays in favor of
dynamic `t(`fields.${key}`)` lookups (20 keys for merge, 10 for OCR).
cancel-reservation-dialog.tsx converted CANCELLATION_REASONS to a
plain value array + `reason_${value}` lookups, and uses t.rich() to
bold the guest name in the cancellation warning.

119 new keys (documentUpload, duplicateMergeDialog,
ocrExtractionDialog, cancelReservationDialog, checkoutDialog) added to
all 11 locale files, 1111 keys total. Verified: identical key structure
across every locale (script diff), every literal t() call resolves
against en.json (regex + resolution script), dynamic template-literal
lookups and t.rich() calls spot-checked manually, npx tsc --noEmit
clean, npm run build passes (47/47 static pages, exit 0).

This closes the full-app i18n audit for Phase 16.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [1048b63] - 2026-07-03

feat: Phase 16 - translate document upload, merge/OCR dialogs, cancel/checkout dialogs

Final batch of the 8-file gap list found by a full next-intl audit
sweep (grep -L "next-intl" across src/app and src/components):

- src/components/guests/document-upload.tsx
- src/components/guests/duplicate-merge-dialog.tsx
- src/components/guests/ocr-extraction-dialog.tsx
- src/components/reservations/cancel-reservation-dialog.tsx
- src/components/reservations/checkout-dialog.tsx

duplicate-merge-dialog.tsx and ocr-extraction-dialog.tsx both stripped
the English `label` field off their GUEST_FIELDS arrays in favor of
dynamic `t(`fields.${key}`)` lookups (20 keys for merge, 10 for OCR).
cancel-reservation-dialog.tsx converted CANCELLATION_REASONS to a
plain value array + `reason_${value}` lookups, and uses t.rich() to
bold the guest name in the cancellation warning.

119 new keys (documentUpload, duplicateMergeDialog,
ocrExtractionDialog, cancelReservationDialog, checkoutDialog) added to
all 11 locale files, 1111 keys total. Verified: identical key structure
across every locale (script diff), every literal t() call resolves
against en.json (regex + resolution script), dynamic template-literal
lookups and t.rich() calls spot-checked manually, npx tsc --noEmit
clean, npm run build passes (47/47 static pages, exit 0).

This closes the full-app i18n audit for Phase 16.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [0358dd3] - 2026-07-03

feat: Phase 16 - translate demo banner, welcome modal, check-in link button

- Found via a full re-audit after the channels gap: [slug]/layout.tsx
  demo banner, demo-welcome-modal.tsx (first-visit popup), and
  check-in-link-button.tsx (dashboard/reservation-drawer QR+link
  widget) had no next-intl coverage at all
- Fixed a real bug in demo-welcome-modal.tsx: suggestion clicks did
  `window.location.href = /${slug}/${href}` with no locale prefix,
  so clicking a suggestion from e.g. /zh/... would drop back to
  unprefixed (default English) routing. Now prefixes with the
  current locale via useLocale().
- 29 new keys (demoBanner, demoWelcome, checkInLinkButton) across all
  11 languages, 992 keys total - verified identical structure + every
  literal t() call resolved against en.json via script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3c6f8ea] - 2026-07-03

feat: Phase 16 - translate channel manager page

- channels-client.tsx + channels/page.tsx: header/connection counts,
  paywall gate, per-bed platform badges, sync/edit/delete actions,
  relative "synced X ago" timestamps, inline edit form, add-platform
  forms (both the connected-bed and unconnected-bed variants), all
  toasts
- Brand names (Booking.com, Airbnb, VRBO, Expedia, Hostelworld) stay
  untranslated in every language, matching how currency codes and
  plan names were handled elsewhere - only the two generic platform
  labels ("Direct", "Other") translate
- This section wasn't part of the original Phase 16 plan doc (guests/
  rooms/settings/guest-portal/analytics/checkin-history) - found
  missing when the user checked the live Chinese UI after deploy
- 49 new keys (channels namespace) across all 11 languages, 963 keys
  total - verified identical structure + every literal t() call
  resolved against en.json via script; full production build passes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3c6f8ea] - 2026-07-03

feat: Phase 16 - translate channel manager page

- channels-client.tsx + channels/page.tsx: header/connection counts,
  paywall gate, per-bed platform badges, sync/edit/delete actions,
  relative "synced X ago" timestamps, inline edit form, add-platform
  forms (both the connected-bed and unconnected-bed variants), all
  toasts
- Brand names (Booking.com, Airbnb, VRBO, Expedia, Hostelworld) stay
  untranslated in every language, matching how currency codes and
  plan names were handled elsewhere - only the two generic platform
  labels ("Direct", "Other") translate
- This section wasn't part of the original Phase 16 plan doc (guests/
  rooms/settings/guest-portal/analytics/checkin-history) - found
  missing when the user checked the live Chinese UI after deploy
- 49 new keys (channels namespace) across all 11 languages, 963 keys
  total - verified identical structure + every literal t() call
  resolved against en.json via script; full production build passes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3c6f8ea] - 2026-07-03

feat: Phase 16 - translate channel manager page

- channels-client.tsx + channels/page.tsx: header/connection counts,
  paywall gate, per-bed platform badges, sync/edit/delete actions,
  relative "synced X ago" timestamps, inline edit form, add-platform
  forms (both the connected-bed and unconnected-bed variants), all
  toasts
- Brand names (Booking.com, Airbnb, VRBO, Expedia, Hostelworld) stay
  untranslated in every language, matching how currency codes and
  plan names were handled elsewhere - only the two generic platform
  labels ("Direct", "Other") translate
- This section wasn't part of the original Phase 16 plan doc (guests/
  rooms/settings/guest-portal/analytics/checkin-history) - found
  missing when the user checked the live Chinese UI after deploy
- 49 new keys (channels namespace) across all 11 languages, 963 keys
  total - verified identical structure + every literal t() call
  resolved against en.json via script; full production build passes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3c6f8ea] - 2026-07-03

feat: Phase 16 - translate channel manager page

- channels-client.tsx + channels/page.tsx: header/connection counts,
  paywall gate, per-bed platform badges, sync/edit/delete actions,
  relative "synced X ago" timestamps, inline edit form, add-platform
  forms (both the connected-bed and unconnected-bed variants), all
  toasts
- Brand names (Booking.com, Airbnb, VRBO, Expedia, Hostelworld) stay
  untranslated in every language, matching how currency codes and
  plan names were handled elsewhere - only the two generic platform
  labels ("Direct", "Other") translate
- This section wasn't part of the original Phase 16 plan doc (guests/
  rooms/settings/guest-portal/analytics/checkin-history) - found
  missing when the user checked the live Chinese UI after deploy
- 49 new keys (channels namespace) across all 11 languages, 963 keys
  total - verified identical structure + every literal t() call
  resolved against en.json via script; full production build passes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [41b394e] - 2026-07-03

feat: Phase 16 - translate analytics + guest book, closes Phase 16

- analytics-client.tsx + paywall.tsx: charts, empty states, paywall
  gate copy (feature name/description passed in from analytics/page.tsx
  via getTranslations, everything else inside Paywall itself)
- checkin-history-client.tsx (Guest Book / Serbian compliance
  registry): header, search, refresh/export buttons, at-limit banner
  (t.rich for the bold plan name), empty state, full table, the large
  edit dialog (personal info / identity document / stay details
  sections), both searchable country dropdowns
- Deliberately left the CSV export function's column headers and
  DOC_LABELS/SERVICE_LABELS value maps in English - it's an audit/
  compliance export (JMBG, official ID fields), not screen UI. Added
  separate translated docType_*/serviceType_* lookups for on-screen
  display only, so the exported file's structure doesn't shift per
  interface language while the visible table shows the current locale.
- 80 new keys (paywall, analytics, checkinHistory) across all 11
  languages, 914 keys total - verified identical structure + every
  literal t() call resolved against en.json via script; full
  production build passes (14s, 47 routes)
- This closes out Phase 16 multi-language support: every staff-facing
  and guest-facing section of the app now has full i18n coverage
  across 11 languages (en/zh/hi/es/fr/ar/bn/pt/ru/ja/sr)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [ce5ddbb] - 2026-07-03

feat: Phase 16 - translate guest portal check-in flow

- check-in-form.tsx: 4-step wizard (details/photos/review/submit),
  all validation messages, file-upload errors, searchable
  nationality dropdown, document type lookup, review summary,
  submission notice - the highest-priority section per the i18n plan
  since real international guests use this without any staff login
- check-in-success.tsx: confirmation screen; also fixed a hardcoded
  toLocaleDateString("en-US", ...) to use the active locale so the
  check-in date actually renders in the guest's language
- Fixed a real structural bug found while translating: guest-portal/
  layout.tsx rendered its own nested <html>/<body>, left over from
  before this route was moved under [locale] - the root layout.tsx
  already renders <html>/<body>, so this produced invalid nested
  markup on every guest-portal page load. Converted to a plain div
  wrapper carrying the same background styling.
- next.config.ts: added outputFileTracingRoot to pin Next's file
  tracing to this project. A stray package-lock.json in the parent
  C:\CCPCjs directory (shared by unrelated sibling projects) was
  making Next infer that as the monorepo root and trace their entire
  node_modules trees on every build - harmless correctness-wise but
  worth fixing since it also affects what gets traced into the
  Vercel serverless bundle.
- 73 new keys (guestPortal.checkInForm + guestPortal.checkInSuccess)
  across all 11 languages, 834 keys total - verified identical
  structure + every literal t() call resolved against en.json via
  script; full production build passes (45s, 47 routes)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [8f5039a] - 2026-07-02

feat: Phase 16 - translate settings/property page, closes out settings

- property-settings-client.tsx: branding (logo upload, accent color
  picker with 9 named presets via t(`color_${key}`)), basic info
  (searchable country/city dropdowns via country-state-city), online
  presence, operations (check-in/out time, timezone, currency), all
  toasts
- logo-crop-modal.tsx: crop dialog title/hints/guidelines, aspect
  ratio switcher (1:1/4:3/free), live preview labels, actions
- Currency codes (EUR, USD...) and IANA timezone names left untouched
  - they're identifiers, not display copy
- 91 new keys (settings.property + settings.property.cropModal)
  across all 11 languages, 761 keys total - verified identical
  structure + every literal t() call resolved against en.json via
  script
- This closes out the entire settings section (team, billing,
  property - 6 components across 3 commits)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [1821d47] - 2026-07-02

feat: Phase 16 - translate settings/billing page

- billing-client.tsx: payment-required gate banner (t.rich for the
  bold plan name), current plan card + usage bars, plan comparison
  cards with per-plan feature bullets, upgrade/downgrade buttons, all
  toasts
- Per-plan feature lists moved from a hardcoded array on each PLANS
  entry to messages/*.json (settings.billing.features.{free,pro,scale})
  and read via t.raw() - next-intl supports raw JSON array values, not
  just strings, so this keeps the bullets translated without a bespoke
  lookup scheme
- PLAN_NAMES/PLAN_PRICES (lib/plan.ts) intentionally left untouched -
  they're product/pricing constants, not UI copy
- 25 new keys (settings.billing, including the 3 features arrays)
  across all 11 languages, 686 keys total - verified identical
  structure (including matching array lengths per locale) + every
  literal t() call resolved against en.json via script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3a1a4fb] - 2026-07-02

feat: Phase 16 - translate settings/team page

- team-settings-client.tsx + team/page.tsx: member/invite counts
  (ICU plural), invite form, role dropdowns + badges (dynamic
  t(`role_${r}`) lookup covering owner/manager/admin/staff - admin
  isn't offered in the invite dropdown but is a valid legacy role per
  the API's permission checks, so it needed a translation too),
  members list, pending invitations list, all toasts/confirms
- 31 new keys (settings.team) across all 11 languages, 650 keys total
  - verified identical structure + every static t() call resolved
  against en.json via script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [528f8da] - 2026-07-02

feat: Phase 16 - translate beds section, closes out rooms page

- beds-list-client.tsx + beds-dialog.tsx: search, sortable table,
  status badges, empty states, pagination, full create/edit form
  (room, name, position, active toggle), delete confirm/toasts
- 40 new keys (rooms.beds + rooms.beds.dialog) across all 11
  languages, 619 keys total - verified identical structure + every
  static t() call resolved against en.json via script
- This closes out the entire rooms page (room types + rooms + beds,
  6 components translated across 3 commits)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [60f0b45] - 2026-07-02

feat: Phase 16 - translate rooms section

- rooms-list-client.tsx + rooms-dialog.tsx: search, sortable table,
  empty states, pagination, full create/edit form (room type, name,
  floor, notes), delete confirm/toasts
- Fixed a real pre-existing bug found while translating: the table
  header read "Floor, Room Type" but the row cells rendered Room Type
  then Floor, so data showed under the wrong column - reordered cells
  to match headers
- 44 new keys (rooms.rooms + rooms.rooms.dialog) across all 11
  languages, 579 keys total - verified identical structure + every
  static t() call resolved against en.json via script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [65307b1] - 2026-07-02

feat: Phase 16 - translate rooms page + room types section

- rooms/page.tsx: outer page shell (title, unauthorized/no-org
  states, 3 collapsible section headers with ICU-plural counts)
- room-types-list-client.tsx + room-types-dialog.tsx: search, sortable
  table, empty states, pagination, full create/edit form (name, type,
  gender, capacity, base price, description), delete confirm/toasts
- Same value-array + t(`prefix_${v}`) lookup pattern as the guest
  dialog's DOCUMENT_TYPES/GENDERS for ROOM_TYPE_VALUES/GENDER_VALUES
- Renamed the dialog's ROOM_TYPES.map((t) => ...) loop variable to
  `rt` - it shadowed the new useTranslations() `t` function
- 57 new keys (rooms namespace incl. nested rooms.types +
  rooms.types.dialog) across all 11 languages, 540 keys total -
  verified identical structure + every static t() call resolved
  against en.json via script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [31e0934] - 2026-07-02

feat: Phase 16 - translate guest create/edit dialog

- guest-dialog.tsx: full create/edit form (name, contact, gender,
  nationality with searchable country dropdown, date of birth,
  place/country of birth+residence, JMBG), collapsible document info
  section, OCR upload prompt, document upload, duplicate-guest alert
  with merge/use-existing actions, danger zone delete, all toasts
- Kept DOCUMENT_TYPES/GENDERS as plain value arrays (was label pairs)
  and translate the displayed <option> label via a `t(`docType_${v}`)`
  / `t(`gender_${v}`)` lookup, so the underlying form value sent to
  the API is untouched - same pattern used for pendingCheckIns
  rejection reasons in an earlier stage
- 69 new keys under guests.dialog across all 11 languages (483 keys
  total) - verified identical structure across all 11 locale files;
  static t("...") calls cross-checked against en.json via script,
  dynamic t(`prefix_${v}`) calls checked manually since the regex
  verification script only resolves literal string arguments

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [1f78cb3] - 2026-07-02

feat: Phase 16 - translate guest directory list page

- guest-list-client.tsx + guests/page.tsx: title, search, sortable
  table headers, empty states, row actions, delete confirm/toasts,
  pagination summary
- 25 new message keys across all 11 languages (new guests namespace,
  413 keys total) - verified identical structure across all 11 locale
  files + every t() call cross-checked against en.json via script
- guest-dialog.tsx (create/edit form, OCR scan, document upload) is a
  separate, much larger component - left untranslated for now, next
  in this stage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3ccd54c] - 2026-07-02

fix: upgrade Next.js 15.3.2 -> 15.5.20, fixes Vercel security gate

Vercel now hard-blocks builds on Next.js versions with known CVEs
("Vulnerable version of Next.js detected"). 15.3.2 was affected by
several (RCE via React flight protocol, cache poisoning, middleware
SSRF, among others) - all patched in 15.5.x. Same major version, no
breaking changes expected; verified with a full typecheck + build.

Also ran `npm audit fix` for a moderate js-yaml DoS advisory picked up
along the way. Left one remaining moderate postcss advisory nested
inside Next's own bundled tooling - npm's suggested fix would downgrade
Next to 9.3.3, which isn't a real fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3ccd54c] - 2026-07-02

fix: upgrade Next.js 15.3.2 -> 15.5.20, fixes Vercel security gate

Vercel now hard-blocks builds on Next.js versions with known CVEs
("Vulnerable version of Next.js detected"). 15.3.2 was affected by
several (RCE via React flight protocol, cache poisoning, middleware
SSRF, among others) - all patched in 15.5.x. Same major version, no
breaking changes expected; verified with a full typecheck + build.

Also ran `npm audit fix` for a moderate js-yaml DoS advisory picked up
along the way. Left one remaining moderate postcss advisory nested
inside Next's own bundled tooling - npm's suggested fix would downgrade
Next to 9.3.3, which isn't a real fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3ccd54c] - 2026-07-02

fix: upgrade Next.js 15.3.2 -> 15.5.20, fixes Vercel security gate

Vercel now hard-blocks builds on Next.js versions with known CVEs
("Vulnerable version of Next.js detected"). 15.3.2 was affected by
several (RCE via React flight protocol, cache poisoning, middleware
SSRF, among others) - all patched in 15.5.x. Same major version, no
breaking changes expected; verified with a full typecheck + build.

Also ran `npm audit fix` for a moderate js-yaml DoS advisory picked up
along the way. Left one remaining moderate postcss advisory nested
inside Next's own bundled tooling - npm's suggested fix would downgrade
Next to 9.3.3, which isn't a real fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [5308ec0] - 2026-07-02

fix: normalize NEXT_PUBLIC_SITE_URL when scheme is missing

Vercel deploy failed with "TypeError: Invalid URL" because
NEXT_PUBLIC_SITE_URL was set to "hostmagsmart.com" (no https://) in the
dashboard, and next.config.ts's `new URL(...)` call for
serverActions.allowedOrigins throws on a bare hostname.

Six other call sites had the same latent bug (email.ts, qr-code.ts,
billing checkout/portal, channels sync-all, team invite) - they just
happened to build a string instead of calling `new URL()`, so they'd
have silently produced broken links (e.g. "hostmagsmart.com/invite/...")
instead of crashing the build.

Added src/lib/site-url.ts with a single getSiteOrigin() helper that
normalizes the scheme, and pointed all six at it instead of repeating
the env var fallback chain ad hoc.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [70b25cc] - 2026-07-02

chore: drop Vercel cron config, rely on manual channel sync

Hobby plan only allows daily cron schedules; the existing */15 * * * *
config would fail to deploy. /api/channels/sync-all already supports
authenticated user calls (not just the cron Bearer token), and the
channels UI already has a manual "sync now" button wired to it, so
dropping the cron entirely doesn't lose functionality for now.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [9e1da14] - 2026-07-02

chore: prepare codebase for Vercel deployment

- Replace stale hand-written src/lib/types/database.ts (a Phase 1
  starter never regenerated) with real Supabase-generated types
  covering every table/column added since. Was masking ~250 type
  errors as `never` across 32 files, blocking `next build`.
- Upgrade @supabase/ssr 0.6.1 -> 0.12.0: the old version's bundled
  types didn't match @supabase/supabase-js 2.106.1's schema shape,
  silently collapsing every chained `.from().select().eq()...` query
  result to `never[]` once 2+ filters were chained without an `any`
  escape hatch.
- Fix real bugs the new strict types surfaced: scan_sessions insert
  used nonexistent `user_id` (should be `created_by`) and never set
  the required unique `token`, so the OCR audit-trail insert silently
  failed every call; reservation_items has no `status` column, so
  occupancy/revenue queries filtering on it were broken (fixed via
  `reservations!inner(status)` joins); document-upload.tsx read
  `doc.filePath` off a type that never declared it; demo seed data
  passed string floors instead of numbers and omitted the (trigger-
  populated) reservation_number.
- Fix Next.js 15 async params/searchParams (Promise<{...}>, awaited)
  in 4 route handlers that predated the Next 15 upgrade.
- Consolidate .env.example with all real vars, remove stale
  .env.local.example.
- next.config.ts serverActions.allowedOrigins and email.ts origin
  derivation now read NEXT_PUBLIC_SITE_URL/VERCEL_URL instead of
  being hardcoded to localhost.

npm run build now completes with zero type errors.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [Unreleased] - 2026-07-02

chore: prepare codebase for Vercel deployment

- Replaced the stale hand-written src/lib/types/database.ts (a Phase 1
  starter that was never regenerated) with real Supabase-generated
  types covering every table/column added since (payment_confirmed,
  deposit_amount, plan/stripe fields, checkin_registry, audit_log,
  channels, invitations, etc). This alone had been silently masking
  ~250 type errors across 32 files as `never`, blocking `next build`.
- Found and upgraded @supabase/ssr from 0.6.1 to 0.12.0: the old
  version's bundled types didn't match @supabase/supabase-js 2.106.1's
  newer schema shape, which silently collapsed EVERY chained
  `.from().select().eq()...` query result to `never[]` when 2+ filter
  methods were chained without an `any` escape hatch — a much bigger
  latent bug than the stale database.ts alone. Confirmed via isolated
  repro before touching the rest of the codebase.
- Fixed several real runtime bugs the new strict types surfaced:
  scan_sessions insert used a nonexistent `user_id` column (should be
  `created_by`) and never set the required unique `token` column, so
  the OCR audit-trail insert had been failing silently on every call;
  reservation_items has no `status` column, so the demo/analytics
  occupancy + daily-revenue queries were filtering on a column that
  doesn't exist there (fixed via `reservations!inner(status)` joins);
  document-upload.tsx read `doc.filePath` off a type that never
  defined it.
- Fixed Next.js 15 async `params`/`searchParams` (must be
  `Promise<{...}>` and awaited) in 4 route handlers that predated the
  Next 15 upgrade: guest-portal page + 3 API routes.
- Consolidated .env.example (all real vars: Supabase, Stripe, Resend,
  Anthropic, CRON_SECRET, NEXT_PUBLIC_SITE_URL) and removed the stale,
  drifted .env.local.example.
- Made next.config.ts's serverActions.allowedOrigins and email.ts's
  origin derivation both read NEXT_PUBLIC_SITE_URL/VERCEL_URL instead
  of being hardcoded to localhost.
- `npm run build` now completes with zero type errors (was ~250+).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [Unreleased] - 2026-07-02

feat: Phase 16 - translate reservations list page

- reservations-list-client.tsx + reservations/page.tsx: title, search,
  status/date filters, sortable table headers, empty states,
  pagination, row status dropdown, all toasts including check-in/
  check-out validation messages
- 39 new message keys across all 11 languages (new reservations
  namespace, 389 keys total in the whole message tree) - verified
  identical structure across all 11 locale files + every t() call
  cross-checked against en.json via script
- User caught this as "missing translation" right after the language
  switcher fix; confirmed sidebar/header were correctly translated
  (proving the provider-scope fix worked) — this page simply hadn't
  been translated yet, next in the plan's sequencing after calendar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [e7c6292] - 2026-07-02

fix: Phase 16 - client components not re-translating on locale switch

- Root cause: NextIntlClientProvider lived in root layout.tsx, which
  sits above the [locale] URL segment. Next.js doesn't re-run layouts
  above the segment that changed on client-side navigation, so
  switching locales via the header switcher left the provider serving
  stale messages to every client component (header, sidebar,
  arrivals-schedule, etc.) - only server-rendered content picked up
  the new locale. Caught live: URL changed to /zh/... but header/
  search/arrivals text stayed English while server-rendered stat cards
  correctly showed Chinese.
- Fix: moved NextIntlClientProvider into a new src/app/[locale]/layout.tsx
  (inside the segment that actually changes, so it re-runs on locale
  switch). Root layout.tsx keeps only html/body/Toaster + best-effort
  getLocale() for the initial <html lang> on full page loads.
- Belt-and-suspenders: header.tsx's switchLocale() now also calls
  router.refresh() after router.replace(), so <html lang>/dir stay in
  sync even on pure client-side locale-only transitions.
- Verified no component outside [locale] uses useTranslations/
  getTranslations (so removing the provider from root layout is safe),
  and that Header/Sidebar only ever render inside [locale]/[slug]/layout.tsx.
- This was a real regression affecting the entire app's client-side
  i18n, not a missing-translation gap - worth fixing before any more
  translation work, since it would've undermined all of it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [29789c1] - 2026-07-02

feat: Phase 16 - add manual language switcher to header

- Root cause of user-reported "wrong language selected" bug: browser
  Accept-Language header (not IP geolocation) drives auto-detection -
  working as designed, but there was no way to override it manually
- Added globe-icon dropdown in header.tsx listing all 11 languages
  (native names), checkmark on current locale, switches via
  router.replace(pathname, { locale }) from next-intl navigation
  (updates URL prefix + sets NEXT_LOCALE cookie, stays on same page)
- New header.language message key across all 11 locales (350 keys
  total now) - verified identical structure + every t() call
  cross-checked against en.json via script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [f487f7f] - 2026-07-02

feat: Phase 16 - add Serbian locale

- Added "sr" to src/i18n/routing.ts locales list (11 languages now)
- messages/sr.json: full 349-key translation (Latin script), matching
  the app's existing Serbia-specific conventions (RSD currency,
  Europe/Belgrade timezone, Serbia compliance fields from Phase 3)
- Serbian plural rules (one/few/other) applied to all ICU plural
  strings (nights, guest counts, check-in counts)
- Verified: 0 missing/extra keys vs en.json, /sr/login renders
  Serbian correctly, <html lang="sr" dir="ltr">, hreflang="sr"
  alternate present on public routes, no runtime errors

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [fd741e7] - 2026-07-02

feat: Phase 16 Stage 2f - translate pending-check-ins-client

- pending-check-ins-client.tsx (766 lines, last calendar-adjacent
  component): list view, bulk approve/reject bar, verification modal
  (guest info, ID photos, guest portal link + QR toggle), single and
  bulk rejection-reason dropdowns with translated labels while keeping
  underlying values in English (backend-compatible, unchanged data
  contract), all toasts
- 53 new message keys across all 10 languages (new pendingCheckIns
  namespace, 349 keys total in the whole message tree) - verified
  identical structure across all 10 locale files + every t() call
  cross-checked against en.json via script
- This closes out all calendar-adjacent components; next up is
  reservations/guests/rooms pages per the plan's sequencing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [Unreleased] - 2026-07-02

feat: Phase 16 Stage 2f - translate pending-check-ins-client

- pending-check-ins-client.tsx (766 lines, last calendar-adjacent
  component): list view, bulk approve/reject bar, verification modal
  (guest info, ID photos, guest portal link + QR toggle), single and
  bulk rejection-reason dropdowns with translated labels while keeping
  underlying values in English (backend-compatible, unchanged data
  contract), all toasts
- 53 new message keys across all 10 languages (new pendingCheckIns
  namespace, 349 keys total in the whole message tree) — verified
  identical structure across all 10 locale files + every t() call
  cross-checked against en.json via script
- This closes out all calendar-adjacent components; next up is
  reservations/guests/rooms pages per the plan's sequencing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [4c109e3] - 2026-07-02

feat: Phase 16 Stage 2e - translate edit-reservation-drawer

- edit-reservation-drawer.tsx (1153 lines, biggest single component
  in the app): dates, status dropdown (translated status labels
  replacing raw string-manipulation capitalization), guest
  search/reassign, folio ledger (original stay / extension segments,
  editable per-segment rates), payment fields, extend-stay flow with
  live balance preview, danger zone (cancel/delete), all toasts
- ~90 new message keys across all 10 languages (calendar.editReservation
  namespace, 296 keys total in the whole message tree now) - verified
  identical structure across all 10 locale files + every t() call
  cross-checked against en.json via script
- Known exclusion (same as Stage 2d): yup validation messages in
  src/lib/validations/reservation.ts stay English
- Still not included: pending-check-ins-client.tsx (766 lines) - last
  remaining calendar-adjacent component before moving to
  reservations/guests/rooms pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [f5c2d8b] - 2026-07-02

feat: Phase 16 Stage 2d - translate tape-chart + new-reservation-drawer

- tape-chart.tsx: empty state, availability legend, room type labels,
  block tooltip and total-price suffix (ICU-interpolated)
- new-reservation-drawer.tsx: full form (guest search/new-guest tabs,
  check-in/out, pricing, notes), conflict warning, toasts, ICU plural
  for night counts (proper plural rules per language: ru 4-way,
  ar 6-way, zh/ja invariant, etc.)
- All new keys translated across all 10 languages (calendar.tapeChart,
  calendar.newReservation namespaces, 189 keys total, verified
  identical structure across all 10 locale files + every t() call
  cross-checked against en.json via script)
- Known exclusion: react-hook-form/yup validation error messages
  (src/lib/validations/reservation.ts) stay English — translating
  those needs yup's locale-message API, separate architectural change
- Still not included (own future increment): edit-reservation-drawer
  (1153 lines) and pending-check-ins-client (766 lines)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [8c1925a] - 2026-07-02

feat: Phase 16 Stage 2c - translate dashboard + calendar

- dashboard/page.tsx (server component, getTranslations): setup
  progress card, stat cards with ICU-interpolated counts/percentages
- arrivals-schedule.tsx: table headers, check-in actions, empty state
- calendar/page.tsx + calendar-client.tsx: title, sync UI, status
  legend, sync-result toast with interpolated counts
- All new keys translated across all 10 languages (dashboard.*,
  calendar.* namespaces, 148 keys total, verified identical structure
  across all 10 locale files via script)
- Statically verified every t() call resolves to a real message key
  (dashboard/calendar are behind auth, couldn't screenshot directly —
  flagged for manual check)
- Not included this pass (deliberately, own future increment): the
  large calendar drawer components (edit-reservation-drawer 1153
  lines, new-reservation-drawer 516, tape-chart 366,
  pending-check-ins-client 766) — too large to safely bundle here

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [770e625] - 2026-07-01

feat: Phase 16 Stage 2b - translate auth pages (login, signup, reset)

- Moved login, signup, reset-password under [locale]; dropped the
  now-orphaned (auth) route group
- middleware.ts: these three routes moved from the unlocalized
  allowlist into the locale-managed branch's public paths
- Translated all ~30 login-page strings + reset-password across all
  10 languages (new auth.{brand,login,resetPassword} namespace)
- Fixed password-reset email link to use the current locale prefix
  instead of a hardcoded unlocalized path
- signup (sign-out + redirect shim) now uses locale-aware redirect()
- Verified via curl: /login redirects correctly, /es/login renders
  Spanish, /en/reset-password renders English, /es/signup redirects
  preserving locale, no runtime errors

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [950446a] - 2026-07-01

feat: Phase 16 Stage 2a - translate shared layout (header, sidebar)

- header.tsx + sidebar.tsx fully translated across all 10 locales
  (page titles, search UI, account menu, nav labels, roles, sign-out)
- Both switched to locale-aware Link/useRouter/usePathname from
  src/i18n/navigation.ts for org-scoped paths (fixes the extra
  redirect hop noted in Stage 1); /login stays on plain next/navigation
  router since it's not yet migrated under [locale]
- Verified: JSON validity all 10 files, clean typecheck, live lang/dir
  switching per locale (ar -> rtl) confirmed via curl

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [5da6448] - 2026-07-01

feat: Phase 16 Stage 1 - i18n scaffolding (next-intl, locale routing)

- Add next-intl, src/i18n/{routing,navigation,request}.ts
- Move src/app/[slug] -> src/app/[locale]/[slug], guest-portal likewise
- Middleware composes locale routing with existing Supabase auth
  refresh; legacy (dashboard) group and not-yet-migrated static routes
  (login, demo, signup, invite, onboarding, reset-password, auth) stay
  unprefixed until Stage 2 migrates them
- Root layout wraps children in NextIntlClientProvider, sets lang/dir
  (RTL-ready for Arabic)
- Empty messages/{en,zh,hi,es,fr,ar,bn,pt,ru,ja}.json skeletons created
- Fixed /login self-redirect loop and legacy-route misrouting bugs
  found during smoke testing
- Resolved the (dashboard) vs [slug] "duplicate" ambiguity flagged in
  Phase 15 (confirmed legacy redirect shim, not real duplicate code)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [979065b] - 2026-07-01

chore: clean up duplicate CHANGELOG entry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [20b4b9d] - 2026-07-01

feat: Phase 15 - Navbar functionality (search, new booking, account menu)

- Header search: live debounced dropdown across guests + reservations,
  click-through navigates to filtered Reservations list
- Reservations list reads initial ?q= from URL and re-syncs on
  same-route navigations from header search (useSearchParams gotcha)
- New Booking button navigates to Tape Calendar with explanatory tooltip
- User account menu (Radix DropdownMenu): email/org, Settings, Sign Out
- Clear (X) button on both header and reservations-page search boxes
- Property Settings: City + Country converted to searchable, cascading
  dropdowns via new country-state-city dependency
- Document Phase 16 (multi-language/i18n) design, not started

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [3e19c00] - 2026-07-01

chore: clean up duplicate CHANGELOG entry

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## [873dc4d] - 2026-07-01

feat: Phase 14 - Check-In Registry (Guest Book)

- New Guest Book page (/[slug]/checkin-history) with table, search, CSV export
- Add to Guest Book from reservation drawer; 409 duplicate guard
- Edit dialog per row: Personal Info, Identity Document, Stay Details sections
- Searchable country dropdowns (Citizenship + Country of Birth) via portal
- Delete record with confirmation; stale inBook state fixed
- Reservation # column in Guest Book table
- Plan-based limits: Free 500 / Pro 5,000 / Scale unlimited
- Limit enforced server-side in POST /api/reservations/[id]/registry
- Usage shown in UI with amber/red indicators + at-limit banner
- Existing guest search in New Reservation drawer (debounced, tab switcher)
- Yup conditional validation: fields only required when creating new guest
- router.refresh() replaces window.location.reload() (drawer stays open)
- Tape chart: removed mergedBlocksByBed (was merging different reservations)
- RLS: DELETE + UPDATE policies on checkin_registry
- COUNTRIES unified to @/lib/countries (removed inline duplicates)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## [8f2bd48] - 2026-06-30

feat: Phase 13 - Subscription plans + Stripe billing

- Add plan system: free/pro/scale with limits (beds, users, features)
- Stripe Checkout for new subscriptions, subscriptions.update for upgrades/downgrades
- Stripe Customer Portal for cancellation and payment method management
- Webhook handler: checkout.completed, invoice.paid, subscription.updated/deleted
- pending_plan enforcement: post-onboarding app blocked until payment confirmed
- Auto-trigger Stripe Checkout when user selects paid plan from landing page
- Paywall component for feature-gating analytics, channels, etc.
- Plan limits enforced in beds/create and team/invite APIs
- Billing page with usage bars, plan cards, upgrade/downgrade/portal buttons
- Migration: plan, stripe_customer_id, stripe_subscription_id, plan_expires_at, pending_plan on organizations

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## [4688927] - 2026-06-27

feat(email): implement Resend email service + reservation bug fixes

Replace console.log stubs with real Resend HTTP email delivery.
Emails needed for guest flow to actually reach guests on booking,
cancellation, checkout, and check-in events.

- HTML templates for all 5 transactional email types
- POST /api/email/send for direct dispatch
- Email field required on reservation creation (validation + form)
- Trigger emails on create/cancel/checkout/guest portal submit

Bug fixes:
- Guest portal returned 404 due to missing guest_id in select,
  wrong storage bucket (guest-check-ins -> guest-documents),
  and non-existent emergency_contact column on guests table
- Mobile overlay rendered when sidebar CLOSED (inverted condition)
- Guest dialog z-index below reservation drawer (z-50 -> z-[10002])
- Extract Data button missing from existing document list items
- OCR prompt returned ISO codes (SRB) instead of full names (Serbian)

Reservation drawer additions:
- View Guest Profile button opens GuestDialog inline
- Change Guest search: reassign reservation to existing guest
- PATCH /api/reservations/:id now accepts guest_id

## [b0c0f9f] - 2026-06-22

feat: Phase 9 - Guest Self-Service Portal + Bulk Actions complete

HIGH-IMPACT FEATURES:
- Multi-step check-in form (4 steps with progress indicator)
- Real-time form validation with error messages
- Photo preview, change, remove (file upload only)
- Rejection clarity: custom rejection reasons shown to guest
- Bulk approve/reject: Staff can process multiple check-ins at once

GUEST PORTAL IMPROVEMENTS:
- Step 1: Your Details - form fields with live validation
- Step 2: ID Photos - file upload with preview
- Step 3: Review - verify all information
- Step 4: Complete - final submission
- Rejection flow: Guest sees rejection reason and can resubmit
- Searchable country dropdown (195 countries)
- Document type examples (Passport, ID, Driver's License)

STAFF DASHBOARD ENHANCEMENTS:
- Checkbox selection on pending check-ins
- Bulk action bar: Select All, Approve All, Reject All buttons
- Bulk rejection modal with reason selection and custom text
- Rejected check-ins filtered from pending list
- Toast notifications for bulk operations

API UPDATES:
- Guest portal endpoint returns rejection_reason
- Pending check-ins API filters out rejected items
- Verify endpoint: rejection doesn't set check_in_verified_at

VALIDATION:
- First/Last name: 2+ characters
- Email: Valid format
- Phone: 10+ digits
- Document number: 3+ characters
- Country: Required selection
- Photos: JPG/PNG/WebP, max 5MB

FIXES:
- Separate file input refs for front/back photos (no cross-upload)
- Rejection message shows in red alert box
- Check-in status submitted preserves after rejection
- Bulk operations batch API calls
- Debug logging for API responses

DATABASE:
- self_check_in_data stores rejection_reason + rejected_at
- No check_in_verified_at set on rejection (keeps status "submitted")
- Graceful null handling for legacy data

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>

## [Unreleased] - 2026-06-27

### Email Service (Resend)
- Replace console.log stubs with real Resend email delivery
- HTML email templates: booking confirmation, cancellation, checkout receipt, check-in submitted, check-in verified
- `POST /api/email/send` endpoint for direct email dispatch
- Email triggered on: reservation create, cancel, checkout, guest portal submission
- `EMAIL_FROM` env var for sender address (defaults to onboarding@resend.dev)
- Email field added to reservation creation form and validation

### Bug Fixes
- Guest portal "Link Invalid": fixed missing guest_id in select, wrong storage bucket, removed non-existent emergency_contact column
- Mobile overlay shows when sidebar CLOSED (inverted condition fix)
- Guest dialog z-index raised to z-[10002] to appear above reservation drawer
- Extract Data button added to existing uploaded documents list
- OCR prompt returns full nationality/country names not ISO codes

### Reservation Drawer
- "View Guest Profile" opens guest edit dialog inline
- "Change Guest" inline search: reassign reservation to any existing guest
- PATCH /api/reservations/:id accepts guest_id updates

## [b0c0f9f] - 2026-06-22

feat: Phase 9 - Guest Self-Service Portal + Bulk Actions complete

HIGH-IMPACT FEATURES:
- Multi-step check-in form (4 steps with progress indicator)
- Real-time form validation with error messages
- Photo preview, change, remove (file upload only)
- Rejection clarity: custom rejection reasons shown to guest
- Bulk approve/reject: Staff can process multiple check-ins at once

GUEST PORTAL IMPROVEMENTS:
- Step 1: Your Details - form fields with live validation
- Step 2: ID Photos - file upload with preview
- Step 3: Review - verify all information
- Step 4: Complete - final submission
- Rejection flow: Guest sees rejection reason and can resubmit
- Searchable country dropdown (195 countries)
- Document type examples (Passport, ID, Driver's License)

STAFF DASHBOARD ENHANCEMENTS:
- Checkbox selection on pending check-ins
- Bulk action bar: Select All, Approve All, Reject All buttons
- Bulk rejection modal with reason selection and custom text
- Rejected check-ins filtered from pending list
- Toast notifications for bulk operations

API UPDATES:
- Guest portal endpoint returns rejection_reason
- Pending check-ins API filters out rejected items
- Verify endpoint: rejection doesn't set check_in_verified_at

VALIDATION:
- First/Last name: 2+ characters
- Email: Valid format
- Phone: 10+ digits
- Document number: 3+ characters
- Country: Required selection
- Photos: JPG/PNG/WebP, max 5MB

FIXES:
- Separate file input refs for front/back photos (no cross-upload)
- Rejection message shows in red alert box
- Check-in status submitted preserves after rejection
- Bulk operations batch API calls
- Debug logging for API responses

DATABASE:
- self_check_in_data stores rejection_reason + rejected_at
- No check_in_verified_at set on rejection (keeps status "submitted")
- Graceful null handling for legacy data

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>

## [827af05] - 2026-06-21

feat: Phase 8 - Dashboard metrics and Analytics page

Dashboard improvements:
- Add 4 metric cards: Occupancy Rate, Arrivals Today, Monthly Revenue, Avg Booking Nights
- Occupancy trending with ↑↓ indicators comparing to previous day
- Daily revenue detail line on Monthly Revenue card
- Check In button with instant status update

Metrics enhancements:
- Calculate average booking nights from reservations
- Compare occupancy day-over-day for trend analysis
- Comprehensive error handling with graceful fallbacks
- Support empty data scenarios (no beds, no reservations)

Analytics page:
- New /analytics route with 30-day trends
- Booking trends line chart (bookings per day)
- Revenue trends bar chart (revenue per day)
- Occupancy timeline area chart (occupancy % over time)
- Top rooms by revenue ranked list
- Recharts integration for data visualization
- Error handling for missing data

Navigation:
- Add Analytics link to sidebar
- Update header title mapping for /analytics route

## [827af05] - 2026-06-20

feat: Phase 8 - Dashboard metrics and Analytics page

Dashboard improvements:
- Add 4 metric cards: Occupancy Rate, Arrivals Today, Monthly Revenue, Avg Booking Nights
- Occupancy trending with ↑↓ indicators comparing to previous day
- Daily revenue detail line on Monthly Revenue card
- Check In button with instant status update

Metrics enhancements:
- Calculate average booking nights from reservations
- Compare occupancy day-over-day for trend analysis
- Comprehensive error handling with graceful fallbacks
- Support empty data scenarios (no beds, no reservations)

Analytics page:
- New /analytics route with 30-day trends
- Booking trends line chart (bookings per day)
- Revenue trends bar chart (revenue per day)
- Occupancy timeline area chart (occupancy % over time)
- Top rooms by revenue ranked list
- Recharts integration for data visualization
- Error handling for missing data

Navigation:
- Add Analytics link to sidebar
- Update header title mapping for /analytics route

## [827af05] - 2026-06-20

feat: Phase 8 - Dashboard metrics and Analytics page

Dashboard improvements:
- Add 4 metric cards: Occupancy Rate, Arrivals Today, Monthly Revenue, Avg Booking Nights
- Occupancy trending with ↑↓ indicators comparing to previous day
- Daily revenue detail line on Monthly Revenue card
- Check In button with instant status update

Metrics enhancements:
- Calculate average booking nights from reservations
- Compare occupancy day-over-day for trend analysis
- Comprehensive error handling with graceful fallbacks
- Support empty data scenarios (no beds, no reservations)

Analytics page:
- New /analytics route with 30-day trends
- Booking trends line chart (bookings per day)
- Revenue trends bar chart (revenue per day)
- Occupancy timeline area chart (occupancy % over time)
- Top rooms by revenue ranked list
- Recharts integration for data visualization
- Error handling for missing data

Navigation:
- Add Analytics link to sidebar
- Update header title mapping for /analytics route

## Phase 9 - Guest Self-Service Portal

feat: Guest Self-Service Check-In Portal

Guest portal functionality:
- Multi-channel access: email link, shareable link, QR code
- Public token-based check-in form (no auth required)
- Two-stage verification: guest submit → staff verify
- Pre-filled form with guest data from reservation
- ID photo upload (front required, back optional)
- Image compression and secure storage in Supabase

Staff verification dashboard:
- Pending Check-Ins page showing all unverified submissions
- Review guest data and ID photos in modal
- Approve or reject with reason
- Automatic guest notifications on verification

Database schema:
- Add check_in_token (UUID) for guest access
- Add self_check_in_submitted_at, self_check_in_data, id_photos fields
- Add check_in_verified_at, check_in_verified_by for audit trail
- Add indexes for performance

API endpoints:
- GET /api/guest-portal/[token] - Fetch reservation details
- POST /api/guest-portal/[token]/submit-check-in - Guest form submission
- GET /api/staff/check-in-pending - List pending verifications
- PATCH /api/staff/reservations/[id]/verify-check-in - Staff verification

Frontend:
- /guest-portal/[token] - Check-in form page
- /check-in-pending - Staff verification dashboard
- Add "Pending Check-Ins" to sidebar navigation
- Support guest data pre-fill and updates

Security:
- Token expiry (24h past check-in date)
- File size validation (5MB limit)
- Image format validation (JPG/PNG/WebP)
- Organization isolation via RLS policies

## [827af05] - 2026-06-09

feat: Phase 8 - Dashboard metrics and Analytics page

Dashboard improvements:
- Add 4 metric cards: Occupancy Rate, Arrivals Today, Monthly Revenue, Avg Booking Nights
- Occupancy trending with ↑↓ indicators comparing to previous day
- Daily revenue detail line on Monthly Revenue card
- Check In button with instant status update

Metrics enhancements:
- Calculate average booking nights from reservations
- Compare occupancy day-over-day for trend analysis
- Comprehensive error handling with graceful fallbacks
- Support empty data scenarios (no beds, no reservations)

Analytics page:
- New /analytics route with 30-day trends
- Booking trends line chart (bookings per day)
- Revenue trends bar chart (revenue per day)
- Occupancy timeline area chart (occupancy % over time)
- Top rooms by revenue ranked list
- Recharts integration for data visualization
- Error handling for missing data

Navigation:
- Add Analytics link to sidebar
- Update header title mapping for /analytics route

## [b485315] - 2026-06-09

feat: drawer sidebar, table improvements, and sticky first column

- Convert sidebar to collapsible drawer on all screen sizes
- Add hamburger menu button in header to toggle sidebar
- Main content shifts right when sidebar opens (ml-72 margin)
- Add sticky Reservation # column for horizontal scroll
- Add gradient fade indicator on right edge of table
- Increase table minWidth to 1400px for better spacing

## [5f7fcab] - 2026-06-09

feat: add column sorting to all list pages (guests, rooms, beds, room types)

## [6f6910d] - 2026-06-09

feat: quick status change - inline dropdown and action buttons (checkout/cancel)

## [34d9401] - 2026-06-08

Phase 7: Complete - search, filtering, and professional UX

**Phase 7 Features:**
- Multi-field search (res #, guest name, room, bed)
- Filters: status, check-in date range
- Debounced search (300ms)
- Table min-width with horizontal scroll

**UX Enhancements:**

1. Loading Skeleton:
   - Reusable component applied to all lists
   - Smooth placeholder rows instead of text

2. Empty States:
   - Context-aware messaging (search vs. no data)
   - Quick action buttons
   - Icons for visual clarity
   - Applied to all 5 list pages

3. Column Sorting:
   - Click headers to sort
   - Sort indicator always visible (muted/bold)
   - Ascending/descending toggle
   - Supports string and numeric columns

All criteria met. Professional, polished UX.

## [3ee9d71] - 2026-06-07

Phase 7: Fix search - support name and room/bed queries

- Search now queries across: reservation #, guest name, room name, bed name
- Remove default cancelled/no_show filter - show all reservations
- Updated placeholder text to reflect search capabilities

## [d20c0b7] - 2026-06-07

feat: install superpowers-zh + caveman + antigravity skill frameworks

- superpowers-zh: 20 skills in .claude/skills/ (TDD, debugging, planning, agents)
- antigravity-awesome-skills: 2903 global skills in ~/.claude/skills/
- caveman hooks wired in ~/.claude/settings.json (token compression mode)
- superpowers + caveman slash commands in ~/.claude/commands/
- CLAUDE.md updated with skills reference

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## [06717be] - 2026-06-07

Phase 6: Complete reservation management - all features tested and working

**Fully Implemented & Tested:**
✅ Edit reservation dates with real-time calendar updates
✅ Checkout flow with payment tracking & guest info review
✅ Cancel reservation with reason capture & audit trail
✅ Automatic calendar refresh when status changes
✅ Cancelled/no_show reservations hidden from calendar
✅ Price recalculation on date changes
✅ Conflict detection for overlapping dates

**Key Changes:**
- Client-side filtering in tape-chart excludes cancelled/no_show status
- Force page reload on updates to clear all caches
- Comprehensive error handling and validation
- Full reservation lifecycle: create → edit → checkout/cancel

## [6db984a] - 2026-06-06

Phase 5: Implement OCR document extraction and calendar improvements

**OCR Integration:**
- Add Claude Vision API integration for passport/ID scanning (/api/guests/extract-ocr)
- Extract 10 guest fields with confidence scoring (0-1 scale)
- Support front-side extraction with base64 preview for new guests
- Support back-side ID extraction and field merging
- Color-coded confidence indicators (green ≥90%, yellow 70-90%, red <70%)
- Dialog with percentage tracker showing fields completed
- Loading spinner during extraction

**Form Integration:**
- Auto-fill form fields using React Hook Form setValue
- Only set non-null, non-empty extracted values
- Pre-fill confirmation toast feedback

**Calendar Enhancements:**
- Merge overlapping/consecutive reservation blocks into continuous spans
- Days header scrolls horizontally with content, sticky to top vertically
- Room section headers sticky on left side (don't scroll horizontally)
- Property/Unit header with full opacity
- Display total reservation price per block (price_per_night × duration)
- Improved scroll UX for better date tracking

**Key Features:**
✅ New guest workflow: Upload ID → Extract → Auto-fill → Create
✅ Existing guest workflow: Upload documents with OCR
✅ Back-side support: Extract missing fields from ID back side
✅ Confidence scoring and field merging strategies
✅ Calendar visual improvements with pricing and multi-day blocks

All Phase 5 objectives completed and tested.

## [44cebdf] - 2026-06-05

Update Phase 4 status: Add document upload enhancement

## [44cebdf] - 2026-05-31

Update Phase 4 status: Add document upload enhancement

## [445bcb2] - 2026-05-31

Add document upload to new guest form

- Documents can now be uploaded immediately after guest creation
- Form hides input fields after creation and shows upload section
- Users see success message and can optionally upload documents
- Post-upload UI flows smoothly back to guest list
- Maintains all existing document upload functionality

## [901eb4e] - 2026-05-31

Phase 4: Update status documentation - 100% complete

## [ee100a6] - 2026-05-31

Phase 4: Implement duplicate guest merge UI with field-by-field selection

- New component: duplicate-merge-dialog.tsx for side-by-side guest comparison
- New API route: POST /api/guests/merge for merging guest records
- Enhanced guest-dialog.tsx to show merge dialog on duplicate detection
- Users can now select which guest fields to keep or combine
- Document arrays are automatically merged, notes are combined with timestamp
- Fully functional merge workflow with preview before confirming

## [abe5504] - 2026-05-31

Phase 3: Complete guest management with deduplication and document upload

Features:
- Guest deduplication prevents duplicate entries by document hash
- 409 conflict response when duplicate detected with existing guest details
- All 9 Serbia-required fields in form (place_of_birth, country_of_birth, etc.)
- Document upload to Supabase Storage with persistence
- Document metadata stored as jsonb array
- Document download with public bucket access

Fixes:
- Use createServiceClient for write operations (API routes now bypass RLS)
- Document persistence: documents now reload when guest is re-opened
- Bucket made public for document downloads
- Fixed document-upload component to display existing documents

Testing:
- ✅ Deduplication warning appears for duplicate guests
- ✅ Documents upload and persist across sessions
- ✅ All Serbia fields save and load correctly
- ✅ Document downloads work via public URLs

Related files modified:
- src/app/api/guests/create/route.ts
- src/app/api/guests/[id]/route.ts
- src/app/api/guests/upload-document/route.ts
- src/components/guests/guest-dialog.tsx
- src/components/guests/document-upload.tsx

## [4cc7c4e] - 2026-05-31

Add auto-documentation update hook on commits

- Configure PostToolUse hook to analyze git commits
- Update CHANGELOG.md with commit details automatically
- Identify when architecture, design, or phase docs are affected
- Script analyzes file changes and flags relevant documentation
- Hook runs silently after each commit (non-blocking)

This ensures documentation stays synchronized with code changes
without requiring manual updates for every commit.

## [ec6ca50] - 2026-05-31

### Auto-Documentation Update Hook

Implement automated documentation synchronization on every commit.

**Features:**
- PostToolUse hook analyzes git commits after they complete
- Automatically updates CHANGELOG.md with commit details
- Maps file changes to relevant documentation areas (architecture, design, phases)
- Script detects changes in src/, supabase/, and configuration files
- Non-blocking execution — hook failures don't affect commits

**Files:**
- `.claude/settings.json` - Hook configuration
- `.claude/update-docs.sh` - Documentation analysis script
- `docs/guides/DEVELOPMENT.md` - Development workflow guide

**Impact:**
Documentation stays synchronized with code in every commit, creating an atomic record of what changed and why. Developers don't need to manually update CHANGELOG or flag affected documentation areas.

**Usage:**
Simply commit as normal — the hook runs automatically and updates relevant docs before completing the commit.

# Changelog

All notable changes to this project are documented in this file.

## 2026-05-25 - Tailwind stability fix

### Summary
- Stabilized styling pipeline after Tailwind version/config mismatch caused styles not to apply.
- Standardized dashboard UI to semantic color tokens for maintainable theming.
- Fixed TypeScript issues uncovered during build validation.

### Tailwind and build pipeline
- Migrated to Tailwind CSS 3.4.17 for conservative stability.
- Replaced Tailwind v4 PostCSS plugin usage with Tailwind v3 PostCSS setup.
- Updated global stylesheet directives to Tailwind v3 syntax.

### UI consistency updates
- Migrated layout shell and key dashboard screens to semantic tokens:
  - background, surface, foreground, muted-foreground, border, primary, ring.
- Updated dialogs and reservation drawers to use the same token system.

### Build and type fixes
- Updated dynamic API route handler context typing for current Next.js route expectations.
- Fixed multiple strict TypeScript errors in API handlers, forms, and middleware/server helpers.
- Confirmed successful production build with type checks.

### Verification
- npm run build completed successfully after changes.

### Notes for future upgrades
- If upgrading Tailwind again, verify PostCSS plugin config and global CSS directives together.
- Keep semantic token usage in components to avoid hardcoded color drift.
