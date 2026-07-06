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
  { id: "getting-started", label: "Getting Started" },
  { id: "calendar", label: "Calendar & Bookings" },
  { id: "reservations", label: "Reservations" },
  { id: "check-in", label: "Check-in & Guest Book" },
  { id: "guests", label: "Guests" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "channel-manager", label: "Channel Manager" },
  { id: "settings", label: "Settings & Billing" },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // ── Getting started ────────────────────────────────────────────────────
  {
    slug: "setup-property-structure",
    category: "getting-started",
    title: "Set up your property: room types, rooms and beds",
    summary: "The three-level inventory model and the order to create things in.",
    keywords: ["setup", "room type", "room", "bed", "dorm", "private", "inventory", "structure", "onboarding"],
    blocks: [
      { type: "p", text: "The app models your property in three levels. Create them top-down in **Room Inventory**:" },
      {
        type: "steps",
        items: [
          "**Room type** — the category you sell: \"6-Bed Mixed Dorm\", \"Private Double\". Set type (dorm/private), capacity and base price.",
          "**Room** — a physical space belonging to a room type: \"Room 100\", floor, notes.",
          "**Bed** — the bookable unit inside a room: \"101\", \"102\"… Position controls the order on the calendar.",
        ],
      },
      { type: "p", text: "Every reservation books **beds**. A private room is simply a room with one bed. Dorm beds are sold interchangeably — the room-type level is what OTA channels can sell from as a pool." },
      { type: "callout", tone: "info", text: "Deactivating a bed (Is Active off) removes it from availability without deleting its history." },
    ],
  },
  {
    slug: "getting-started-navigation",
    category: "getting-started",
    title: "Where everything lives",
    summary: "A one-minute map of the sidebar sections.",
    keywords: ["navigation", "sidebar", "sections", "overview", "map", "where"],
    blocks: [
      {
        type: "table",
        headers: ["Section", "What you do there"],
        rows: [
          ["Dashboard", "Today's arrivals/departures, occupancy, key numbers at a glance"],
          ["Tape Calendar", "The bed × date grid — create and manage bookings visually"],
          ["Reservations", "Search and filter every reservation as a list"],
          ["Pending Check-ins", "Review and approve guests' online check-in submissions"],
          ["Guest Book", "The permanent check-in registry (one row per occupant) + CSV export"],
          ["Analytics", "Occupancy, revenue and channel performance over time"],
          ["Channel Manager", "Connect OTAs (Airbnb, Booking.com…) via iCal"],
          ["Guests", "Guest profiles, ID documents, duplicate merging"],
          ["Room Inventory", "Room types, rooms and beds"],
          ["Housekeeping", "Per-bed cleaning status board"],
          ["Settings", "Property branding, team members, billing plan"],
        ],
      },
    ],
  },

  // ── Calendar & bookings ────────────────────────────────────────────────
  {
    slug: "calendar-basics",
    category: "calendar",
    title: "Tape calendar basics",
    summary: "Reading the grid, creating a booking from a cell, editing a block.",
    keywords: ["tape", "calendar", "grid", "cell", "block", "create booking", "colors", "status", "past dates"],
    blocks: [
      { type: "p", text: "The tape calendar is a **bed × date** grid over a 60-day horizon. Each row is one bed; each colored block is one reservation on that bed." },
      {
        type: "list",
        items: [
          "**Click an empty cell** → opens the New Reservation drawer with that bed and date pre-filled.",
          "**Click a block** → opens the reservation drawer to edit it.",
          "**Grey cells** are past dates — locked, you can't create bookings there.",
          "Block colors follow status: confirmed (green), pending (amber), checked-in (blue), checked-out (grey).",
        ],
      },
      { type: "p", text: "A multi-bed reservation draws one block on each of its beds — same reservation number; clicking any of them opens the same reservation." },
      { type: "callout", tone: "info", text: "The bed-name column stays fixed while the dates scroll horizontally. Sync Channels (top right) pulls the latest OTA calendars." },
    ],
  },
  {
    slug: "calendar-multi-bed-booking",
    category: "calendar",
    title: "Book several beds in one reservation",
    summary: "Groups in a dorm: quantity stepper, specific beds, whole room.",
    keywords: ["multi-bed", "group", "several beds", "whole room", "quantity", "dorm booking"],
    blocks: [
      { type: "steps", items: [
        "Click an empty cell on any bed of the dorm — the drawer opens with that bed as the anchor.",
        "Pick the **check-out date** first. Bed selection stays locked until a valid stay is set, because availability depends on the dates.",
        "Use the **− n +** stepper to auto-assign that many free beds, tick specific beds in the list, or press **Whole room**.",
        "Beds already booked for those dates show as *Booked* and can't be selected.",
        "Fill in the guest and rate — the total shows **nights × rate × beds** — and save.",
      ] },
      { type: "p", text: "The result is ONE reservation with one confirmation number covering all selected beds. The guest capacity of the reservation equals its bed count." },
      { type: "callout", tone: "info", text: "Need to grow or shrink the booking later? Open it and use the Beds section — see \"Add or remove beds on a reservation\"." },
    ],
  },

  // ── Reservations ───────────────────────────────────────────────────────
  {
    slug: "reservation-drawer",
    category: "reservations",
    title: "Manage a reservation",
    summary: "The reservation drawer: dates, status, guests, beds, payment, check-out, cancel.",
    keywords: ["reservation", "drawer", "edit", "status", "dates", "cancel", "delete", "check out", "extend"],
    blocks: [
      { type: "p", text: "Open a reservation from the calendar or the Reservations list. The drawer contains everything about the stay:" },
      {
        type: "list",
        items: [
          "**Edit Dates** — move the whole stay; every bed on the reservation is checked for conflicts before saving.",
          "**Status** — pending → confirmed → checked-in → checked-out. Checking in requires an assigned guest and a settled balance.",
          "**Guest / Additional guests** — the lead guest plus companions (see the dedicated article).",
          "**Beds** — the beds this reservation occupies; add or remove without rebooking.",
          "**Extend Stay** — appends nights at a rate you set; extends every bed of the reservation.",
          "**Payment & Folio** — rates, totals, deposits, balance (see the folio article).",
          "**Danger zone** — cancel (keeps the record, frees the beds) or delete (removes it entirely).",
        ],
      },
      { type: "callout", tone: "warning", text: "Cancel vs delete: cancelling keeps history and the guest link; deleting erases the reservation and its items permanently." },
    ],
  },
  {
    slug: "reservation-companions",
    category: "reservations",
    title: "Add guests to a reservation (companions)",
    summary: "Lead guest vs companions, capacity, editing and creating guests inline.",
    keywords: ["companion", "additional guests", "group", "lead guest", "primary", "capacity", "add guest"],
    blocks: [
      { type: "p", text: "Every reservation has a **lead guest** (billing/email contact) and can have **additional guests** — real guest records with their own documents, required for the Guest Book." },
      { type: "steps", items: [
        "Open the reservation → **Additional guests** → **Add guest**.",
        "Search an existing guest, or press **Create new guest** if they're not in the system yet — the new guest attaches automatically.",
        "Use the pencil on any companion to edit their details/documents; the trash icon removes them from the reservation.",
      ] },
      { type: "p", text: "Capacity is **one guest per booked bed** — the counter shows e.g. (3/4). When full, add another bed first or remove someone." },
      { type: "callout", tone: "info", text: "Changing the lead guest (Guest → Change) keeps companions untouched; the old lead does not become a companion automatically." },
    ],
  },
  {
    slug: "reservation-beds",
    category: "reservations",
    title: "Add or remove beds on a reservation",
    summary: "Grow a booking into more beds of the same room, or release beds.",
    keywords: ["add bed", "remove bed", "more beds", "same room", "resize booking"],
    blocks: [
      { type: "steps", items: [
        "Open the reservation → **Beds** section → **Add bed**.",
        "Pick from the free beds of the same room for the reservation's dates (taken beds are shown disabled).",
        "The bed inherits the reservation's dates and nightly rate; the total recalculates automatically.",
      ] },
      { type: "list", items: [
        "A reservation always keeps **at least one bed**.",
        "You can't drop beds below the number of attached guests — remove a guest first.",
        "Beds must be in the same room as the booking; for another room, create a separate reservation.",
      ] },
    ],
  },
  {
    slug: "reservation-folio",
    category: "reservations",
    title: "Payment & Folio",
    summary: "How segments, rates, extensions, deposits and balance work.",
    keywords: ["payment", "folio", "rate", "price", "balance", "deposit", "paid", "total", "extension", "currency"],
    blocks: [
      { type: "p", text: "The folio shows one line per **stay segment** (a date range). All beds sharing the same dates sit on one line, displayed as **(3n × 4 beds)**; a stay extension gets its own *Extension* line." },
      {
        type: "list",
        items: [
          "Edit the **rate** directly on a segment — it applies to every bed in that segment and recalculates the total live.",
          "**Total charged** = Σ rate × nights × beds across segments.",
          "Record **Amount paid**, an optional **deposit** (with its own currency) and the **payment method**; the balance line turns green when settled.",
          "**Payment Confirmed** marks the money as verified — required before check-in when there's a balance.",
        ],
      },
      { type: "callout", tone: "info", text: "OTA reservations arrive with rate 0 (iCal carries no prices) — set the real rate here after sync." },
    ],
  },

  // ── Check-in & Guest Book ──────────────────────────────────────────────
  {
    slug: "checkin-online-link",
    category: "check-in",
    title: "Online check-in link & QR code",
    summary: "Let guests submit their details and ID photos before arrival.",
    keywords: ["online check-in", "self check-in", "link", "qr", "guest portal", "id photos", "before arrival"],
    blocks: [
      { type: "p", text: "Every reservation has a unique **Guest Check-In Link** (also embedded as a QR code in the confirmation email). The guest opens it on their phone, fills in their personal/document details and uploads ID photos — no account needed." },
      { type: "steps", items: [
        "Send the link: it's included automatically in the confirmation email, or copy it from the reservation drawer (Show QR Code to display it at the desk).",
        "The guest submits the form before or at arrival.",
        "The submission appears in **Pending Check-ins** for staff review.",
      ] },
    ],
  },
  {
    slug: "checkin-pending-review",
    category: "check-in",
    title: "Review pending check-ins",
    summary: "Approve or reject guest-submitted check-in data.",
    keywords: ["pending", "approve", "reject", "review", "verification", "submissions"],
    blocks: [
      { type: "steps", items: [
        "Open **Pending Check-ins** — each card is one guest submission with their details and ID photos.",
        "**Approve** — the data is written to the guest profile and the reservation is marked verified.",
        "**Reject** — discards the submission; the guest can submit again through the same link.",
      ] },
      { type: "callout", tone: "info", text: "Approving does not change the reservation status — check the guest in from the reservation drawer as usual." },
    ],
  },
  {
    slug: "guest-book-registry",
    category: "check-in",
    title: "Guest Book: the permanent check-in registry",
    summary: "One row per occupant, legal compliance (Serbia), CSV export, plan limits.",
    keywords: ["guest book", "registry", "knjiga gostiju", "eturista", "police", "serbia", "csv", "export", "occupant", "legal"],
    blocks: [
      { type: "p", text: "The Guest Book is an **append-only registry**: a permanent snapshot of every person who stayed, taken at registration time. Later edits to guests or reservations never rewrite it." },
      {
        type: "list",
        items: [
          "**One row per occupant** — lead guest and every companion each get their own entry with their identity and document data (as Serbian knjiga gostiju / eTurista require).",
          "Press **Add to Guest Book** on the reservation. If you add a companion later, the button re-activates and registers only the missing person.",
          "Financial amounts appear only on the lead guest's row so exports don't double-count.",
          "**CSV export** from the Guest Book page for police/tax reporting.",
        ],
      },
      { type: "callout", tone: "warning", text: "Plan limits count Guest Book entries per person. Serbia-specific fields (JMBG, service type) only appear for properties whose country is Serbia." },
    ],
  },

  // ── Guests ─────────────────────────────────────────────────────────────
  {
    slug: "guests-profiles-documents",
    category: "guests",
    title: "Guest profiles, ID scanning and documents",
    summary: "Create guests, scan IDs with the camera, store document photos.",
    keywords: ["guest", "profile", "document", "passport", "id card", "scan", "ocr", "camera", "upload"],
    blocks: [
      { type: "list", items: [
        "**Guests** holds every guest profile: personal data, document details, residence and stored document photos.",
        "**Scan ID** — photograph the front (and back) of a passport/ID card and the fields are extracted automatically; review and save.",
        "Document photos stay attached to the profile and are reused for the Guest Book snapshot.",
        "Guests are also created inline while booking (new-guest tab) or when an OTA reservation syncs in.",
      ] },
    ],
  },
  {
    slug: "guests-duplicates",
    category: "guests",
    title: "Merge duplicate guests",
    summary: "What happens when a guest already exists, and how field-by-field merge works.",
    keywords: ["duplicate", "merge", "same guest", "already exists", "conflict"],
    blocks: [
      { type: "p", text: "When you save a guest whose email or document matches an existing profile, the **Merge Duplicate Guests** dialog opens instead of creating a copy." },
      { type: "steps", items: [
        "For each conflicting field, choose which value to keep (new vs existing).",
        "Documents from both profiles are combined.",
        "The merged profile keeps all reservation history; the duplicate is removed.",
      ] },
    ],
  },

  // ── Housekeeping ───────────────────────────────────────────────────────
  {
    slug: "housekeeping-board",
    category: "housekeeping",
    title: "Housekeeping board",
    summary: "Per-bed cleaning statuses, auto-dirty on checkout, live updates.",
    keywords: ["housekeeping", "cleaning", "dirty", "clean", "out of order", "status", "board"],
    blocks: [
      { type: "list", items: [
        "Every bed has a housekeeping status: **clean**, **dirty** or **out of order** — shown as a board grouped by room.",
        "Checking a reservation out marks its beds **dirty automatically**.",
        "Tap a bed to cycle/set its status; changes appear live for everyone (no refresh needed).",
        "Dirty and out-of-order beds show a warning icon next to the bed name on the tape calendar.",
      ] },
    ],
  },

  // ── Settings & billing ─────────────────────────────────────────────────
  {
    slug: "settings-property-branding",
    category: "settings",
    title: "Property settings & branding",
    summary: "Property details, theme color, logo, and how emails use them.",
    keywords: ["settings", "branding", "logo", "theme", "color", "property name", "emails", "country"],
    blocks: [
      { type: "list", items: [
        "**Property** settings hold the name, address, country, contact email, check-in/out times and currency.",
        "Pick a **theme color** (with live palette preview) and upload a **logo** — both are applied across the app.",
        "Guest emails (confirmations, check-in, checkout) are branded with your property name and logo, and replies go to your property email.",
        "The **country** matters: Serbia enables the legally required extra fields (JMBG, service type, police registry format).",
      ] },
    ],
  },
  {
    slug: "settings-team-roles",
    category: "settings",
    title: "Team members & roles",
    summary: "Invite staff and understand owner / manager / staff permissions.",
    keywords: ["team", "invite", "roles", "owner", "manager", "staff", "permissions", "members"],
    blocks: [
      { type: "steps", items: [
        "Settings → **Team** → **Invite member** — enter their email and pick a role.",
        "They receive an email invitation (valid for a limited time) and join your property on acceptance.",
      ] },
      {
        type: "table",
        headers: ["Role", "Can do"],
        rows: [
          ["Owner", "Everything, including billing and deleting the property"],
          ["Manager", "Day-to-day management + team administration"],
          ["Staff", "Operational work: bookings, check-ins, guests, housekeeping"],
        ],
      },
    ],
  },
  {
    slug: "settings-billing-plans",
    category: "settings",
    title: "Billing & plans",
    summary: "What the plans limit, upgrading, and how payment works.",
    keywords: ["billing", "plan", "upgrade", "subscription", "stripe", "limits", "pro", "free", "payment"],
    blocks: [
      { type: "list", items: [
        "Settings → **Billing** shows your current plan and lets you upgrade — payment is handled securely by Stripe.",
        "Plans limit things like the number of **beds**, **Guest Book entries** (counted per person) and access to the **Channel Manager**.",
        "When you hit a limit the app tells you exactly what to upgrade; nothing is deleted.",
        "After paying, the plan activates automatically; if it ever looks stuck, reload once — the app re-checks your subscription on every load.",
      ] },
    ],
  },

  // ── Channel manager ────────────────────────────────────────────────────
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
