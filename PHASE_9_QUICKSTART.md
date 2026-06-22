# Phase 9 Quick Start Guide

## What's New

Guest Self-Service Portal: Guests check in online, staff verify ID. Two-stage process.

**For Guests:**
- Access via email link, shareable link, or QR code
- Fill form with info
- Upload ID photos (front required, back optional)
- Get confirmation email when staff approves

**For Staff:**
- Pending Check-Ins dashboard
- Review guest data and ID photos
- Approve or reject (with reason)
- Share link/QR code with guests

## Quick Setup (5 mins)

1. **Apply database migration**
   - Open Supabase Dashboard → SQL Editor
   - Run SQL from `supabase/migrations/add_guest_portal_fields.sql`
   - See `PHASE_9_MIGRATION.md` for details

2. **Start dev server**
   ```bash
   npm run dev
   ```

3. **Create test data**
   - Create guest (first name, last name, email, nationality, document)
   - Create reservation (check-in tomorrow, check-out in 3 days)

4. **Test guest portal**
   - Get `check_in_token` from reservation in Supabase
   - Visit: `http://localhost:3000/guest-portal/{token}`
   - Fill form and upload ID photos
   - See success screen

5. **Test staff verification**
   - Go to `/check-in-pending` (log in as staff)
   - Click "Review" on pending check-in
   - See guest data, ID photos, QR code
   - Approve or reject

## File Structure

**New files created:**
```
src/
  app/
    guest-portal/
      layout.tsx              - Portal layout (no auth needed)
      [token]/
        page.tsx              - Check-in form page
    api/
      guest-portal/
        [token]/
          route.ts            - Fetch reservation
          submit-check-in/
            route.ts          - Guest form submission
      staff/
        check-in-pending/
          route.ts            - List pending verifications
        reservations/[id]/
          verify-check-in/
            route.ts          - Staff verification
    (dashboard)/
      check-in-pending/
        page.tsx              - Staff dashboard
  components/
    guest-portal/
      check-in-form.tsx       - Guest form component
      check-in-success.tsx    - Success screen
    dashboard/
      pending-check-ins-client.tsx - Staff verification modal
  lib/
    email.ts                  - Email notifications
    qr-code.ts                - QR code generation

supabase/
  migrations/
    add_guest_portal_fields.sql - Database schema

PHASE_9_TESTING.md            - Complete test checklist
PHASE_9_MIGRATION.md          - Detailed migration guide
PHASE_9_QUICKSTART.md         - This file
```

## Key Features

### Guest Portal
- **Multi-channel access:** Email link, shareable link, QR code
- **Pre-filled form:** Guest data populated from reservation
- **ID photo upload:** Front (required), back (optional)
- **Validation:** File size (5MB), format (JPG/PNG/WebP)
- **Success confirmation:** Tells guest staff will verify in 24h

### Staff Verification
- **Pending list:** All unverified submissions
- **Review modal:** View guest data and ID photos
- **Link sharing:** Copy link or show QR code
- **Approve/Reject:** With reason dropdown for rejections
- **Email notifications:** Auto-send to guest on action

### Security
- **Token expiry:** 24h past check-in date
- **Organization isolation:** RLS policies prevent cross-org access
- **File validation:** Size and format checks
- **Audit trail:** Track who verified and when

## Testing

**Full test checklist:** See `PHASE_9_TESTING.md`

**Quick smoke test (2 mins):**
1. Create test reservation
2. Get check_in_token from DB
3. Visit guest portal → form loads ✓
4. Fill and submit → success screen ✓
5. Go to /check-in-pending → pending shows ✓
6. Click Review → modal opens ✓
7. Approve → removed from list ✓

## Email Notifications

Currently logged to console. To integrate real email:

Edit `src/lib/email.ts`:
- Implement Resend.com, SendGrid, or custom SMTP
- Uncomment email sending code in API endpoints
- Add environment variables

## Database Changes

**6 new columns on reservations table:**
- `check_in_token` (UUID) - Guest access token
- `self_check_in_submitted_at` (timestamp) - When guest submitted
- `self_check_in_data` (JSON) - Guest form data
- `id_photos` (JSON) - Photo URLs and metadata
- `check_in_verified_at` (timestamp) - When staff verified
- `check_in_verified_by` (UUID) - Staff user ID

**2 new indexes:**
- On check_in_token (fast token lookup)
- On organization_id + self_check_in_submitted_at (pending list query)

## Next Steps (Phase 10)

- Real email service integration
- Guest resubmit on rejection (auto-clear token)
- SMS notifications
- Mobile app check-in camera
- Verification reject reasons library
- Staff approval workflow (manager sign-off)

## Troubleshooting

**Page says "Invalid or expired link"**
- Check token is correct (copy from DB, not manually typed)
- Check check-in date hasn't passed + 24h
- Check token hasn't been verified already

**ID photos not uploading**
- Check file size < 5MB
- Check format is JPG/PNG/WebP
- Check Supabase Storage bucket `guest-check-ins` exists

**Pending list shows nothing**
- Check reservation has `self_check_in_submitted_at` set (guest must have submitted)
- Check `check_in_verified_at` is NULL (not yet verified)
- Check guest is in your organization

**TypeScript errors**
- Run `npm run build` to see actual errors
- Should be gone after migration applied
- If persist, check Supabase schema is updated

## Support

- Test checklist: `PHASE_9_TESTING.md`
- Migration guide: `PHASE_9_MIGRATION.md`
- Code comments in API routes
- Console logs for debugging
