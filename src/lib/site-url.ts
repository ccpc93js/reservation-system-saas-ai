// Canonical site origin, used anywhere the app needs to build an absolute URL
// (emails, QR codes, Stripe redirect URLs, internal API calls). Vercel env
// vars are plain strings ("hostmagsmart.com"), not full URLs, so this always
// normalizes to a scheme instead of assuming callers set NEXT_PUBLIC_SITE_URL
// with "https://" already.
export function getSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (raw) {
    return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
