import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Server Actions reject requests whose Origin header isn't in this list.
// Derive the production host from the same env vars used elsewhere for the
// canonical site origin, so this doesn't need a hardcoded domain per deploy.
const allowedOrigins = ["localhost:3000"];
if (process.env.NEXT_PUBLIC_SITE_URL) {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  allowedOrigins.push(new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).host);
}
if (process.env.VERCEL_URL) {
  allowedOrigins.push(process.env.VERCEL_URL);
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-ical", "node-forge"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default withNextIntl(nextConfig);
