# Phase 3: Duplicate Guest Handling Strategy

## Problem
Users may intentionally create duplicate guest records due to:
- Same person with different spelling variations (João vs Joao)
- Same person using different documents (Passport vs ID)
- Genuine duplicates from data entry errors
- Multiple visits same person under different info

## Current Implementation (Stage 1 Complete)

### Detection Flow
1. When creating guest with document number:
   - Generate SHA256 hash of document number
   - Query for `(organization_id, document_hash)` match
   - If found → Show duplicate alert
   - User can "Use Existing" or "Create Anyway"

### When User Clicks "Create Anyway"
1. Form submits with `force_create: true` flag
2. API skips dedup check
3. Guest record created with duplicate document
4. **System adds audit note**: `[DUPLICATE CREATED - 2026-05-26 14:32]`
5. Timestamp in notes provides audit trail

### Example Flow
```
1. Create guest: "Test User" with "PAP123"
   → Success

2. Create guest: "Test User 2" with "PAP123"
   → Alert: "Guest already exists"
   → User clicks "Create Anyway"
   → Guest created with note: "[DUPLICATE CREATED - 2026-05-26 14:32]"
```

## Best Practices Implemented

### ✅ Audit Trail
- Timestamp in notes tracks when duplicate was created
- User ID captured in API logs (via server client)
- Easy to filter/find duplicates later

### ✅ No Silent Failures
- User is always warned before duplicate created
- Requires explicit action to override
- Prevents accidental duplicates

### ✅ Future-Proof
- Setup ready for Phase 4+ features:
  - Guest merge/link dialog
  - Deduplication cleanup tools
  - Merge audit history

## Recommended Future Enhancements

### Phase 4+: Guest Merge Tool
- UI to merge two guest records
- Combine reservation history
- Keep audit trail of merge

### Phase 4+: Duplicate Report
- Dashboard showing suspected duplicates
- Filter by date range, document type
- Bulk merge operations

### Phase 5+: Smart Matching
- Fuzzy name matching (Levenshtein distance)
- Email domain matching
- Phone number partial matching
- Alert on likely duplicates (not just exact docs)

## Notes Field Strategy

When `force_create=true`:
```typescript
notes = `${existing_notes}\n[DUPLICATE CREATED - timestamp]`
```

This keeps:
- Original notes intact
- Clear audit marker
- Easy to regex search later
- Human readable

Alternative (future):
```typescript
// Add metadata field in Phase 5
metadata: {
  duplicate_created_at: "2026-05-26T14:32:00Z",
  duplicate_of_guest_id: "abc123" (when we track the source)
}
```

## Current Limitations

⚠️ **Known Gap**: We generate hash from `document_number` only
- **Better**: Hash should include (document_type + document_number)
- Example: "passport:PAP123" vs "id:PAP123" are different people
- **Fix**: Update hash generation in API create route
  ```typescript
  const documentHash = crypto
    .createHash("sha256")
    .update(`${data.document_type}:${data.document_number}`)
    .digest("hex");
  ```

## Testing Checklist

- [x] Create guest with document → success
- [x] Try same document → dedup alert shows
- [x] "Use Existing" → closes dialog
- [x] "Create Anyway" → creates with audit note
- [ ] Verify note contains timestamp
- [ ] Verify guest searchable by name
- [ ] Verify duplicate flagged in future (filter by "[DUPLICATE CREATED")
