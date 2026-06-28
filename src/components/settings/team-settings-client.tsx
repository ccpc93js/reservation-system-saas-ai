"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2, Shield, User, Mail, Clock, X } from "lucide-react";

interface Member {
  id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  is_self: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

interface Props {
  orgId: string;
  userRole: string;
}

const ROLES = ["owner", "manager", "staff"];
const roleColor: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  admin: "bg-blue-100 text-blue-700",
  staff: "bg-gray-100 text-gray-600",
};

export default function TeamSettingsClient({ userRole }: Props) {
  const isAdmin = ["owner", "manager", "admin"].includes(userRole);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/team");
      const data = await res.json();
      setMembers(data.members ?? []);
      setInvitations(data.invitations ?? []);
    } catch {
      toast.error("Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail) { toast.error("Email required"); return; }
    setInviting(true);
    try {
      const res = await fetch("/api/settings/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setShowInvite(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const res = await fetch(`/api/settings/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, role } : m));
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (!confirm(`Remove ${email} from this organization?`)) return;
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/settings/team/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast.success("Member removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "hsl(var(--text))" }}>Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""}
            {invitations.length > 0 && ` · ${invitations.length} pending invite${invitations.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Invite Member
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Invite team member</h3>
            <button onClick={() => setShowInvite(false)} className="p-1 hover:bg-muted rounded">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@email.com"
              className="flex-1 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {inviting ? "Sending..." : "Send"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Invite link expires in 7 days. They must sign in with this email to accept.</p>
        </div>
      )}

      {/* Members list */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Members</p>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : members.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No members yet</div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{m.email}</span>
                    {m.is_self && <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">You</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Joined {new Date(m.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && !m.is_self ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                      className="text-xs rounded-lg border border-border bg-background text-foreground px-2 py-1 focus:outline-none"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[m.role] ?? roleColor.staff}`}>
                      {m.role}
                    </span>
                  )}
                  {isAdmin && !m.is_self && (
                    <button
                      onClick={() => handleRemove(m.user_id, m.email)}
                      disabled={removingId === m.user_id}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Remove member"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Invitations</p>
          </div>
          <div className="divide-y divide-border">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{inv.email}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[inv.role] ?? roleColor.staff}`}>
                  {inv.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
