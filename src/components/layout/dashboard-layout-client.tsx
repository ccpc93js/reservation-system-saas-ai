"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./sidebar";
import Header from "./header";

interface DashboardLayoutClientProps {
  org: { id: string; name: string; slug: string };
  userRole: string;
  user?: { email?: string };
  children: React.ReactNode;
}

export default function DashboardLayoutClient({
  org,
  userRole,
  user,
  children,
}: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
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
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? "ml-72" : ""}`}>
        <Header
          org={org}
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto p-6 pt-0 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
