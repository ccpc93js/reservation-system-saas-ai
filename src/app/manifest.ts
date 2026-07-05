import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HostMagSmart — Hostel Management Software",
    short_name: "HostMagSmart",
    description: "Smart property-management software for independent hostels.",
    start_url: "/",
    display: "standalone",
    background_color: "#F3EEE2",
    theme_color: "#5F7048",
    icons: [
      { src: "/botanical/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
