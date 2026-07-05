import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HostMagSmart — Hostel Management Software";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Botanical branded social-share card, generated at request time.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F3EEE2",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#5F7048",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#F3EEE2",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            H
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#2A2823" }}>HostMagSmart</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, color: "#2A2823", lineHeight: 1.05, maxWidth: 900 }}>
            Run your hostel with calm.
          </div>
          <div style={{ fontSize: 30, color: "#5F5A4E", maxWidth: 860, lineHeight: 1.3 }}>
            Reservations, tape calendar, channel manager, guest check-in &amp; analytics — one clean PMS.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: "#5F7048" }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: "#5F7048" }} />
          hostmagsmart.com
        </div>
      </div>
    ),
    { ...size }
  );
}
