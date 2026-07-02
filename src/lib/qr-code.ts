// QR Code generation utility for guest portal links
// Uses QR Server API (free, no dependencies)

import { getSiteOrigin } from "./site-url";

export function generateQRCodeUrl(token: string, baseUrl: string = ""): string {
  const url = `${baseUrl || getSiteOrigin()}/guest-portal/${token}`;

  // Use QR Server API (free, no auth required)
  const encodedUrl = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedUrl}`;
}

export function generateGuestPortalLink(
  token: string,
  baseUrl: string = ""
): string {
  return `${baseUrl || getSiteOrigin()}/guest-portal/${token}`;
}
