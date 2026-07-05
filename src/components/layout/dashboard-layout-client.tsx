"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Sidebar from "./sidebar";
import Header from "./header";

interface DashboardLayoutClientProps {
  org: { id: string; name: string; slug: string };
  userRole: string;
  user: User;
  pendingPlan?: string | null;
  children: React.ReactNode;
}

export default function DashboardLayoutClient({
  org,
  userRole,
  user,
  pendingPlan,
  children,
}: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pendingPlan && !pathname.includes("/settings/billing")) {
      router.replace(`/${org.slug}/settings/billing?required=true`);
    }
  }, [pendingPlan, pathname, org.slug, router]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[55] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        org={org}
        userRole={userRole}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area - shifts right when sidebar is open */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? "lg:ml-72" : ""}`}>
        <Header
          org={org}
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pt-0 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
