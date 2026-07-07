"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

interface Invitation {
  email: string;
  role: string;
  organizations: { name: string; slug: string };
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [existingUser, setExistingUser] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "working" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Set-password form
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/invitations/${token}`);
        const data = await res.json();
        if (data.error) { setErrorMsg(data.error); setStatus("error"); return; }
        setInvitation(data.invitation);
        setExistingUser(!!data.existingUser);
        // Detect an existing session so we can offer one-click accept.
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        setSessionEmail(user?.email ?? null);
        setStatus("ready");
      } catch {
        setErrorMsg("Failed to load invitation");
        setStatus("error");
      }
    })();
  }, [token]);

  const orgName = (invitation as any)?.organizations?.name ?? "a property";
  const emailMatches = sessionEmail && invitation && sessionEmail.toLowerCase() === invitation.email.toLowerCase();

  // Already signed in with the matching email → just join.
  const handleAccept = async () => {
    if (!token) return;
    setStatus("working");
    const res = await fetch(`/api/invitations/${token}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setStatus("success");
      setTimeout(() => router.push(data.slug ? `/${data.slug}/dashboard` : "/dashboard"), 1500);
    } else if (res.status === 401) {
      router.push(`/login?redirect=/invite/${token}`);
    } else {
      setErrorMsg(data.error || "Failed to accept");
      setStatus("error");
    }
  };

  // New member → create account with a password, then sign in.
  const handleRegister = async () => {
    if (!token) return;
    setFormError("");
    if (password.length < 8) { setFormError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setFormError("Passwords don't match"); return; }

    setStatus("working");
    const res = await fetch(`/api/invitations/${token}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, firstName: firstName.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === "account_exists") {
        setExistingUser(true);
        setStatus("ready");
        setFormError("An account already exists — please sign in to accept.");
        return;
      }
      setErrorMsg(data.error || "Failed to create account");
      setStatus("error");
      return;
    }
    // Sign in with the new credentials, then go to the dashboard.
    const supabase = createBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password });
    setStatus("success");
    setTimeout(() => {
      if (signInError) router.push(`/login?redirect=/${data.slug}/dashboard`);
      else router.push(data.slug ? `/${data.slug}/dashboard` : "/dashboard");
    }, 1500);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-8 text-center space-y-4">
          <XCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Invitation Invalid</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <button onClick={() => router.push("/")}
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Go home
          </button>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Welcome to the team!</h1>
          <p className="text-sm text-muted-foreground">Taking you to the dashboard…</p>
        </div>
      </div>
    );
  }

  const busy = status === "working";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            {emailMatches ? <LogIn className="w-8 h-8 text-primary" /> : <UserPlus className="w-8 h-8 text-primary" />}
          </div>
          <h1 className="text-2xl font-bold text-foreground">You&apos;re invited!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Join <strong>{orgName}</strong> as <strong className="capitalize">{invitation?.role}</strong>
          </p>
        </div>

        <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invitation for</span>
            <span className="font-medium text-foreground">{invitation?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium text-foreground capitalize">{invitation?.role}</span>
          </div>
        </div>

        {/* Branch 1: signed in with the matching email → one-click accept */}
        {emailMatches && (
          <button
            onClick={handleAccept}
            disabled={busy}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? "Joining…" : "Accept & Join"}
          </button>
        )}

        {/* Branch 2: signed in with a DIFFERENT email */}
        {sessionEmail && !emailMatches && (
          <div className="space-y-3">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
              You&apos;re signed in as <strong>{sessionEmail}</strong>, but this invite is for{" "}
              <strong>{invitation?.email}</strong>.
            </p>
            <button
              onClick={async () => { await createBrowserClient().auth.signOut(); router.push(`/login?redirect=/invite/${token}`); }}
              className="w-full py-3 border border-border rounded-xl font-medium text-sm text-foreground hover:bg-muted transition-colors"
            >
              Sign in with {invitation?.email}
            </button>
          </div>
        )}

        {/* Branch 3: not signed in, account already exists → sign in */}
        {!sessionEmail && existingUser && (
          <div className="space-y-3">
            {formError && <p className="text-xs text-red-600 text-center">{formError}</p>}
            <p className="text-xs text-muted-foreground text-center">
              You already have an account. Sign in to accept this invitation.
            </p>
            <button
              onClick={() => router.push(`/login?redirect=/invite/${token}`)}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Sign in to accept
            </button>
          </div>
        )}

        {/* Branch 4: not signed in, new account → set a password */}
        {!sessionEmail && !existingUser && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Set a password to create your account and join.</p>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name (optional)"
              className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 8 characters)"
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <button
              onClick={handleRegister}
              disabled={busy}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? "Creating account…" : "Create account & Join"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
