"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Hotel } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-8">
        {/* Logo/Branding */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Hotel className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">HostelHub PMS</h2>
            <p className="text-xs text-slate-500">Hostel Management System</p>
          </div>
        </div>

        {/* Form Title */}
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Welcome back</h3>
        <p className="text-sm text-slate-500 mb-6">Sign in to manage your property operations.</p>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-600 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@hostel.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-600 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" className="rounded border-slate-300 text-indigo-600" />
              Remember me
            </label>
            <a href="#" className="text-indigo-600 hover:underline">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 mt-2"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
