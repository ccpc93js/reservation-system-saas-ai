// Generated from the live Supabase schema via mcp__supabase__generate_typescript_types.
// Regenerate after any migration: this file was previously a stale hand-written
// stub (dating from Phase 1) that never got the columns/tables added in later
// phases (payment_confirmed, deposit_amount, checkin_registry, audit_log,
// channels, invitations, plan/stripe fields on organizations, etc.) — that
// staleness is what caused ~250 "Property X does not exist on type never"
// TypeScript build errors across the app.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          ip_address: string | null
          organization_id: string | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          position: number | null
          room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          position?: number | null
          room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          position?: number | null
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          bed_id: string | null
          color: string
          created_at: string
          export_token: string
          ical_url: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_synced_at: string | null
          name: string
          organization_id: string
          platform: string
          sync_count: number
          updated_at: string
        }
        Insert: {
          bed_id?: string | null
          color?: string
          created_at?: string
          export_token?: string
          ical_url?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          name: string
          organization_id: string
          platform: string
          sync_count?: number
          updated_at?: string
        }
        Update: {
          bed_id?: string | null
          color?: string
          created_at?: string
          export_token?: string
          ical_url?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          platform?: string
          sync_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_registry: {
        Row: {
          actual_check_in_at: string | null
          actual_check_out_at: string | null
          bed_name: string | null
          check_in: string | null
          check_out: string | null
          country_of_birth: string | null
          created_at: string
          date_of_birth: string | null
          document_expiry: string | null
          document_issued_date: string | null
          document_issued_place: string | null
          document_number: string | null
          document_type: string | null
          first_name: string | null
          guest_id: string | null
          id: string
          jmbg: string | null
          last_name: string | null
          nationality: string | null
          organization_id: string
          paid_amount: number | null
          payment_currency: string | null
          place_of_birth: string | null
          reservation_id: string
          reservation_number: string | null
          room_name: string | null
          service_type: string | null
          total_amount: number | null
        }
        Insert: {
          actual_check_in_at?: string | null
          actual_check_out_at?: string | null
          bed_name?: string | null
          check_in?: string | null
          check_out?: string | null
          country_of_birth?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_expiry?: string | null
          document_issued_date?: string | null
          document_issued_place?: string | null
          document_number?: string | null
          document_type?: string | null
          first_name?: string | null
          guest_id?: string | null
          id?: string
          jmbg?: string | null
          last_name?: string | null
          nationality?: string | null
          organization_id: string
          paid_amount?: number | null
          payment_currency?: string | null
          place_of_birth?: string | null
          reservation_id: string
          reservation_number?: string | null
          room_name?: string | null
          service_type?: string | null
          total_amount?: number | null
        }
        Update: {
          actual_check_in_at?: string | null
          actual_check_out_at?: string | null
          bed_name?: string | null
          check_in?: string | null
          check_out?: string | null
          country_of_birth?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_expiry?: string | null
          document_issued_date?: string | null
          document_issued_place?: string | null
          document_number?: string | null
          document_type?: string | null
          first_name?: string | null
          guest_id?: string | null
          id?: string
          jmbg?: string | null
          last_name?: string | null
          nationality?: string | null
          organization_id?: string
          paid_amount?: number | null
          payment_currency?: string | null
          place_of_birth?: string | null
          reservation_id?: string
          reservation_number?: string | null
          room_name?: string | null
          service_type?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_registry_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_registry_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          country_of_birth: string | null
          country_of_residence: string | null
          created_at: string
          date_of_birth: string | null
          document_expiry: string | null
          document_hash: string | null
          document_issued_date: string | null
          document_issued_place: string | null
          document_number: string | null
          document_type: string | null
          document_url: Json | null
          email: string | null
          first_name: string
          gender: string | null
          id: string
          jmbg: string | null
          last_name: string
          nationality: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          place_of_birth: string | null
          place_of_residence: string | null
          unique_master_citizen: string | null
          updated_at: string
        }
        Insert: {
          country_of_birth?: string | null
          country_of_residence?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_expiry?: string | null
          document_hash?: string | null
          document_issued_date?: string | null
          document_issued_place?: string | null
          document_number?: string | null
          document_type?: string | null
          document_url?: Json | null
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          jmbg?: string | null
          last_name: string
          nationality?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          place_of_birth?: string | null
          place_of_residence?: string | null
          unique_master_citizen?: string | null
          updated_at?: string
        }
        Update: {
          country_of_birth?: string | null
          country_of_residence?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_expiry?: string | null
          document_hash?: string | null
          document_issued_date?: string | null
          document_issued_place?: string | null
          document_number?: string | null
          document_type?: string | null
          document_url?: Json | null
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          jmbg?: string | null
          last_name?: string
          nationality?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          place_of_birth?: string | null
          place_of_residence?: string | null
          unique_master_citizen?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          link: string | null
          organization_id: string
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          organization_id: string
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          organization_id?: string
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          check_in_time: string | null
          check_out_time: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string | null
          description: string | null
          email: string | null
          id: string
          locale: string
          logo_url: string | null
          name: string
          pending_plan: string | null
          phone: string | null
          plan: string
          plan_expires_at: string | null
          plan_updated_at: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          theme_color: string | null
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          email?: string | null
          id?: string
          locale?: string
          logo_url?: string | null
          name: string
          pending_plan?: string | null
          phone?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_updated_at?: string | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          theme_color?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          email?: string | null
          id?: string
          locale?: string
          logo_url?: string | null
          name?: string
          pending_plan?: string | null
          phone?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_updated_at?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          theme_color?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      reservation_items: {
        Row: {
          bed_id: string
          check_in: string
          check_out: string
          created_at: string
          id: string
          organization_id: string
          price_per_night: number
          reservation_id: string
          total_price: number
        }
        Insert: {
          bed_id: string
          check_in: string
          check_out: string
          created_at?: string
          id?: string
          organization_id: string
          price_per_night: number
          reservation_id: string
          total_price: number
        }
        Update: {
          bed_id?: string
          check_in?: string
          check_out?: string
          created_at?: string
          id?: string
          organization_id?: string
          price_per_night?: number
          reservation_id?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservation_items_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          actual_check_in_at: string | null
          actual_check_out_at: string | null
          adults: number
          channel: string
          channel_id: string | null
          channel_source: string
          check_in: string
          check_in_token: string | null
          check_in_verified_at: string | null
          check_in_verified_by: string | null
          check_out: string
          children: number
          city_tax_amount: number | null
          city_tax_paid: boolean | null
          created_at: string
          created_by: string | null
          deposit_amount: number | null
          deposit_currency: string | null
          entry_date_serbia: string | null
          entry_place_serbia: string | null
          external_id: string | null
          external_sync_at: string | null
          guest_id: string | null
          id: string
          id_photos: Json | null
          key_deposit_item: string | null
          key_deposit_paid: boolean | null
          notes: string | null
          online_checkin_completed_at: string | null
          online_checkin_token: string | null
          organization_id: string
          paid_amount: number
          payment_confirmed: boolean
          payment_currency: string | null
          reservation_number: string
          self_check_in_data: Json | null
          self_check_in_submitted_at: string | null
          service_type: string | null
          special_requests: string | null
          status: string
          stay_approved_until: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          actual_check_in_at?: string | null
          actual_check_out_at?: string | null
          adults?: number
          channel?: string
          channel_id?: string | null
          channel_source?: string
          check_in: string
          check_in_token?: string | null
          check_in_verified_at?: string | null
          check_in_verified_by?: string | null
          check_out: string
          children?: number
          city_tax_amount?: number | null
          city_tax_paid?: boolean | null
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_currency?: string | null
          entry_date_serbia?: string | null
          entry_place_serbia?: string | null
          external_id?: string | null
          external_sync_at?: string | null
          guest_id?: string | null
          id?: string
          id_photos?: Json | null
          key_deposit_item?: string | null
          key_deposit_paid?: boolean | null
          notes?: string | null
          online_checkin_completed_at?: string | null
          online_checkin_token?: string | null
          organization_id: string
          paid_amount?: number
          payment_confirmed?: boolean
          payment_currency?: string | null
          reservation_number: string
          self_check_in_data?: Json | null
          self_check_in_submitted_at?: string | null
          service_type?: string | null
          special_requests?: string | null
          status?: string
          stay_approved_until?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          actual_check_in_at?: string | null
          actual_check_out_at?: string | null
          adults?: number
          channel?: string
          channel_id?: string | null
          channel_source?: string
          check_in?: string
          check_in_token?: string | null
          check_in_verified_at?: string | null
          check_in_verified_by?: string | null
          check_out?: string
          children?: number
          city_tax_amount?: number | null
          city_tax_paid?: boolean | null
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_currency?: string | null
          entry_date_serbia?: string | null
          entry_place_serbia?: string | null
          external_id?: string | null
          external_sync_at?: string | null
          guest_id?: string | null
          id?: string
          id_photos?: Json | null
          key_deposit_item?: string | null
          key_deposit_paid?: boolean | null
          notes?: string | null
          online_checkin_completed_at?: string | null
          online_checkin_token?: string | null
          organization_id?: string
          paid_amount?: number
          payment_confirmed?: boolean
          payment_currency?: string | null
          reservation_number?: string
          self_check_in_data?: Json | null
          self_check_in_submitted_at?: string | null
          service_type?: string | null
          special_requests?: string | null
          status?: string
          stay_approved_until?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          base_price: number
          capacity: number
          created_at: string
          description: string | null
          gender: string | null
          id: string
          name: string
          organization_id: string
          type: string
        }
        Insert: {
          base_price?: number
          capacity?: number
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          name: string
          organization_id: string
          type: string
        }
        Update: {
          base_price?: number
          capacity?: number
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          name?: string
          organization_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          floor: number | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          room_type_id: string
        }
        Insert: {
          created_at?: string
          floor?: number | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          room_type_id: string
        }
        Update: {
          created_at?: string
          floor?: number | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          room_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_sessions: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          extracted_fields: Json | null
          id: string
          organization_id: string
          photo_path: string | null
          processed_at: string | null
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          extracted_fields?: Json | null
          id?: string
          organization_id: string
          photo_path?: string | null
          processed_at?: string | null
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          extracted_fields?: Json | null
          id?: string
          organization_id?: string
          photo_path?: string | null
          processed_at?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_ota_reservation: {
        Args: {
          p_bed_id: string
          p_channel_id: string
          p_channel_source: string
          p_check_in: string
          p_check_out: string
          p_external_id: string
          p_guest_id: string
          p_notes: string
          p_organization_id: string
        }
        Returns: string
      }
      generate_reservation_number: { Args: { org_id: string }; Returns: string }
      get_user_org_ids: { Args: never; Returns: string[] }
      is_org_admin: { Args: { org_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// ─── Convenience row-type aliases (kept for existing imports elsewhere) ──────
// These now derive from the real schema above instead of being hand-maintained,
// so they can't drift out of sync with the database again.
export type Organization = Tables<"organizations">
export type Membership = Tables<"memberships">
export type RoomType = Tables<"room_types">
export type Room = Tables<"rooms">
export type Bed = Tables<"beds">
export type Guest = Tables<"guests">
export type Reservation = Tables<"reservations">
export type ReservationItem = Tables<"reservation_items">
export type ScanSession = Tables<"scan_sessions">
export type Channel = Tables<"channels">
export type Invitation = Tables<"invitations">
export type CheckinRegistryEntry = Tables<"checkin_registry">
export type AuditLogEntry = Tables<"audit_log">
export type Notification = Tables<"notifications">

// ─── Document Types (custom API response shapes, not DB tables) ──────────────

export interface DocumentMetadata {
  url: string;
  fileName: string;
  uploadedAt: string;
  type: string;
  filePath?: string;
}

export interface UploadDocumentResponse {
  success: boolean;
  url: string;
  fileName: string;
  filePath: string;
}
