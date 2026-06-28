"use client";

import { useState } from "react";
import { Plus, RefreshCw, Trash2, Edit, Copy, Check, ExternalLink, Wifi, WifiOff, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = [
  { value: "booking_com", label: "Booking.com", color: "#003580" },
  { value: "airbnb", label: "Airbnb", color: "#FF5A5F" },
  { value: "vrbo", label: "VRBO", color: "#195FBA" },
  { value: "expedia", label: "Expedia", color: "#FFC72C" },
  { value: "hostelworld", label: "Hostelworld", color: "#F06400" },
  { value: "direct", label: "Direct", color: "#10b981" },
  { value: "other", label: "Other", color: "#6366f1" },
];

const getPlatform = (value: string) =>
  PLATFORMS.find((p) => p.value === value) ?? PLATFORMS[PLATFORMS.length - 1];

interface Channel {
  id: string;
  name: string;
  platform: string;
  ical_url: string | null;
  export_token: string;
  color: string;
  is_active: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  sync_count: number;
  bed_id: string | null;
  beds: { id: string; name: string; rooms: { id: string; name: string } | null } | null;
}

interface Bed {
  id: string;
  name: string;
  rooms: { id: string; name: string } | null;
}

interface Props {
  initialChannels: Channel[];
  beds: Bed[];
  orgId: string;
}

const emptyPlatformForm = { platform: "booking_com", ical_url: "", name: "" };

export default function ChannelsClient({ initialChannels, beds, orgId }: Props) {
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  // addingToBed: bedId that has the inline add form open
  const [addingToBed, setAddingToBed] = useState<string | null>(null);
  const [platformForm, setPlatformForm] = useState(emptyPlatformForm);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedBeds, setCollapsedBeds] = useState<Set<string>>(new Set());

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const formatSynced = (date: string | null) => {
    if (!date) return "Never";
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(date).toLocaleDateString();
  };

  const toggleBed = (bedId: string) => {
    setCollapsedBeds((prev) => {
      const next = new Set(prev);
      next.has(bedId) ? next.delete(bedId) : next.add(bedId);
      return next;
    });
  };

  const handleAddPlatform = async (bedId: string) => {
    if (!platformForm.ical_url) { toast.error("iCal URL required"); return; }
    const bed = beds.find((b) => b.id === bedId);
    const platform = getPlatform(platformForm.platform);
    const name = platformForm.name || `${bed?.name} – ${platform.label}`;

    setIsSaving(true);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          platform: platformForm.platform,
          ical_url: platformForm.ical_url,
          bed_id: bedId,
          color: platform.color,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannels((prev) => [data.channel, ...prev]);
      setAddingToBed(null);
      setPlatformForm(emptyPlatformForm);
      toast.success("Channel added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add channel");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateChannel = async () => {
    if (!editingChannel) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/channels/${editingChannel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingChannel.name,
          ical_url: editingChannel.ical_url,
          is_active: editingChannel.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannels((prev) => prev.map((c) => c.id === editingChannel.id ? { ...c, ...data.channel } : c));
      setEditingChannel(null);
      toast.success("Channel updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/channels/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const { created, updated, cancelled } = data.results;
      toast.success(`Synced: ${created} new, ${updated} updated, ${cancelled} cancelled`);
      setChannels((prev) => prev.map((c) => c.id === id ? { ...c, last_synced_at: new Date().toISOString(), last_error: null } : c));
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
      setChannels((prev) => prev.map((c) => c.id === id ? { ...c, last_error: err.message } : c));
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch("/api/channels/sync-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const total = data.results.reduce(
        (acc: any, r: any) => ({ created: acc.created + (r.created || 0), updated: acc.updated + (r.updated || 0), cancelled: acc.cancelled + (r.cancelled || 0) }),
        { created: 0, updated: 0, cancelled: 0 }
      );
      const failed = data.results.filter((r: any) => !r.success).length;
      const msg = `All synced: ${total.created} new, ${total.updated} updated, ${total.cancelled} cancelled${failed ? ` (${failed} failed)` : ""}`;
      failed ? toast.warning(msg) : toast.success(msg);
      setChannels((prev) => prev.map((c) => ({ ...c, last_synced_at: new Date().toISOString() })));
    } catch (err: any) {
      toast.error(err.message || "Sync all failed");
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this channel? Synced reservations lose their channel reference.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setChannels((prev) => prev.filter((c) => c.id !== id));
      toast.success("Channel deleted");
    } catch {
      toast.error("Failed to delete channel");
    } finally {
      setDeletingId(null);
    }
  };

  const copyExportUrl = (ch: Channel) => {
    navigator.clipboard.writeText(`${origin}/api/channels/export/${ch.export_token}`);
    setCopiedId(ch.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Export URL copied");
  };

  // Group channels by bed_id
  const channelsByBed = channels.reduce<Record<string, Channel[]>>((acc, ch) => {
    const key = ch.bed_id || "unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(ch);
    return acc;
  }, {});

  // Beds that have channels + unassigned
  const bedsWithChannels = beds.filter((b) => channelsByBed[b.id]);
  const bedsWithout = beds.filter((b) => !channelsByBed[b.id]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "hsl(var(--text))" }}>Channel Manager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {channels.length} connection{channels.length !== 1 ? "s" : ""} across {bedsWithChannels.length} bed{bedsWithChannels.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncingAll || channels.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncingAll ? "animate-spin" : ""}`} />
          {syncingAll ? "Syncing..." : "Sync All"}
        </button>
      </div>

      {/* Beds with channels */}
      {bedsWithChannels.length === 0 && bedsWithout.length === 0 && (
        <div className="text-center py-16 rounded-xl border border-dashed border-border">
          <Wifi className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">No beds found</p>
          <p className="text-xs text-muted-foreground mt-1">Add rooms and beds first, then connect OTA channels here</p>
        </div>
      )}

      <div className="space-y-3">
        {/* Connected beds */}
        {bedsWithChannels.map((bed) => {
          const bedChannels = channelsByBed[bed.id] || [];
          const collapsed = collapsedBeds.has(bed.id);

          return (
            <div key={bed.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              {/* Bed header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleBed(bed.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold" style={{ color: "hsl(var(--text))" }}>
                      {bed.rooms?.name ? `${bed.rooms.name}` : ""} <span className="text-muted-foreground">/ {bed.name}</span>
                    </span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {bedChannels.map((ch) => {
                        const p = getPlatform(ch.platform);
                        return (
                          <span key={ch.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: p.color + "22", color: p.color }}>
                            {p.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{bedChannels.length} platform{bedChannels.length !== 1 ? "s" : ""}</span>
                  {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {!collapsed && (
                <div className="border-t border-border divide-y divide-border">
                  {/* Platform rows */}
                  {bedChannels.map((ch) => {
                    const platform = getPlatform(ch.platform);
                    const isSyncing = syncingId === ch.id;
                    const isEditing = editingChannel?.id === ch.id;

                    return (
                      <div key={ch.id} className="px-4 py-3 bg-background/50">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                value={editingChannel.name}
                                onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                                placeholder="Channel name"
                                className="flex-1 rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                              />
                              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editingChannel.is_active}
                                  onChange={(e) => setEditingChannel({ ...editingChannel, is_active: e.target.checked })}
                                />
                                Active
                              </label>
                            </div>
                            <input
                              value={editingChannel.ical_url || ""}
                              onChange={(e) => setEditingChannel({ ...editingChannel, ical_url: e.target.value })}
                              placeholder="iCal URL"
                              className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingChannel(null)} className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted">Cancel</button>
                              <button onClick={handleUpdateChannel} disabled={isSaving} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                                {isSaving ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: platform.color + "22", color: platform.color }}>
                              {platform.label}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-foreground font-medium truncate">{ch.name}</span>
                                {!ch.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">Inactive</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  {ch.last_error ? <WifiOff className="w-3 h-3 text-red-500" /> : <Wifi className="w-3 h-3 text-emerald-500" />}
                                  {formatSynced(ch.last_synced_at)}
                                  {ch.sync_count > 0 && ` (${ch.sync_count}×)`}
                                </span>
                                {ch.ical_url && (
                                  <a href={ch.ical_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                                    <ExternalLink className="w-2.5 h-2.5" /> Feed
                                  </a>
                                )}
                                <button onClick={() => copyExportUrl(ch)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
                                  {copiedId === ch.id ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                                  Export URL
                                </button>
                              </div>
                              {ch.last_error && <p className="text-[10px] text-red-500 mt-0.5 truncate">{ch.last_error}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {ch.ical_url && (
                                <button onClick={() => handleSync(ch.id)} disabled={isSyncing} title="Sync" className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-50 transition-colors">
                                  <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isSyncing ? "animate-spin" : ""}`} />
                                </button>
                              )}
                              <button onClick={() => setEditingChannel(ch)} title="Edit" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                              <button onClick={() => handleDelete(ch.id)} disabled={deletingId === ch.id} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add platform to this bed */}
                  {addingToBed === bed.id ? (
                    <div className="px-4 py-3 bg-muted/20 space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={platformForm.platform}
                          onChange={(e) => setPlatformForm((f) => ({ ...f, platform: e.target.value }))}
                          className="rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                        >
                          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        <input
                          value={platformForm.name}
                          onChange={(e) => setPlatformForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Name (optional)"
                          className="flex-1 rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                        />
                      </div>
                      <input
                        value={platformForm.ical_url}
                        onChange={(e) => setPlatformForm((f) => ({ ...f, ical_url: e.target.value }))}
                        placeholder="iCal URL from OTA (required)"
                        className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setAddingToBed(null); setPlatformForm(emptyPlatformForm); }} className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted">Cancel</button>
                        <button onClick={() => handleAddPlatform(bed.id)} disabled={isSaving} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                          {isSaving ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingToBed(bed.id); setPlatformForm(emptyPlatformForm); }}
                      className="w-full px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add platform
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Beds without channels */}
        {bedsWithout.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Beds without OTA connections</p>
            {bedsWithout.map((bed) => (
              <div key={bed.id} className="rounded-xl border border-dashed border-border bg-surface/50 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {bed.rooms?.name ? `${bed.rooms.name} / ` : ""}{bed.name}
                  </span>
                  {addingToBed !== bed.id && (
                    <button
                      onClick={() => { setAddingToBed(bed.id); setPlatformForm(emptyPlatformForm); }}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Connect OTA
                    </button>
                  )}
                </div>
                {addingToBed === bed.id && (
                  <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-2">
                    <div className="flex gap-2">
                      <select value={platformForm.platform} onChange={(e) => setPlatformForm((f) => ({ ...f, platform: e.target.value }))} className="rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20">
                        {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                      <input value={platformForm.name} onChange={(e) => setPlatformForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name (optional)" className="flex-1 rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
                    </div>
                    <input value={platformForm.ical_url} onChange={(e) => setPlatformForm((f) => ({ ...f, ical_url: e.target.value }))} placeholder="iCal URL from OTA (required)" className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setAddingToBed(null); setPlatformForm(emptyPlatformForm); }} className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted">Cancel</button>
                      <button onClick={() => handleAddPlatform(bed.id)} disabled={isSaving} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{isSaving ? "Adding..." : "Add"}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
