import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in or create your account",
  description:
    "Sign in to HostMagSmart or create a free account to manage your hostel — reservations, channel manager, guest check-in and analytics.",
  alternates: { canonical: "/en/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
