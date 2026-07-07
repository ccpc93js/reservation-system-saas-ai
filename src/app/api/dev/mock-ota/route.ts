// Dev-only mock OTA iCal feed.
//
// Emits calendars that replicate the REAL feed formats of each platform
// (per their public documentation / well-known feed shapes):
//   - Airbnb:      "Reserved - HMXXXXXXXX" summaries (confirmation code, no
//                  guest name), DESCRIPTION with reservation URL + phone last
//                  4, owner blocks as "Airbnb (Not available)".
//   - Booking.com: "CLOSED - Not available" for everything, no guest data.
//   - VRBO:        "Reserved - {Guest Name}" (includes the name).
//
// Point a channel's iCal URL at this endpoint and press Sync to exercise the
// full pipeline. UIDs are deterministic (seed + index) so re-syncs test
// idempotency, `shift` tests date-change reassignment, `drop` tests orphan
// cancellation, `cancelled` tests STATUS:CANCELLED handling.
//
// Query params:
//   platform  = airbnb | booking_com | vrbo        (default airbnb)
//   events    = number of bookings                 (default 2, max 20)
//   nights    = nights per booking                 (default 2)
//   start     = days from today of first check-in  (default 7)
//   gap       = days between consecutive bookings  (default 0 → same dates,
//               use 0 with events>beds to force OVERBOOKING)
//   seed      = string namespace for UIDs          (default "demo")
//   shift     = shift ALL event dates by N days (same UIDs → update path)
//   drop      = 1 → omit the first event (orphan → cancellation path)
//   cancelled = 1 → first event carries STATUS:CANCELLED
//   block     = 1 → append an owner "Not available" block (Airbnb style)
//
// Disabled in production unless ALLOW_MOCK_OTA=true.

const GUEST_NAMES = [
  "Emma Johnson", "Liam Smith", "Sofia García", "Noah Müller", "Olivia Rossi",
  "Lucas Dubois", "Mia Novak", "Ethan Brown", "Ana Petrović", "Jan Kowalski",
  "Yuki Tanaka", "Carlos Mendes", "Nina Ivanova", "Tom Anders", "Lea Fischer",
  "Marco Bianchi", "Sara Lindqvist", "David Kim", "Julia Weber", "Alex Costa",
];

function pad(n: number) { return String(n).padStart(2, "0"); }
function icsDate(d: Date) { return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }

// Deterministic pseudo-code from seed+index (stable HM codes / uids).
function hmCode(seed: string, i: number) {
  let h = 0;
  const s = `${seed}-${i}`;
  for (let c = 0; c < s.length; c++) h = (h * 31 + s.charCodeAt(c)) >>> 0;
  return h.toString(36).toUpperCase().padStart(8, "0").slice(0, 8);
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_OTA !== "true") {
    return new Response("Not found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") || "airbnb";
  const events = Math.min(20, Math.max(0, parseInt(searchParams.get("events") || "2")));
  const nights = Math.max(1, parseInt(searchParams.get("nights") || "2"));
  const start = parseInt(searchParams.get("start") || "7");
  const gap = Math.max(0, parseInt(searchParams.get("gap") || "0"));
  const seed = searchParams.get("seed") || "demo";
  const shift = parseInt(searchParams.get("shift") || "0");
  const drop = searchParams.get("drop") === "1";
  const cancelled = searchParams.get("cancelled") === "1";
  const block = searchParams.get("block") === "1";

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const prodId =
    platform === "booking_com" ? "-//Booking.com//iCal Export//EN"
    : platform === "vrbo" ? "-//HomeAway.com, Inc.//EN"
    : "-//Airbnb Inc//Hosting Calendar 1.0//EN";

  const uidDomain =
    platform === "booking_com" ? "booking.com"
    : platform === "vrbo" ? "homeaway.com"
    : "airbnb.com";

  const now = new Date();
  const dtstamp = `${icsDate(now)}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "VERSION:2.0",
  ];

  for (let i = 0; i < events; i++) {
    if (drop && i === 0) continue; // simulate the OTA removing a booking

    const checkIn = addDays(today, start + i * gap + shift);
    const checkOut = addDays(checkIn, nights);
    const code = hmCode(seed, i);
    const guestName = GUEST_NAMES[i % GUEST_NAMES.length];

    let summary: string;
    let description: string | null = null;
    if (platform === "booking_com") {
      // Booking.com's iCal is opaque: same summary for bookings and closures.
      summary = "CLOSED - Not available";
    } else if (platform === "vrbo") {
      summary = `Reserved - ${guestName}`;
      description = `Reservation ID: ${code}`;
    } else {
      // Airbnb: confirmation code only, guest details behind the URL.
      summary = `Reserved - HM${code}`;
      description = `Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM${code}\\nPhone Number (Last 4 Digits): ${(1000 + (i * 37) % 9000)}`;
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(checkIn)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(checkOut)}`);
    lines.push(`UID:${seed}-${i}-${code.toLowerCase()}@${uidDomain}`);
    lines.push(`SUMMARY:${summary}`);
    if (description) lines.push(`DESCRIPTION:${description}`);
    if (cancelled && i === 0) lines.push("STATUS:CANCELLED");
    lines.push("END:VEVENT");
  }

  if (block && platform !== "booking_com") {
    // Owner-blocked dates (not a reservation) — Airbnb emits these too.
    const bStart = addDays(today, start + 30);
    lines.push("BEGIN:VEVENT");
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(bStart)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(addDays(bStart, 3))}`);
    lines.push(`UID:${seed}-block@${uidDomain}`);
    lines.push(`SUMMARY:${platform === "vrbo" ? "Blocked" : "Airbnb (Not available)"}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
