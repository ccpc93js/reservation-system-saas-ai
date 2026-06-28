"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, LogIn } from "lucide-react";

interface Invitation {
  email: string;
  role: string;
  organizations: { name: string; slug: string };
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "accepting" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invitations/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setErrorMsg(data.error); setStatus("error"); }
        else { setInvitation(data.invitation); setStatus("ready"); }
      })
      .catch(() => { setErrorMsg("Failed to load invitation"); setStatus("error"); });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setStatus("accepting");
    const res = await fetch(`/api/invitations/${token}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setStatus("success");
      // Redirect to org dashboard — server resolved the slug
      const slug = data.slug;
      setTimeout(() => router.push(slug ? `/${slug}/dashboard` : "/dashboard"), 2000);
    } else if (res.status === 401) {
      // Not logged in — redirect to login with return URL
      router.push(`/login?redirect=/invite/${token}`);
    } else {
      setErrorMsg(data.error || "Failed to accept");
      setStatus("error");
    }
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
            Go to Dashboard
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
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">You're invited!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Join <strong>{(invitation as any)?.organizations?.name ?? "a property"}</strong> as <strong>{invitation?.role}</strong>
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

        <p className="text-xs text-muted-foreground text-center">
          You must be signed in with <strong>{invitation?.email}</strong> to accept this invitation.
        </p>

        <button
          onClick={handleAccept}
          disabled={status === "accepting"}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {status === "accepting" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {status === "accepting" ? "Accepting..." : "Accept Invitation"}
        </button>
      </div>
    </div>
  );
}
