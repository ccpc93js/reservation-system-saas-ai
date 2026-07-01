## [Unreleased] - 2026-07-02

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
