import { redirect } from "next/navigation";
import CheckInForm from "@/components/guest-portal/check-in-form";

interface GuestPortalPageProps {
  params: {
    token: string;
  };
}

export default async function GuestPortalPage({
  params,
}: GuestPortalPageProps) {
  const { token } = params;

  if (!token) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <CheckInForm token={token} />
    </div>
  );
}
