# Phase 3 TypeScript Types

Complete type definitions for guest management and document upload features.

## Updated Types

### Guest Interface (src/lib/types/database.ts)

```typescript
export interface Guest {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  document_type: "passport" | "national_id" | "drivers_license" | null;
  document_number: string | null;
  document_hash: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  notes: string | null;
  
  // NEW: Serbia-specific fields
  place_of_birth: string | null;
  country_of_birth: string | null;
  place_of_residence: string | null;
  country_of_residence: string | null;
  document_expiry: string | null;
  document_issued_place: string | null;
  document_issued_date: string | null;
  jmbg: string | null;
  unique_master_citizen: string | null;
  
  // NEW: Document uploads
  document_url: string | null;
  
  created_at: string;
  updated_at: string;
}
```

### New Document Types

```typescript
// Metadata for a single uploaded document
export interface DocumentMetadata {
  url: string;           // Public URL from Supabase Storage
  fileName: string;      // Original filename
  uploadedAt: string;    // ISO timestamp
  type: string;          // MIME type (e.g., "image/jpeg")
}

// API response from /api/guests/upload-document
export interface UploadDocumentResponse {
  success: boolean;      // Operation success
  url: string;           // Public URL
  fileName: string;      // Original filename
  filePath: string;      // Path in storage bucket
}
```

## Type Usage

### In DocumentUpload Component

```typescript
import { DocumentMetadata, UploadDocumentResponse } from "@/lib/types/database";

// Type the fetch response
const result = (await response.json()) as UploadDocumentResponse & { error?: string };
```

### In Guest Dialog

```typescript
import { Guest, DocumentMetadata } from "@/lib/types/database";

// Guest data from API
const guest: Guest = await fetch(...).then(r => r.json());

// Access document URLs
const documents: DocumentMetadata[] = guest.document_url 
  ? JSON.parse(guest.document_url) 
  : [];
```

## Database Schema Alignment

All TypeScript types now match the Supabase schema:

**guests table columns:**
- ✅ Basic info: first_name, last_name, email, phone
- ✅ Document fields: document_type, document_number, document_hash
- ✅ Personal: date_of_birth, gender, nationality
- ✅ Serbia fields: place_of_birth, country_of_birth, place_of_residence, country_of_residence, document_expiry, document_issued_place, document_issued_date, jmbg, unique_master_citizen
- ✅ New: document_url (JSON array of DocumentMetadata)

## Related Validations

Guest validation schemas match these types:

**createGuestSchema** and **updateGuestSchema** in `/src/lib/validations/guest.ts`:
- All Guest fields are optional (except first_name, last_name)
- Date fields use yup.date()
- String fields have max length validation
- document_type uses enum validation

## Notes

- `document_url` is stored as a JSON string (text column)
- Parse with: `JSON.parse(guest.document_url)` to get `DocumentMetadata[]`
- Each document upload appends to the array (preserving history)
- `document_hash` is generated from `{document_type}:{document_number}` for dedup
