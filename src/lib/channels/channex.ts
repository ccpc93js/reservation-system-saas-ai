// Channex API client — thin fetch wrapper over the Channex channel-manager REST
// API. Server-only (uses the master API key). Verified payload shapes live in
// .claude/skills/channex-pms-integration/references/api.md.
//
// Conventions enforced here so no other layer has to care:
//   - `user-api-key` header on every request
//   - success bodies are unwrapped from the {"data": ...} envelope
//   - errors normalize to a thrown ChannexError with code/title/details
//   - money crosses this boundary in MINOR units (cents, integers) on writes;
//     reads return decimal strings — callers convert.
//   - dates are ISO `YYYY-MM-DD`; never send past dates to ARI endpoints.

const DEFAULT_BASE_URL = "https://staging.channex.io/api/v1";

export class ChannexError extends Error {
  code: string;
  title: string;
  details?: string[];
  status: number;
  constructor(status: number, code: string, title: string, details?: string[]) {
    super(`Channex ${status} ${code}: ${title}${details?.length ? ` (${details.join("; ")})` : ""}`);
    this.name = "ChannexError";
    this.status = status;
    this.code = code;
    this.title = title;
    this.details = details;
  }
}

export class ChannexConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannexConfigError";
  }
}

function config() {
  const apiKey = process.env.CHANNEX_API_KEY;
  if (!apiKey) {
    throw new ChannexConfigError(
      "CHANNEX_API_KEY is not set — add it to the environment before using the Channex integration."
    );
  }
  const baseUrl = (process.env.CHANNEX_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

type Query = Record<string, string | number | undefined>;

interface RequestOpts {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  // transient-failure retries (network / 5xx). Reads and idempotent upserts
  // are safe to retry; keep it modest.
  retries?: number;
}

function buildUrl(baseUrl: string, path: string, query?: Query) {
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function channexRequest<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { apiKey, baseUrl } = config();
  const { method = "GET", body, query, retries = 2 } = opts;
  const url = buildUrl(baseUrl, path, query);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "user-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        // never cache channel-manager reads
        cache: "no-store",
      });

      // Retry transient server errors.
      if (res.status >= 500 && attempt < retries) {
        lastErr = new ChannexError(res.status, "server_error", res.statusText);
        await backoff(attempt);
        continue;
      }

      const text = await res.text();
      const json = text ? safeParse(text) : null;

      if (!res.ok) {
        const e = (json as any)?.errors;
        throw new ChannexError(
          res.status,
          e?.code ?? "http_error",
          e?.title ?? res.statusText ?? "Request failed",
          Array.isArray(e?.details) ? e.details : undefined
        );
      }

      // Success — unwrap the {data, meta} envelope. Return both when meta is
      // present (feeds/lists paginate), otherwise just data.
      if (json && typeof json === "object" && "data" in (json as any)) {
        const { data, meta } = json as any;
        return (meta !== undefined ? { data, meta } : data) as T;
      }
      return json as T;
    } catch (err) {
      // Network-level failure (fetch throws): retry, then rethrow.
      if (err instanceof ChannexError || err instanceof ChannexConfigError) throw err;
      lastErr = err;
      if (attempt < retries) {
        await backoff(attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function backoff(attempt: number) {
  return new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
}

// ─── Types (minimal — the fields we actually read) ───────────────────────────

export interface ChannexEntity {
  id: string;
  attributes?: Record<string, unknown>;
}

export interface PropertyAttrs {
  title: string;
  currency: string; // ISO 4217
  email?: string;
  phone?: string;
  website?: string;
  country?: string; // 2-letter
  state?: string;
  city?: string;
  address?: string;
  zip_code?: string;
  timezone?: string; // IANA
  content?: { description?: string; important_information?: string };
}

export interface RoomTypeAttrs {
  property_id: string;
  title: string;
  count_of_rooms: number;
  occ_adults?: number;
  occ_children?: number;
  occ_infants?: number;
  default_occupancy?: number;
  room_kind?: "room" | "dorm";
}

export interface RatePlanOption {
  occupancy: number;
  is_primary?: boolean;
  rate: number; // MINOR units (cents) on write
}

export interface RatePlanAttrs {
  property_id: string;
  room_type_id: string;
  title: string;
  currency: string;
  sell_mode?: "per_room" | "per_person";
  rate_mode?: "manual" | "derived" | "auto" | "cascade";
  options?: RatePlanOption[];
}

// "Options" endpoints — lightweight id/title lists the guide recommends for
// mapping UIs ("get mapping info"). Verified shapes against staging.
export interface PropertyOption {
  id: string;
  title: string;
  currency: string;
  is_owner: boolean;
  group_ids: string[]; // needed as group_id when creating a channel (Phase 5)
}

export interface RoomTypeOption {
  id: string;
  title: string;
  property_id: string;
  occ_adults: number;
  occ_children: number;
  occ_infants: number;
  default_occupancy: number;
}

export interface RatePlanOptionInfo {
  id: string;
  title: string;
  currency: string;
  property_id: string;
  room_type_id: string;
  occupancy: number;
  sell_mode: "per_room" | "per_person";
}

// The options endpoints return entities as {id, type, attributes:{...}}; the
// useful fields live under attributes.
function unwrapOptions<T>(rows: ChannexEntity[]): T[] {
  return rows.map((r) => ({ id: r.id, ...(r.attributes as object) })) as T[];
}

export interface AvailabilityValue {
  property_id: string;
  room_type_id: string;
  availability: number;
  date?: string;
  date_from?: string;
  date_to?: string;
}

export interface RestrictionValue {
  property_id: string;
  rate_plan_id: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  rate?: number; // cents (per_room)
  rates?: { occupancy: number; rate: number }[]; // per_person
  min_stay_arrival?: number;
  min_stay_through?: number;
  stop_sell?: boolean;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export const channex = {
  /** Connectivity check — GET /properties. Returns the property list. */
  listProperties(): Promise<ChannexEntity[]> {
    return channexRequest<ChannexEntity[]>("/properties");
  },

  getProperty(id: string): Promise<ChannexEntity> {
    return channexRequest<ChannexEntity>(`/properties/${id}`);
  },

  /** Mapping list: properties visible to the key (id/title/currency/group_ids). */
  async propertyOptions(): Promise<PropertyOption[]> {
    return unwrapOptions<PropertyOption>(await channexRequest<ChannexEntity[]>("/properties/options"));
  },

  /** Mapping list: room types for a property (id/title/occupancy). */
  async roomTypeOptions(propertyId: string): Promise<RoomTypeOption[]> {
    return unwrapOptions<RoomTypeOption>(
      await channexRequest<ChannexEntity[]>("/room_types/options", { query: { "filter[property_id]": propertyId } })
    );
  },

  /** Mapping list: rate plans for a property (id/title/room_type_id/occupancy). */
  async ratePlanOptions(propertyId: string): Promise<RatePlanOptionInfo[]> {
    return unwrapOptions<RatePlanOptionInfo>(
      await channexRequest<ChannexEntity[]>("/rate_plans/options", { query: { "filter[property_id]": propertyId } })
    );
  },

  createProperty(attrs: PropertyAttrs): Promise<ChannexEntity> {
    return channexRequest<ChannexEntity>("/properties", { method: "POST", body: { property: attrs } });
  },

  updateProperty(id: string, attrs: Partial<PropertyAttrs>): Promise<ChannexEntity> {
    return channexRequest<ChannexEntity>(`/properties/${id}`, { method: "PUT", body: { property: attrs } });
  },

  listRoomTypes(propertyId: string): Promise<ChannexEntity[]> {
    return channexRequest<ChannexEntity[]>("/room_types", { query: { "filter[property_id]": propertyId } });
  },

  createRoomType(attrs: RoomTypeAttrs): Promise<ChannexEntity> {
    return channexRequest<ChannexEntity>("/room_types", { method: "POST", body: { room_type: attrs } });
  },

  updateRoomType(id: string, attrs: Partial<RoomTypeAttrs>): Promise<ChannexEntity> {
    return channexRequest<ChannexEntity>(`/room_types/${id}`, { method: "PUT", body: { room_type: attrs } });
  },

  listRatePlans(propertyId: string): Promise<ChannexEntity[]> {
    return channexRequest<ChannexEntity[]>("/rate_plans", { query: { "filter[property_id]": propertyId } });
  },

  createRatePlan(attrs: RatePlanAttrs): Promise<ChannexEntity> {
    return channexRequest<ChannexEntity>("/rate_plans", { method: "POST", body: { rate_plan: attrs } });
  },

  updateRatePlan(id: string, attrs: Partial<RatePlanAttrs>): Promise<ChannexEntity> {
    return channexRequest<ChannexEntity>(`/rate_plans/${id}`, { method: "PUT", body: { rate_plan: attrs } });
  },

  /** Availability push — per room type. Separate message from restrictions. */
  pushAvailability(values: AvailabilityValue[]): Promise<unknown> {
    return channexRequest("/availability", { method: "POST", body: { values } });
  },

  /** Restrictions push — per rate plan (rate/min-stay/closures). Partial. */
  pushRestrictions(values: RestrictionValue[]): Promise<unknown> {
    return channexRequest("/restrictions", { method: "POST", body: { values } });
  },

  /** Readback for verification: {ROOM_TYPE_UUID: {"2026-07-01": 2, ...}}. */
  getAvailability(propertyId: string, dateFrom: string, dateTo: string): Promise<Record<string, Record<string, number>>> {
    return channexRequest("/availability", {
      query: { "filter[property_id]": propertyId, "filter[date][gte]": dateFrom, "filter[date][lte]": dateTo },
    });
  },

  /** Readback: filter[restrictions] is REQUIRED (400 without it). */
  getRestrictions(
    propertyId: string,
    dateFrom: string,
    dateTo: string,
    restrictions: string[] = ["rate"]
  ): Promise<Record<string, Record<string, Record<string, unknown>>>> {
    return channexRequest("/restrictions", {
      query: {
        "filter[property_id]": propertyId,
        "filter[date][gte]": dateFrom,
        "filter[date][lte]": dateTo,
        "filter[restrictions]": restrictions.join(","),
      },
    });
  },

  // ── Inbound bookings ──

  /** One page of unacked revisions (oldest-first). Drain until meta.total 0. */
  bookingFeed(page = 1): Promise<FeedPage> {
    return channexRequest<FeedPage>("/booking_revisions/feed", { query: { page } });
  },

  /** One revision by id (use after a webhook — pull is source of truth). */
  getRevision(id: string): Promise<Revision> {
    return channexRequest<Revision>(`/booking_revisions/${id}`);
  },

  /** Acknowledge a revision so it leaves the feed. Ack only after apply. */
  ackRevision(id: string): Promise<unknown> {
    return channexRequest(`/booking_revisions/${id}/ack`, { method: "POST", body: {} });
  },

  /** Durable booking list — MANUAL, time-scoped recovery after a >30-min gap. */
  listBookings(propertyId: string, insertedSince?: string): Promise<unknown> {
    return channexRequest("/bookings", {
      query: { "filter[property_id]": propertyId, "filter[inserted_at][gte]": insertedSince },
    });
  },

  // ── Webhooks (registration) ──

  listWebhooks(): Promise<ChannexEntity[]> {
    return channexRequest<ChannexEntity[]>("/webhooks");
  },

  /** Register a callback for booking events. property_id null = all properties. */
  createWebhook(attrs: {
    callback_url: string;
    event_mask?: string;
    property_id?: string | null;
    is_active?: boolean;
    send_data?: boolean;
  }): Promise<ChannexEntity> {
    return channexRequest<ChannexEntity>("/webhooks", {
      method: "POST",
      body: {
        webhook: {
          event_mask: "booking_new;booking_modification;booking_cancellation",
          is_active: true,
          send_data: false,
          ...attrs,
        },
      },
    });
  },

  deleteWebhook(id: string): Promise<unknown> {
    return channexRequest(`/webhooks/${id}`, { method: "DELETE" });
  },
};

// ─── Inbound bookings (revision feed) ────────────────────────────────────────

export interface RevisionRoom {
  checkin_date?: string;
  checkout_date?: string;
  room_type_id?: string;
  rate_plan_id?: string;
  amount?: string;
  occupancy?: { adults?: number; children?: number; infants?: number };
  days?: Record<string, string>;
  guests?: unknown[];
}

export interface RevisionAttributes {
  booking_id: string;
  status: "new" | "modified" | "cancelled";
  property_id: string;
  ota_name?: string;
  ota_reservation_code?: string;
  arrival_date?: string;
  departure_date?: string;
  amount?: string; // major units, string
  currency?: string;
  payment_collect?: "ota" | "property";
  customer?: {
    name?: string;
    surname?: string;
    mail?: string;
    phone?: string;
    country?: string;
    address?: string;
  };
  rooms?: RevisionRoom[];
}

export interface Revision {
  id: string; // revision UUID (ack target)
  attributes: RevisionAttributes;
}

export interface FeedPage {
  data: Revision[];
  meta: { total: number; limit: number; page: number };
}

// Convert a major-unit amount (e.g. 80 or "80.00") to Channex cents. Money
// crosses into the API here and nowhere else.
export function toChannexMinor(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}
