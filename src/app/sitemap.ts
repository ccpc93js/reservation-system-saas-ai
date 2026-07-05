import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hostmagsmart.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/en/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/en/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/demo`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
}
