import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live demo",
  description:
    "Try HostMagSmart free — a live, no-signup demo of the hostel PMS: reservations, tape calendar, channel manager, guest check-in and analytics.",
  alternates: { canonical: "/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
