# Phase 9 Testing Checklist

## Prerequisites
- [ ] Apply database migration: `supabase/migrations/add_guest_portal_fields.sql`
  - Run in Supabase Dashboard → SQL Editor
  - Verify 6 new columns added to reservations table
  - Verify 2 indexes created

- [ ] Create test guest + reservation
  - Guest: First/Last name, Email, Phone, Nationality, Document info
  - Reservation: Check-in tomorrow, Check-out in 3 days
  - Verify `check_in_token` generated (UUID)

## Guest Portal Flow

### Test 1: Fetch Reservation (GET /api/guest-portal/[token])
- [ ] Copy reservation's `check_in_token` from DB
- [ ] Visit: `http://localhost:3000/guest-portal/{token}`
- [ ] Verify page loads with:
  - Reservation summary (dates, room, amount)
  - Guest name in header
  - Form fields pre-filled with existing guest data
- [ ] Check token expiry validation:
  - [ ] Valid token (within 24h of check-in) → loads
  - [ ] Expired token (past check-in date + 24h) → error "Check-in window has closed"
  - [ ] Invalid token → error "Invalid or expired link"

### Test 2: Form Validation
- [ ] Required fields:
  - [ ] First Name - cannot submit empty
  - [ ] Last Name - cannot submit empty
  - [ ] Email - cannot submit empty
  - [ ] Document Type - must select
  - [ ] Document Number - cannot submit empty
  - [ ] Front ID photo - must upload
- [ ] Front ID photo constraints:
  - [ ] JPG/PNG/WebP only (reject BMP/GIF)
  - [ ] Max 5MB (reject larger)
  - [ ] Shows preview after upload
- [ ] Back ID photo:
  - [ ] Optional (can submit without)
  - [ ] Same constraints as front (if provided)
- [ ] Edit pre-filled data:
  - [ ] Change first name → shows in form
  - [ ] Change email → shows in form
  - [ ] Change document number → shows in form

### Test 3: Form Submission (POST /api/guest-portal/[token]/submit-check-in)
- [ ] Submit form with all valid data
- [ ] Verify success screen displays:
  - [ ] ✓ Check-In Submitted! message
  - [ ] Reservation number visible
  - [ ] Check-in date visible
  - [ ] "Staff will verify within 24 hours"
- [ ] Verify database updated:
  - [ ] `self_check_in_submitted_at` = current timestamp
  - [ ] `self_check_in_data` contains form data (JSON)
  - [ ] `id_photos` contains front/back photo URLs
- [ ] Verify Supabase Storage:
  - [ ] Files uploaded to `guest-check-ins/{org_id}/{res_id}/`
  - [ ] Files are accessible via public URLs
- [ ] Verify guest data updated:
  - [ ] Guest email updated (if changed)
  - [ ] Guest phone updated (if changed)
  - [ ] Guest document info updated
- [ ] Check email log:
  - [ ] "Check-in submitted" email logged
  - [ ] Includes guest name, reservation #, check-in date

## Staff Verification Flow

### Test 4: Pending Check-Ins List (GET /api/staff/check-in-pending)
- [ ] Navigate to `/check-in-pending` (authenticated)
- [ ] Verify sidebar shows:
  - [ ] "Pending Check-Ins" link (with ClipboardList icon)
  - [ ] Link is active/highlighted when on page
- [ ] Verify header shows:
  - [ ] Title: "Pending Check-Ins"
  - [ ] Count: "X guests waiting for verification"
  - [ ] Refresh button
- [ ] Verify pending list shows:
  - [ ] Guest name
  - [ ] Reservation number (blue monospace badge)
  - [ ] Check-in date
  - [ ] Room name
  - [ ] Email
  - [ ] Submitted time
  - [ ] "Review" button

### Test 5: Guest Portal Link Sharing
- [ ] Click "Review" button
- [ ] Verification modal opens
- [ ] Scroll to "Guest Portal Link" section
- [ ] Verify link shows:
  - [ ] Full URL to `/guest-portal/{token}`
  - [ ] Correct token from reservation
- [ ] Copy button:
  - [ ] Click copy → toast "Link copied!"
  - [ ] Paste link → correct URL in clipboard
- [ ] QR Code button:
  - [ ] Click "Show QR Code"
  - [ ] QR code image displays (300x300px)
  - [ ] QR code points to correct guest portal link
  - [ ] Click "Hide QR Code" → image hidden

