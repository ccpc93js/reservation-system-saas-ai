# Phase 3 Completion Plan

## Current State
- ✅ Guest forms 90% complete
- ⚠️ Deduplication is BROKEN (silently creates duplicates)
- ❌ OCR not implemented
- ⚠️ Serbia fields partially in UI

## Phase 3 Success Criteria
1. Guest deduplication prevents duplicates (with warnings/merge option)
2. Serbia-specific fields fully implemented (9/9 fields in UI)
3. Document upload handled (with optional OCR later)
4. Guest search finds deduped records efficiently

---

## EXECUTION PLAN

### STAGE 1: Fix Critical Bug (1-2 hours) — **START HERE**

**Task 1.1: Fix Guest Deduplication Logic**
- **File**: `/src/app/api/guests/create/route.ts`
- **What**: Add dedup check before INSERT
- **Change**: 
  ```typescript
  // Before: const result = await supabase.from("guests").insert(...)
  // After: First query for existing guest by (org_id, document_hash)
  // If exists: Return existing guest ID with 409 status + message
  // If new: Proceed with insert
  ```
- **Impact**: Prevents duplicates, enables merge detection
- **Test**: Try creating guest with same passport number twice, expect 409 or merge UI

**Task 1.2: Add Duplicate Detection Response**
- **File**: `/src/components/guests/guest-dialog.tsx`
- **What**: Handle 409 response from API
- **UI**: Show "Guest already exists" with option to:
  - Use existing guest (link/merge)
  - Override (if intentional)
- **Time**: 30 min

**Task 1.3: Update Guest Dialog to Show Existing Match**
- **File**: `/src/components/guests/guest-dialog.tsx`
- **What**: When 409 returned, show matched guest details
- **UI**: "This guest (John Doe, Passport XYZ) already exists. Use them?"
- **Time**: 30 min

---

### STAGE 2: Complete Serbia Fields (1.5 hours)

**Task 2.1: Identify Missing UI Fields**
- Read current form in `guest-dialog.tsx`
- Compare to schema (9 Serbia fields total)
- **Missing in UI**: place_of_birth, country_of_birth, unique_master_citizen
- **Time**: 15 min (research)

**Task 2.2: Add Missing Serbia Fields to Form**
- **File**: `/src/components/guests/guest-dialog.tsx`
- **What**: Add 3 missing fields to form + validation schema
- **Fields**:
  - `place_of_birth` (text)
  - `country_of_birth` (country select)
  - `unique_master_citizen` (text - JMBG-like number)
- **Time**: 45 min

**Task 2.3: Update Guest Validation Schema**
- **File**: `/src/lib/validations/guest.ts`
- **What**: Add Yup validators for new fields
- **Time**: 30 min

---

### STAGE 3: Document Upload Infrastructure (2-3 hours)

**Task 3.1: Create Document Upload UI**
- **File**: `/src/components/guests/guest-dialog.tsx` → new file `/src/components/guests/document-upload.tsx`
- **What**: File input for passport/ID images
- **Features**:
  - Accept: JPG, PNG, PDF
  - Max size: 10MB
  - Preview image thumbnail
  - Show upload progress
- **Time**: 1 hour

**Task 3.2: Create Document Upload API Route**
- **File**: `/src/app/api/guests/upload-document/route.ts` (new)
- **What**: Handle multipart file upload
- **Logic**:
  - Validate file type & size
  - Store in Supabase Storage (path: `guests/{org_id}/{guest_id}/documents/`)
  - Return file URL
  - Save URL + metadata to guest record
- **Time**: 1 hour

**Task 3.3: Wire Upload to Guest Dialog**
- **File**: `/src/components/guests/guest-dialog.tsx`
- **What**: On file select, upload and store document_url
- **Time**: 30 min

---

### STAGE 4: Duplicate Detection UI (1.5 hours) — *Optional for now*

**Task 4.1: Create Merge/Dedup Interface**
- **Component**: `/src/components/guests/duplicate-merge-dialog.tsx` (new)
- **What**: Show 2 guest records side-by-side, allow merge
- **Time**: 1 hour

**Task 4.2: Wire to Guest Creation**
- **File**: `/src/components/guests/guest-dialog.tsx`
- **What**: On duplicate detection (409), show merge dialog
- **Time**: 30 min

---

### STAGE 5: OCR Integration (4-6 hours) — *Phase 3.5 (stretch goal)*

