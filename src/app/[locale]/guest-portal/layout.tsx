import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guest Check-In | Reservation System",
  description: "Complete your check-in online",
};

export default function GuestPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {children}
    </div>
  );
}
