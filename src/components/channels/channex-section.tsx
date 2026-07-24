"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, RefreshCw, Wifi, Trash2, X, Server } from "lucide-react";

// OTAs connectable via the Channex API. Brand names stay untranslated.
const OTAS = [
  { value: "booking_com", label: "Booking.com", color: "#003580" },
  { value: "hostelworld", label: "Hostelworld", color: "#F06400" },
  { value: "expedia", label: "Expedia", color: "#FFC72C" },
];

export interface ChannexChannel {
  id: string;
  name: string;
  platform: string;
  hotel_id: string | null;
  channex_status: string | null;
  color: string;
}

interface RoomType {
  id: string;
  name: string;
}

// mapping_details room/rate shape (OTA side).
interface OtaRate {
  id: number;
  title: string;
  pricing?: string;
  max_persons?: number;
}
interface OtaRoom {
  id: number;
  title: string;
  rates: OtaRate[];
}
interface RatePlanOpt {
  id: string;
  title: string;
  room_type_id: string;
  occupancy: number;
}

interface Props {
  orgId: string;
  initialChannexChannels: ChannexChannel[];
  roomTypes: RoomType[];
}

type WizardStep = "hotel" | "mapping";

export default function ChannexSection({ initialChannexChannels, roomTypes }: Props) {
  const t = useTranslations("channels");
  const [channels, setChannels] = useState<ChannexChannel[]>(initialChannexChannels);
  const [provisioning, setProvisioning] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Connect wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("hotel");
  const [platform, setPlatform] = useState("booking_com");
  const [hotelId, setHotelId] = useState("");
  const [title, setTitle] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [otaRooms, setOtaRooms] = useState<OtaRoom[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlanOpt[]>([]);
  // mapping: key `${roomId}:${rateId}` -> our rate plan id ("" = unmapped)
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);

  const otaLabel = (v: string) => OTAS.find((o) => o.value === v)?.label ?? v;

  const runProvision = async () => {
    setProvisioning(true);
    try {
      const res = await fetch("/api/channels/channex/provision", { method: "POST" });
      const data = await res.json();
      if (!res.ok && !data.ok) throw new Error(data.error || t("channex.toastProvisionFailed"));
      const created = (data.rows ?? []).filter((r: any) => r.action === "created").length;
      const updated = (data.rows ?? []).filter((r: any) => r.action === "updated").length;
      toast.success(t("channex.toastProvisioned", { created, updated }));
    } catch (err: any) {
      toast.error(err.message || t("channex.toastProvisionFailed"));
    } finally {
      setProvisioning(false);
    }
  };

  const runSyncAvailability = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/channels/channex/push-availability", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("channex.toastSyncFailed"));
      toast.success(t("channex.toastAvailabilitySynced"));
    } catch (err: any) {
      toast.error(err.message || t("channex.toastSyncFailed"));
    } finally {
      setSyncing(false);
    }
  };

  const openWizard = () => {
    setStep("hotel");
    setPlatform("booking_com");
    setHotelId("");
    setTitle("");
    setOtaRooms([]);
    setRatePlans([]);
    setMapping({});
    setWizardOpen(true);
  };

  const fetchOptions = async () => {
    if (!hotelId.trim()) { toast.error(t("channex.toastHotelIdRequired")); return; }
    setLoadingOptions(true);
    try {
      const res = await fetch("/api/channels/channex/connect/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, hotel_id: hotelId.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || t("channex.toastValidateFailed"));
      setOtaRooms(data.otaRooms ?? []);
      setRatePlans(data.ratePlans ?? []);
      if (!title) setTitle(`${otaLabel(platform)} — ${hotelId.trim()}`);
      setStep("mapping");
    } catch (err: any) {
      toast.error(err.message || t("channex.toastValidateFailed"));
    } finally {
      setLoadingOptions(false);
    }
  };

  const submitConnect = async () => {
    const mappings = Object.entries(mapping)
      .filter(([, rpId]) => rpId)
      .map(([key, ratePlanId]) => {
        const [roomTypeCode, ratePlanCode] = key.split(":").map(Number);
        return { ratePlanId, roomTypeCode, ratePlanCode };
      });
    if (mappings.length === 0) { toast.error(t("channex.toastNoMappings")); return; }

    setConnecting(true);
    try {
      const res = await fetch("/api/channels/channex/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, hotel_id: hotelId.trim(), title: title.trim() || otaLabel(platform), mappings }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || t("channex.toastConnectFailed"));
      setChannels((prev) => [
        { id: data.channelRowId, name: title.trim() || otaLabel(platform), platform, hotel_id: hotelId.trim(), channex_status: data.status, color: OTAS.find((o) => o.value === platform)?.color ?? "#6366f1" },
        ...prev,
      ]);
      setWizardOpen(false);
      toast.success(t("channex.toastConnected"));
    } catch (err: any) {
      toast.error(err.message || t("channex.toastConnectFailed"));
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async (ch: ChannexChannel) => {
    if (!(await confirmDialog(t("channex.confirmDisconnect")))) return;
    try {
      const res = await fetch(`/api/channels/channex/connect?id=${ch.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || t("channex.toastDisconnectFailed"));
      setChannels((prev) => prev.filter((c) => c.id !== ch.id));
      toast.success(t("channex.toastDisconnected"));
    } catch (err: any) {
      toast.error(err.message || t("channex.toastDisconnectFailed"));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" /> {t("channex.heading")}
          </p>
          <p className="text-[11px] text-muted-foreground px-1 mt-0.5">{t("channex.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runProvision}
            disabled={provisioning}
            title={t("channex.syncStructureHint")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${provisioning ? "animate-spin" : ""}`} /> {t("channex.syncStructure")}
          </button>
          <button
            onClick={runSyncAvailability}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <Wifi className={`w-3.5 h-3.5 ${syncing ? "animate-pulse" : ""}`} /> {t("channex.syncAvailability")}
          </button>
          <button
            onClick={openWizard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {t("channex.connectOta")}
          </button>
        </div>
      </div>

      {/* Connected channels */}
      {channels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">{t("channex.noneConnected")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <div key={ch.id} className="rounded-xl border border-border bg-surface px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: ch.color + "22", color: ch.color }}>
                  {otaLabel(ch.platform)}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{ch.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {t("channex.hotelIdLabel")}: {ch.hotel_id}
                    {ch.channex_status && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{ch.channex_status}</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => disconnect(ch)} title={t("channex.disconnect")} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Connect wizard */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setWizardOpen(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-serif text-lg font-semibold" style={{ color: "hsl(var(--text))" }}>{t("channex.connectTitle")}</h3>
              <button onClick={() => setWizardOpen(false)} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            {step === "hotel" ? (
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t("channex.otaLabel")}</label>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm">
                    {OTAS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t("channex.hotelIdLabel")}</label>
                  <input value={hotelId} onChange={(e) => setHotelId(e.target.value)} placeholder={t("channex.hotelIdPlaceholder")} className="mt-1 w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm" />
                  <p className="text-[10px] text-muted-foreground mt-1">{t("channex.extranetHint")}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setWizardOpen(false)} className="px-3 py-2 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted">{t("cancel")}</button>
                  <button onClick={fetchOptions} disabled={loadingOptions} className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    {loadingOptions ? t("channex.validating") : t("channex.validateContinue")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t("channex.connectionName")}</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm" />
                </div>
                <p className="text-xs text-muted-foreground">{t("channex.mappingHint")}</p>
                <div className="space-y-3">
                  {otaRooms.map((room) => (
                    <div key={room.id} className="rounded-lg border border-border overflow-hidden">
                      <div className="px-3 py-2 bg-muted/30 text-xs font-semibold text-foreground">{room.title} <span className="text-muted-foreground">#{room.id}</span></div>
                      <div className="divide-y divide-border">
                        {room.rates.map((rate) => {
                          const key = `${room.id}:${rate.id}`;
                          return (
                            <div key={key} className="px-3 py-2 flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-foreground truncate">{rate.title}</div>
                                <div className="text-[10px] text-muted-foreground">#{rate.id}{rate.max_persons ? ` · ${t("channex.maxPersons", { n: rate.max_persons })}` : ""}</div>
                              </div>
                              <span className="text-muted-foreground text-xs">→</span>
                              <select
                                value={mapping[key] ?? ""}
                                onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                                className="rounded-lg border border-border bg-background text-foreground px-2 py-1.5 text-xs max-w-[45%]"
                              >
                                <option value="">{t("channex.notMapped")}</option>
                                {ratePlans.map((rp) => {
                                  const rtName = roomTypes.find((r) => r.id === rp.room_type_id)?.name ?? "";
                                  return <option key={rp.id} value={rp.id}>{rtName} — {rp.title}</option>;
                                })}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between gap-2">
                  <button onClick={() => setStep("hotel")} className="px-3 py-2 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted">{t("channex.back")}</button>
                  <button onClick={submitConnect} disabled={connecting} className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    {connecting ? t("channex.connecting") : t("channex.connectActivate")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
