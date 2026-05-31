// Auto-generate the real version with: npx supabase gen types typescript --local
// This is a hand-written starter — replace after running the schema.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

export type ReservationChannel =
  | "walk_in"
  | "phone"
  | "email"
  | "booking_com"
  | "airbnb"
  | "hostelworld"
  | "direct_website"
  | "other";

export type MemberRole = "owner" | "manager" | "staff";

export type RoomTypeCategory = "dorm" | "private";

export type ScanSessionStatus =
  | "pending"
  | "uploading"
  | "processed"
  | "failed"
  | "expired";

// ─── Row types (what comes back from SELECT queries) ─────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface RoomType {
  id: string;
  organization_id: string;
  name: string;
  type: RoomTypeCategory;
  gender: "mixed" | "female" | "male" | null;
  capacity: number;
  base_price: number;
  description: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  organization_id: string;
  room_type_id: string;
  name: string;
  floor: number | null;
  notes: string | null;
  created_at: string;
}

export interface Bed {
  id: string;
  organization_id: string;
  room_id: string;
  name: string;
  position: number | null;
  is_active: boolean;
  created_at: string;
}

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
  place_of_birth: string | null;
  country_of_birth: string | null;
  place_of_residence: string | null;
  country_of_residence: string | null;
  document_expiry: string | null;
  document_issued_place: string | null;
  document_issued_date: string | null;
  jmbg: string | null;
  unique_master_citizen: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  organization_id: string;
  guest_id: string | null;
  reservation_number: string;
  check_in: string;
  check_out: string;
  status: ReservationStatus;
  channel: ReservationChannel;
  adults: number;
  children: number;
  total_amount: number;
  paid_amount: number;
  notes: string | null;
  special_requests: string | null;
  online_checkin_token: string | null;
  online_checkin_completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservationItem {
  id: string;
  organization_id: string;
  reservation_id: string;
  bed_id: string;
  check_in: string;
  check_out: string;
  price_per_night: number;
  total_price: number;
  created_at: string;
}

export interface ScanSession {
  id: string;
  organization_id: string;
  created_by: string;
  token: string;
  status: ScanSessionStatus;
  expires_at: string;
  extracted_fields: Json | null;
  photo_path: string | null;
  created_at: string;
  processed_at: string | null;
}

// ─── Document Types ─────────────────────────────────────────────────────────

export interface DocumentMetadata {
  url: string;
  fileName: string;
  uploadedAt: string;
  type: string;
}

export interface UploadDocumentResponse {
  success: boolean;
  url: string;
  fileName: string;
  filePath: string;
}

// ─── Supabase Database type (for typed client) ───────────────────────────────
export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> };
      memberships: { Row: Membership; Insert: Partial<Membership>; Update: Partial<Membership> };
      room_types: { Row: RoomType; Insert: Partial<RoomType>; Update: Partial<RoomType> };
      rooms: { Row: Room; Insert: Partial<Room>; Update: Partial<Room> };
      beds: { Row: Bed; Insert: Partial<Bed>; Update: Partial<Bed> };
      guests: { Row: Guest; Insert: Partial<Guest>; Update: Partial<Guest> };
      reservations: { Row: Reservation; Insert: Partial<Reservation>; Update: Partial<Reservation> };
      reservation_items: { Row: ReservationItem; Insert: Partial<ReservationItem>; Update: Partial<ReservationItem> };
      scan_sessions: { Row: ScanSession; Insert: Partial<ScanSession>; Update: Partial<ScanSession> };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
