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
