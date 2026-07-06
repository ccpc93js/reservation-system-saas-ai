// In-app Help Center content registry.
//
// Articles are plain typed data so the help page can search across every
// section of the app (title + summary + keywords + body text). Content is
// written in English (product documentation language); the page chrome is
// translated via i18n. Add new categories/articles here as features ship.

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; text: string }
  | { type: "callout"; tone: "info" | "warning"; text: string };

export interface HelpArticle {
  slug: string;
  category: string;
  title: string;
  summary: string;
  keywords: string[];
  blocks: HelpBlock[];
}

export interface HelpCategory {
  id: string;
  label: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "channel-manager", label: "Channel Manager" },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "channel-manager-overview",
    category: "channel-manager",
    title: "Channel manager overview: how OTA sync works",
    summary:
      "What syncs between your property and OTAs (Airbnb, Booking.com, VRBO), the two mapping modes, and iCal's limits.",
    keywords: ["ota", "ical", "sync", "airbnb", "booking.com", "vrbo", "hostelworld", "channel", "availability", "export url"],
    blocks: [
      {
        type: "p",
        text: "The channel manager keeps availability in sync between this app and OTAs using **iCal calendar feeds**, in both directions:",
      },
      {
        type: "list",
        items: [
          "**Import** — the app reads the OTA's iCal feed and creates, updates or cancels reservations from its events.",
          "**Export** — the app publishes an Export URL per channel; the OTA reads it and blocks the dates you have sold elsewhere (direct bookings or other OTAs).",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "iCal carries dates only — no prices. OTA reservations arrive with a price of 0 for staff to fill in on the reservation's Payment & Folio section.",
      },
      { type: "h2", text: "The two mapping modes" },
      {
        type: "table",
        headers: ["Mode", "What it means", "When to use"],
        rows: [
          ["Bed", "The channel is pinned to one physical bed", "Private rooms; per-bed dorm listings"],
          ["Room type (pooled)", "The channel sells from the room type's bed pool; each incoming booking auto-assigns any free bed", "Dorms — flexible, sells more nights"],
        ],
      },
      {
        type: "p",
        text: "Why pooled mode matters: with bed mapping, if a walk-in takes bed 101 that listing shows closed even when five other beds are free. With room-type mapping the listing stays open until the whole pool is exhausted.",
      },
      { type: "h2", text: "Sync timing" },
      {
        type: "list",
        items: [
          "OTAs re-read your Export URL on their own schedule, roughly every 1–12 hours (Airbnb ~4h).",
          "Imports run when you press **Sync** on a channel, **Sync All**, or automatically via the scheduled job.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text: "Booking.com only offers iCal for single-unit properties (apartments, vacation homes). Multi-unit hotel/hostel room types on Booking.com require a certified connectivity partner and cannot sync over iCal. Airbnb and VRBO provide iCal per listing.",
      },
    ],
  },
  {
    slug: "channel-manager-private-room",
    category: "channel-manager",
    title: "Connect a private room (bed mode)",
    summary: "Step-by-step: link one OTA listing to one bed and exchange iCal URLs.",
    keywords: ["private room", "bed mode", "connect", "ical url", "setup", "airbnb", "listing"],
    blocks: [
      { type: "h2", text: "On the OTA" },
      {
        type: "steps",
        items: [
          "Create (or open) the listing for the room — one unit, e.g. \"Private Double Room\".",
          "Open its calendar sync / availability settings.",
          "Copy the OTA's **iCal export URL** — you will paste it into the app.",
        ],
      },
      { type: "h2", text: "In the app" },
      {
        type: "steps",
        items: [
          "Go to **Channels** → *Individual beds* → find the room's bed.",
          "Click **Connect OTA**, pick the platform and paste the OTA's iCal URL.",
          "Save, then copy the channel's **Export URL**.",
          "Paste the Export URL into the OTA's \"import calendar\" field.",
        ],
      },
      { type: "h2", text: "What arrives" },
      { type: "p", text: "Each OTA reservation is one calendar event:" },
      {
        type: "code",
        text: "BEGIN:VEVENT\nUID:abc123@airbnb.com          ← stable id (dedupe / updates / cancellations)\nDTSTART;VALUE=DATE:20260810    ← check-in\nDTEND;VALUE=DATE:20260813      ← check-out\nSUMMARY:Reserved - John (HMABC123)\nEND:VEVENT",
      },
      {
        type: "p",
        text: "The app creates one confirmed reservation on that bed and auto-creates a guest from the event summary. If the OTA later cancels or moves the event, the reservation follows on the next sync.",
      },
    ],
  },
  {
    slug: "channel-manager-dorm-pool",
    category: "channel-manager",
    title: "Connect a dorm with pooled beds (room-type mode)",
    summary: "Recommended dorm setup: several OTA listings selling from one bed pool with automatic bed assignment.",
    keywords: ["dorm", "room type", "pool", "auto-assign", "hostel", "shared", "pooled beds", "listings"],
    blocks: [
      {
        type: "p",
        text: "For dorms, map channels to the **room type** instead of a fixed bed. Incoming bookings automatically get any free bed, and your listings only close when the whole dorm is full.",
      },
      { type: "h2", text: "On the OTA (e.g. Airbnb)" },
      {
        type: "steps",
        items: [
          "Create N identical listings, e.g. 4 × \"Bed in 6-bed mixed dorm\" — no specific bed.",
          "Each listing has its own iCal export URL and its own import field.",
        ],
      },
      { type: "h2", text: "In the app" },
      {
        type: "steps",
        items: [
          "Go to **Channels** → *Room types (pooled beds)* → your dorm.",
          "Click **Connect OTA** once per listing (4 listings → 4 channels, all on the same room type).",
          "For each channel: paste the listing's iCal URL, save, copy the Export URL back into that listing.",
        ],
      },
      { type: "h2", text: "Behaviour" },
      {
        type: "list",
        items: [
          "**Incoming** — every reservation auto-assigns any free bed in the dorm. Assignment is atomic, so two simultaneous syncs can never grab the same bed.",
          "**Outgoing** — each Export URL blocks dates only when the whole pool is exhausted, not when one particular bed is taken.",
          "**Overbooking** — if a booking arrives and no bed is free, staff receive an OVERBOOKING notification instead of the booking being silently dropped.",
          "**Date changes** — if the OTA moves a booking and its assigned bed now clashes, the app reassigns it to another free bed automatically.",
        ],
      },
      { type: "h2", text: "Alternative: one listing per bed" },
      {
        type: "p",
        text: "You can also create one OTA listing per physical bed and connect each as a **bed-mode** channel. It works, but it is rigid: a walk-in on bed 101 closes listing 1 even if five beds are free. Prefer the pooled setup.",
      },
    ],
  },
  {
    slug: "channel-manager-allotment",
    category: "channel-manager",
    title: "Allotment: hold beds back for walk-ins",
    summary: "Cap how many beds of a dorm a channel may sell, keeping the rest for the front desk.",
    keywords: ["allotment", "walk-in", "hold back", "cap", "quota", "limit beds"],
    blocks: [
      {
        type: "p",
        text: "Allotment caps how many beds of the room type a channel may sell. Example: a 6-bed dorm where you want to sell at most 4 beds online and keep 2 for the front desk.",
      },
      {
        type: "steps",
        items: [
          "When connecting the channel (or editing it later), set **Allotment = 4**.",
          "The Export URL now blocks dates once only 2 beds remain free.",
        ],
      },
      { type: "code", text: "sellable = free beds − (total beds − allotment)\n         = free − (6 − 4)\n→ channel closes when free ≤ 2" },
      {
        type: "p",
        text: "Leave allotment empty to let the channel sell every bed in the pool.",
      },
    ],
  },
  {
    slug: "channel-manager-troubleshooting",
    category: "channel-manager",
    title: "Troubleshooting channel sync",
    summary: "Overbooking notifications, €0 reservations, stale OTA calendars, sync errors.",
    keywords: ["troubleshooting", "error", "overbooking", "zero price", "sync failed", "not updating", "stale"],
    blocks: [
      {
        type: "table",
        headers: ["Symptom", "Cause & fix"],
        rows: [
          [
            "\"No bed assigned to this channel\"",
            "A bed-mode channel without a bed. Edit the channel and pick a bed, or use room-type mode.",
          ],
          [
            "OVERBOOKING notification",
            "A booking arrived with no free bed. Free a bed (move or cancel something) and press Sync again — the event is retried on every sync until it fits.",
          ],
          [
            "Reservation shows €0",
            "Expected: iCal doesn't carry prices. Open the reservation and set the rate in Payment & Folio.",
          ],
          [
            "OTA still shows dates open after a direct booking",
            "OTAs poll your Export URL on their own schedule (up to ~12h). The URL itself is always current — open it in a browser to verify.",
          ],
          [
            "Sync error / red status on the channel",
            "The OTA feed URL is wrong or expired. Re-copy the iCal URL from the OTA and update the channel.",
          ],
          [
            "Booking.com dorm won't sync",
            "Booking.com has no iCal for multi-unit room types. Use per-bed listings where possible, or wait for the API/aggregator integration.",
          ],
        ],
      },
    ],
  },
];