**Only if time permits:**

**Task 5.1: Set Up Google Document AI**
- Create Google Cloud project
- Enable Document AI API
- Create service account
- Store credentials in .env.local

**Task 5.2: Create OCR API Route**
- **File**: `/src/app/api/guests/scan-document/route.ts` (new)
- Extract fields: name, document number, DOB, etc.
- Return extracted data for form prefill

**Task 5.3: Wire to Document Upload**
- On upload, run OCR
- Prefill form with extracted data
- Show confidence scores

---

## EXECUTION ORDER

### PRIORITY 1 (TODAY - Fix the bug)
1. ✅ Stage 1.1 - Fix dedup logic in API (30 min)
2. ✅ Stage 1.2 - Handle 409 response in UI (30 min)
3. ✅ Stage 1.3 - Show duplicate match UI (30 min)

**Test**: Verify dedup works end-to-end

### PRIORITY 2 (NEXT - Complete features)
4. ✅ Stage 2.1-2.3 - Add missing Serbia fields (1.5 hours)
5. ✅ Stage 3.1-3.3 - Document upload (2 hours)

**Test**: All forms submit, documents upload, Serbia fields saved

### PRIORITY 3 (IF TIME)
6. ⏳ Stage 4.1-4.2 - Merge UI (1.5 hours)
7. ⏳ Stage 5.1-5.3 - OCR (4-6 hours)

---

## DEPENDENCIES

```
Stage 1 (Fix bug)
  ↓ (must complete first)
Stage 1.2-1.3 (UI for dedup)
  ↓ (enables)
Stage 4 (Merge UI) - optional

Stage 2 (Serbia fields) - no dependencies
Stage 3 (Document upload) - no dependencies
Stage 5 (OCR) - depends on Stage 3
```

---

## SUCCESS CRITERIA

### Stage 1 ✅
- [ ] Create guest with duplicate document → shows warning
- [ ] Warning links to existing guest
- [ ] No duplicate created in database

### Stage 2 ✅
- [ ] All 9 Serbia fields present in form
- [ ] Fields validate correctly
- [ ] Fields save to database

### Stage 3 ✅
- [ ] Upload document from guest dialog
- [ ] File stored in Supabase Storage
- [ ] File URL saved to guest record
- [ ] Document visible in guest profile

### Stage 4 ⏳
- [ ] Duplicate merge dialog shows 2 guests
- [ ] Can choose which fields to keep
- [ ] Merge creates single guest record

### Stage 5 ⏳
- [ ] Upload passport → OCR extracts name, DOB, number
- [ ] Form auto-fills from OCR data
- [ ] Confidence scores shown

---

## ESTIMATED TOTAL TIME

- **Stage 1** (Fix bug): 1.5 hours
- **Stage 2** (Serbia fields): 1.5 hours
- **Stage 3** (Document upload): 2.5 hours
- **Stage 4** (Merge UI): 1.5 hours (optional)
- **Stage 5** (OCR): 4-6 hours (optional/stretch)

**Minimum for Phase 3 complete**: 5.5 hours (Stages 1-3)

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Dedup bug causes data corruption | Already exists in DB; fixing API prevents new dupes |
| Serbia fields incomplete | Clear checklist of 9 fields; validate before merge |
| File upload fails | Test with Supabase Storage credentials first |
| OCR unreliable | Start with document upload only; OCR as enhancement |

---

## NOTES

- **Dedup is CRITICAL**: Even if nothing else gets done, Stage 1 must complete
- **Serbia fields are COMPLIANCE**: Required for Serbian tax/police reporting
- **Document upload is UX**: Improves workflow significantly
- **OCR is NICE-TO-HAVE**: Works without it; improves later
- **Merge UI is CLEANUP**: Makes dedup discoverable to users

---

## Files to Create

- `/src/components/guests/document-upload.tsx` (Stage 3)
- `/src/app/api/guests/upload-document/route.ts` (Stage 3)
- `/src/components/guests/duplicate-merge-dialog.tsx` (Stage 4)
- `/src/app/api/guests/scan-document/route.ts` (Stage 5)

## Files to Modify

- `/src/app/api/guests/create/route.ts` (Stage 1.1)
- `/src/components/guests/guest-dialog.tsx` (Stages 1.2, 1.3, 2.2, 3.3, 4.2)
- `/src/lib/validations/guest.ts` (Stage 2.3)
