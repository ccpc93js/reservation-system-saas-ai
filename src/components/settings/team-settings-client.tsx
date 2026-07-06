"use client";

import { useEffect, useState } from "react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { UserPlus, Trash2, Mail, Clock, X } from "lucide-react";

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
  owner: "bg-[#E0EADB] text-[#4A6740]",
  manager: "bg-[#DDE7F0] text-[#3A5F82]",
  admin: "bg-[#DDE7F0] text-[#3A5F82]",
  staff: "bg-[#E8E2D4] text-[#6F6857]",
};

export default function TeamSettingsClient({ userRole }: Props) {
  const t = useTranslations("settings.team");
  const isAdmin = ["owner", "manager", "admin"].includes(userRole);
  const isDemo = typeof window !== "undefined" && window.location.pathname.startsWith("/demo-hostel");
  const initials = (email: string) => email.split("@")[0].slice(0, 2).toUpperCase();
  const monthYear = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", year: "numeric" });
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
      toast.error(t("toastLoadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail) { toast.error(t("toastEmailRequired")); return; }
    setInviting(true);
    try {
      const res = await fetch("/api/settings/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("toastInviteSent", { email: inviteEmail }));
      setInviteEmail("");
      setShowInvite(false);
      load();
    } catch (err: any) {
      toast.error(err.message || t("toastInviteFailed"));
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
      toast.success(t("toastRoleUpdated"));
    } catch (err: any) {
      toast.error(err.message || t("toastRoleUpdateFailed"));
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (!(await confirmDialog(t("confirmRemove", { email })))) return;
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/settings/team/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast.success(t("toastRemoved"));
    } catch (err: any) {
      toast.error(err.message || t("toastRemoveFailed"));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold" style={{ color: "hsl(var(--text))" }}>{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("memberCount", { count: members.length })}
            {invitations.length > 0 && ` · ${t("pendingInviteCount", { count: invitations.length })}`}
          </p>
        </div>
        {isAdmin && !isDemo && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> {t("inviteMember")}
          </button>
        )}
        {isDemo && (
          <span className="text-xs text-muted-foreground">
            {t("invitesDisabledDemo")}{" "}
            <a href="/signup" className="text-primary hover:underline font-medium">{t("createFreeAccount")}</a>
          </span>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("inviteFormTitle")}</h3>
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
              {ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {inviting ? t("sending") : t("send")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t("inviteExpiryHint")}</p>
        </div>
      )}

      {/* Members list */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("membersHeading")}</p>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("loading")}</div>
        ) : members.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("noMembersYet")}</div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                  {initials(m.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{m.email.split("@")[0]}</span>
                    {m.is_self && <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">You</span>}
                  </div>
                  <span className="text-xs text-muted-foreground truncate block">
                    {m.email} · {t("joined", { date: monthYear(m.created_at) })}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && !m.is_self ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                      className="text-xs rounded-lg border border-border bg-background text-foreground px-2 py-1 focus:outline-none"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[m.role] ?? roleColor.staff}`}>
                      {t(`role_${m.role}`)}
                    </span>
                  )}
                  {isAdmin && !m.is_self && (
                    <button
                      onClick={() => handleRemove(m.user_id, m.email)}
                      disabled={removingId === m.user_id}
                      className="p-1.5 rounded-lg hover:bg-[#EEDCD5] transition-colors disabled:opacity-50"
                      title={t("removeMemberTitle")}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#9C4A37]" />
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
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("pendingInvitationsHeading")}</p>
          </div>
          <div className="divide-y divide-border">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-[#F0E6CD] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-[#8A6A16]" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{inv.email}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {t("expires", { date: new Date(inv.expires_at).toLocaleDateString() })}
                    </span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[inv.role] ?? roleColor.staff}`}>
                  {t(`role_${inv.role}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