### Test 6: Verification Modal - Data Display
- [ ] Modal shows guest information section:
  - [ ] All submitted form fields visible (read-only)
  - [ ] Values match what guest entered
- [ ] Modal shows ID photos:
  - [ ] Front photo displays
  - [ ] Back photo displays (if submitted)
  - [ ] Photos are clickable (open in new tab)
  - [ ] Photos are large enough to verify details

### Test 7: Approve Check-In (PATCH /api/staff/reservations/[id]/verify-check-in)
- [ ] In modal, select "✓ Approve Check-In" radio
- [ ] Click "Approve" button
- [ ] Verify:
  - [ ] Button shows loading spinner
  - [ ] Toast "Check-in approved! Guest will be notified."
  - [ ] Modal closes
  - [ ] Reservation removed from pending list
- [ ] Verify database updated:
  - [ ] `check_in_verified_at` = current timestamp
  - [ ] `check_in_verified_by` = staff user ID
- [ ] Check email log:
  - [ ] "Check-in approved" email logged
  - [ ] Includes welcome message
  - [ ] Shows reservation number and check-in date

### Test 8: Reject Check-In
- [ ] Click "Review" on another pending check-in
- [ ] Select "✗ Reject Check-In" radio
- [ ] Verify rejection reason dropdown appears:
  - [ ] Options: "ID illegible", "Expired document", "Doesn't match guest", "Name mismatch", "Other"
- [ ] Select reason (e.g., "ID illegible")
- [ ] Click "Reject" button
- [ ] Verify:
  - [ ] Button shows loading spinner
  - [ ] Toast "Check-in rejected. Guest will be asked to resubmit."
  - [ ] Modal closes
  - [ ] Reservation removed from pending list
- [ ] Verify database:
  - [ ] `self_check_in_data.rejection_reason` = selected reason
  - [ ] `self_check_in_data.rejected_at` = current timestamp
  - [ ] `check_in_verified_at` NOT set (not approved)
- [ ] Check email log:
  - [ ] "Check-in rejection" email logged
  - [ ] Includes rejection reason
  - [ ] Asks to resubmit

### Test 9: Empty State
- [ ] After approving all pending check-ins
- [ ] Navigate to `/check-in-pending`
- [ ] Verify empty state displays:
  - [ ] ✓ checkmark icon
  - [ ] "All caught up!"
  - [ ] "No pending check-ins to review"

## Edge Cases

### Test 10: Token Expiry
- [ ] Create reservation with check-in date = TODAY
- [ ] Tomorrow (check-in date + 1), try guest portal:
  - [ ] Token expired → error "Check-in window has closed"

### Test 11: Already Verified
- [ ] Approve a check-in
- [ ] Get `check_in_token` for that reservation
- [ ] Try to access guest portal with that token:
  - [ ] Should prevent re-submission (not implemented yet, mark as TODO)

### Test 12: Large Image Upload
- [ ] Upload image > 5MB:
  - [ ] Client-side error: "File size must be under 5MB"
- [ ] Upload non-image file (PDF):
  - [ ] Client-side error: "Only JPG, PNG, or WebP files allowed"

### Test 13: Multiple Photos
- [ ] Upload front photo → preview shows
- [ ] Upload back photo → preview shows
- [ ] Delete back photo → preview hides
- [ ] Re-upload back photo → preview shows again

## Performance

### Test 14: Load Times
- [ ] Guest portal loads within 2s
- [ ] Pending list loads within 2s
- [ ] Modal with images loads smoothly
- [ ] No console errors

### Test 15: Concurrent Submissions
- [ ] Two guests check-in simultaneously (if possible):
  - [ ] Both succeed
  - [ ] Both appear in pending list
  - [ ] No race conditions or data loss

## Security

### Test 16: Authorization
- [ ] Guest portal works WITHOUT auth:
  - [ ] Can access /guest-portal/[token] without login
  - [ ] Cannot access /check-in-pending without login
- [ ] Staff cannot access other organization's check-ins:
  - [ ] RLS policies prevent cross-org access

### Test 17: Token Validation
- [ ] Fake/invalid tokens rejected
- [ ] Token reuse on different guest doesn't work
- [ ] Token doesn't expose organization data

## Notes
- Email notifications currently logged to console (integrate real email service later)
- QR code uses free QR Server API (no rate limits for testing)
- All timestamps in UTC

## Test Results
- [ ] All tests passed
- [ ] No console errors
- [ ] No TypeScript errors after migration
- [ ] Ready to commit

Date tested: _______________
Tester: _______________
