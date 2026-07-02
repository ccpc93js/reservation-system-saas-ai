"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, Search, History, RefreshCw, Trash2, Pencil, X, ChevronDown, AlertTriangle } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { getGuestBookLimit, PLAN_NAMES } from "@/lib/plan";

const DOC_TYPE_VALUES = ["passport", "national_id", "drivers_license"] as const;
const SERVICE_TYPE_VALUES = ["prenociste", "hostel", "privatni_smestaj", "hotel", "other"] as const;

const DOC_LABELS: Record<string, string> = {
  passport: "Passport",
  national_id: "National ID",
  drivers_license: "Driver's License",
};

const SERVICE_LABELS: Record<string, string> = {
  prenociste: "Accommodation",
  hostel: "Hostel",
  privatni_smestaj: "Private Accommodation",
  hotel: "Hotel",
  other: "Other",
};

function fmtDate(val: string | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString();
}

function fmtDateTime(val: string | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleString();
}

function toDateInputValue(val: string | null | undefined) {
  if (!val) return "";
  return val.slice(0, 10);
}

function toDateTimeInputValue(val: string | null | undefined) {
  if (!val) return "";
  return new Date(val).toISOString().slice(0, 16);
}

function exportCSV(records: any[], orgName: string) {
  const headers = [
    "Reservation #", "Last Name", "First Name", "Date of Birth",
    "Citizenship", "Place of Birth", "Country of Birth",
    "ID Type", "ID Number", "Date of Issue", "Place of Issue", "Date of Expiry",
    "JMBG", "Service Type",
    "Room", "Bed", "Check-In Date", "Check-Out Date",
    "Arrival (Actual)", "Departure (Actual)",
    "Total Amount", "Amount Paid", "Currency",
  ];

  const rows = records.map((r) => [
    r.reservation_number ?? "",
    r.last_name ?? "",
    r.first_name ?? "",
    r.date_of_birth ?? "",
    r.nationality ?? "",
    r.place_of_birth ?? "",
    r.country_of_birth ?? "",
    DOC_LABELS[r.document_type] ?? r.document_type ?? "",
    r.document_number ?? "",
    r.document_issued_date ?? "",
    r.document_issued_place ?? "",
    r.document_expiry ?? "",
    r.jmbg ?? "",
    SERVICE_LABELS[r.service_type] ?? r.service_type ?? "",
    r.room_name ?? "",
    r.bed_name ?? "",
    r.check_in ?? "",
    r.check_out ?? "",
    r.actual_check_in_at ? new Date(r.actual_check_in_at).toLocaleString() : "",
    r.actual_check_out_at ? new Date(r.actual_check_out_at).toLocaleString() : "",
    r.total_amount ?? "",
    r.paid_amount ?? "",
    r.payment_currency ?? "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`));

  const csv = [headers.map((h) => `"${h}"`), ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `guest-book-${orgName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  records: any[];
  orgName: string;
  orgCurrency: string;
  orgId: string;
  orgPlan: string;
}

type EditForm = {
  first_name: string; last_name: string; date_of_birth: string;
  nationality: string; country_of_birth: string; place_of_birth: string;
  document_type: string; document_number: string; document_issued_date: string;
  document_issued_place: string; document_expiry: string; jmbg: string;
  service_type: string; room_name: string; bed_name: string;
  check_in: string; check_out: string;
  actual_check_in_at: string; actual_check_out_at: string;
};

function recordToForm(r: any): EditForm {
  return {
    first_name: r.first_name ?? "",
    last_name: r.last_name ?? "",
    date_of_birth: toDateInputValue(r.date_of_birth),
    nationality: r.nationality ?? "",
    country_of_birth: r.country_of_birth ?? "",
    place_of_birth: r.place_of_birth ?? "",
    document_type: r.document_type ?? "",
    document_number: r.document_number ?? "",
    document_issued_date: toDateInputValue(r.document_issued_date),
    document_issued_place: r.document_issued_place ?? "",
    document_expiry: toDateInputValue(r.document_expiry),
    jmbg: r.jmbg ?? "",
    service_type: r.service_type ?? "",
    room_name: r.room_name ?? "",
    bed_name: r.bed_name ?? "",
    check_in: toDateInputValue(r.check_in),
    check_out: toDateInputValue(r.check_out),
    actual_check_in_at: toDateTimeInputValue(r.actual_check_in_at),
    actual_check_out_at: toDateTimeInputValue(r.actual_check_out_at),
  };
}

export default function CheckinHistoryClient({ records, orgName, orgCurrency, orgId, orgPlan }: Props) {
  const t = useTranslations("checkinHistory");
  const docTypeLabel = (v: string) => DOC_TYPE_VALUES.includes(v as any) ? t(`docType_${v}`) : v;
  const serviceTypeLabel = (v: string) => SERVICE_TYPE_VALUES.includes(v as any) ? t(`serviceType_${v}`) : v;
  const guestBookLimit = getGuestBookLimit(orgPlan);
  const planName = PLAN_NAMES[orgPlan as keyof typeof PLAN_NAMES] ?? orgPlan;
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [localRecords, setLocalRecords] = useState(records);
  const [removing, setRemoving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNationalityDropdown, setShowNationalityDropdown] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [nationalityPos, setNationalityPos] = useState({ top: 0, left: 0, width: 0 });
  const [showCountryOfBirthDropdown, setShowCountryOfBirthDropdown] = useState(false);
  const [countryOfBirthSearch, setCountryOfBirthSearch] = useState("");
  const [countryOfBirthPos, setCountryOfBirthPos] = useState({ top: 0, left: 0, width: 0 });
  const nationalityBtnRef = useRef<HTMLButtonElement>(null);
  const nationalityDropRef = useRef<HTMLDivElement>(null);
  const countryOfBirthBtnRef = useRef<HTMLButtonElement>(null);
  const countryOfBirthDropRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filteredNationalities = COUNTRIES.filter(c => c.toLowerCase().includes(nationalitySearch.toLowerCase()));
  const filteredCountriesOfBirth = COUNTRIES.filter(c => c.toLowerCase().includes(countryOfBirthSearch.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showNationalityDropdown && !nationalityDropRef.current?.contains(e.target as Node) && !nationalityBtnRef.current?.contains(e.target as Node)) {
        setShowNationalityDropdown(false);
      }
      if (showCountryOfBirthDropdown && !countryOfBirthDropRef.current?.contains(e.target as Node) && !countryOfBirthBtnRef.current?.contains(e.target as Node)) {
        setShowCountryOfBirthDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNationalityDropdown, showCountryOfBirthDropdown]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const supabase = createBrowserClient();
      const { data } = await (supabase as any)
        .from("checkin_registry")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (data) setLocalRecords(data);
    } finally {
      setRefreshing(false);
    }
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setEditForm(recordToForm(r));
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setShowNationalityDropdown(false);
    setShowCountryOfBirthDropdown(false);
  };

  const openNationalityDropdown = () => {
    const rect = nationalityBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = 240;
    const top = spaceBelow < dropH ? rect.top - dropH - 4 : rect.bottom + 4;
    setNationalityPos({ top, left: rect.left, width: rect.width });
    setNationalitySearch("");
    setShowNationalityDropdown(true);
  };

  const openCountryOfBirthDropdown = () => {
    const rect = countryOfBirthBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = 240;
    const top = spaceBelow < dropH ? rect.top - dropH - 4 : rect.bottom + 4;
    setCountryOfBirthPos({ top, left: rect.left, width: rect.width });
    setCountryOfBirthSearch("");
    setShowCountryOfBirthDropdown(true);
  };

  const handleSave = async () => {
    if (!editingId || !editForm) return;
    setSaving(true);
    try {
      const body: Record<string, any> = { ...editForm };
      // Normalize: empty string → null for dates and timestamps
      for (const key of ["date_of_birth", "document_issued_date", "document_expiry", "check_in", "check_out"]) {
        if (!body[key]) body[key] = null;
      }
      for (const key of ["actual_check_in_at", "actual_check_out_at"]) {
        body[key] = body[key] ? new Date(body[key]).toISOString() : null;
      }
      const res = await fetch(`/api/checkin-registry/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? t("toastSaveFailed"));
        return;
      }
      setLocalRecords((prev) =>
        prev.map((r) => (r.id === editingId ? { ...r, ...body } : r))
      );
      closeEdit();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm(t("confirmRemove"))) return;
    setRemoving(id);
    try {
      const res = await fetch(`/api/checkin-registry/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLocalRecords((prev) => prev.filter((r) => r.id !== id));
      } else {
        const { error } = await res.json();
        alert(error ?? t("toastRemoveFailed"));
      }
    } finally {
      setRemoving(null);
    }
  };

  const set = (field: keyof EditForm, val: string) =>
    setEditForm((prev) => prev ? { ...prev, [field]: val } : prev);

  const filtered = localRecords.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      `${r.first_name ?? ""} ${r.last_name ?? ""}`.toLowerCase().includes(q) ||
      (r.document_number ?? "").toLowerCase().includes(q) ||
      (r.jmbg ?? "").toLowerCase().includes(q) ||
      (r.reservation_number ?? "").toLowerCase().includes(q)
    );
  });

  const inputCls = "w-full rounded-lg border border-border bg-surface text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";
  const labelCls = "block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5";

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("guestsRegistered", { count: filtered.length })}
              {guestBookLimit !== -1 && (
                <span className={`ml-2 font-medium ${localRecords.length >= guestBookLimit ? "text-red-500" : localRecords.length >= guestBookLimit * 0.8 ? "text-amber-500" : ""}`}>
                  · {localRecords.length}/{guestBookLimit} ({planName})
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-border bg-background hover:bg-muted disabled:opacity-50 transition-all">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {t("refresh")}
          </button>
          <button onClick={() => exportCSV(filtered, orgName)} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
            style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
            <Download className="w-4 h-4" />
            {t("exportCsv")}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
      </div>

      {/* At-limit banner */}
      {guestBookLimit !== -1 && localRecords.length >= guestBookLimit && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t.rich("limitReached", {
            strong: (chunks) => <strong>{chunks}</strong>,
            current: localRecords.length,
            limit: guestBookLimit,
            plan: planName,
          })}</span>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <History className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">{t("noRecordsYet")}</p>
          <p className="text-xs text-muted-foreground">{t("noRecordsHint")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {[t("colReservationNumber"), t("colName"), t("colBirthDate"), t("colCitizenship"), t("colCountryOfBirth"),
                    t("colIdType"), t("colIdNumber"), t("colIssueDate"), t("colExpiryDate"),
                    t("colJmbg"), t("colService"), t("colRoomBed"), t("colArrival"), t("colDeparture"), ""].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const bedRoom = [r.room_name, r.bed_name].filter(Boolean).join(" · ") || "—";
                  return (
                    <tr key={r.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-primary/5 transition-colors`}>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{r.reservation_number ?? "—"}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{r.first_name} {r.last_name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(r.date_of_birth)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{r.nationality || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{r.country_of_birth || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{r.document_type ? docTypeLabel(r.document_type) : "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-foreground whitespace-nowrap">{r.document_number || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(r.document_issued_date)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(r.document_expiry)}</td>
                      <td className="px-3 py-2.5 font-mono text-foreground whitespace-nowrap">{r.jmbg || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{r.service_type ? serviceTypeLabel(r.service_type) : "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{bedRoom}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {r.actual_check_in_at ? fmtDateTime(r.actual_check_in_at) : fmtDate(r.check_in)}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {r.actual_check_out_at ? fmtDateTime(r.actual_check_out_at) : fmtDate(r.check_out)}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title={t("editRecordTitle")}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRemove(r.id)} disabled={removing === r.id}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                            title={t("removeFromGuestBookTitle")}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Dialog — portaled to body to escape parent transform context */}
      {editingId && editForm && typeof document !== "undefined" && createPortal((
        <>
          {/* Backdrop — separate so blur doesn't affect the modal itself */}
          <div className="fixed inset-0 z-[9998] bg-slate-900/50 backdrop-blur-md" onClick={closeEdit} />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("editEntryTitle")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{editForm.first_name} {editForm.last_name}</p>
              </div>
              <button onClick={closeEdit} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Personal Info */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("personalInformation")}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t("firstName")}</label>
                    <input className={inputCls} value={editForm.first_name} onChange={(e) => set("first_name", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("lastName")}</label>
                    <input className={inputCls} value={editForm.last_name} onChange={(e) => set("last_name", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("dateOfBirth")}</label>
                    <input type="date" className={inputCls} value={editForm.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("citizenship")}</label>
                    <button ref={nationalityBtnRef} type="button" onClick={openNationalityDropdown}
                      className={`${inputCls} flex items-center justify-between text-left`}>
                      <span className={editForm.nationality ? "text-foreground" : "text-muted-foreground"}>
                        {editForm.nationality || t("selectPlaceholder")}
                      </span>
                      <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                    </button>
                  </div>
                  <div>
                    <label className={labelCls}>{t("countryOfBirth")}</label>
                    <button ref={countryOfBirthBtnRef} type="button" onClick={openCountryOfBirthDropdown}
                      className={`${inputCls} flex items-center justify-between text-left`}>
                      <span className={editForm.country_of_birth ? "text-foreground" : "text-muted-foreground"}>
                        {editForm.country_of_birth || t("selectPlaceholder")}
                      </span>
                      <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                    </button>
                  </div>
                  <div>
                    <label className={labelCls}>{t("placeOfBirth")}</label>
                    <input className={inputCls} value={editForm.place_of_birth} onChange={(e) => set("place_of_birth", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Document */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("identityDocument")}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t("documentType")}</label>
                    <select className={inputCls} value={editForm.document_type} onChange={(e) => set("document_type", e.target.value)}>
                      <option value="">{t("selectPlaceholder")}</option>
                      {DOC_TYPE_VALUES.map((val) => (
                        <option key={val} value={val}>{t(`docType_${val}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{t("documentNumber")}</label>
                    <input className={inputCls} value={editForm.document_number} onChange={(e) => set("document_number", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("issueDate")}</label>
                    <input type="date" className={inputCls} value={editForm.document_issued_date} onChange={(e) => set("document_issued_date", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("placeOfIssue")}</label>
                    <input className={inputCls} value={editForm.document_issued_place} onChange={(e) => set("document_issued_place", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("expiryDate")}</label>
                    <input type="date" className={inputCls} value={editForm.document_expiry} onChange={(e) => set("document_expiry", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("jmbg")}</label>
                    <input className={inputCls} value={editForm.jmbg} onChange={(e) => set("jmbg", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Stay */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("stayDetails")}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t("serviceType")}</label>
                    <select className={inputCls} value={editForm.service_type} onChange={(e) => set("service_type", e.target.value)}>
                      <option value="">{t("selectPlaceholder")}</option>
                      {SERVICE_TYPE_VALUES.map((val) => (
                        <option key={val} value={val}>{t(`serviceType_${val}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{t("room")}</label>
                    <input className={inputCls} value={editForm.room_name} onChange={(e) => set("room_name", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("bed")}</label>
                    <input className={inputCls} value={editForm.bed_name} onChange={(e) => set("bed_name", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("checkInDate")}</label>
                    <input type="date" className={inputCls} value={editForm.check_in} onChange={(e) => set("check_in", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("checkOutDate")}</label>
                    <input type="date" className={inputCls} value={editForm.check_out} onChange={(e) => set("check_out", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("actualArrival")}</label>
                    <input type="datetime-local" className={inputCls} value={editForm.actual_check_in_at} onChange={(e) => set("actual_check_in_at", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("actualDeparture")}</label>
                    <input type="datetime-local" className={inputCls} value={editForm.actual_check_out_at} onChange={(e) => set("actual_check_out_at", e.target.value)} />
                  </div>
                </div>
              </div>
            </div> {/* scroll area */}

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
              <button onClick={closeEdit}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-surface hover:bg-muted text-foreground transition-colors">
                {t("cancel")}
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? t("savingEllipsis") : t("saveChanges")}
              </button>
            </div>
          </div>
          </div> {/* positioning wrapper */}
        </>
      ), document.body)}

      {/* Nationality searchable dropdown — portaled to escape overflow clipping */}
      {showNationalityDropdown && typeof document !== "undefined" && createPortal(
        <div ref={nationalityDropRef}
          style={{ position: "fixed", top: nationalityPos.top, left: nationalityPos.left, width: nationalityPos.width, zIndex: 10000 }}
          className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input autoFocus value={nationalitySearch} onChange={(e) => setNationalitySearch(e.target.value)}
              placeholder={t("searchCountry")} className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredNationalities.map((c) => (
              <button key={c} type="button"
                onClick={() => { set("nationality", c); setShowNationalityDropdown(false); setNationalitySearch(""); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${editForm?.nationality === c ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-primary/10"}`}>
                {c}
              </button>
            ))}
            {filteredNationalities.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">{t("noResults")}</p>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Country of Birth searchable dropdown — portaled to escape overflow clipping */}
      {showCountryOfBirthDropdown && typeof document !== "undefined" && createPortal(
        <div ref={countryOfBirthDropRef}
          style={{ position: "fixed", top: countryOfBirthPos.top, left: countryOfBirthPos.left, width: countryOfBirthPos.width, zIndex: 10000 }}
          className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input autoFocus value={countryOfBirthSearch} onChange={(e) => setCountryOfBirthSearch(e.target.value)}
              placeholder={t("searchCountry")} className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredCountriesOfBirth.map((c) => (
              <button key={c} type="button"
                onClick={() => { set("country_of_birth", c); setShowCountryOfBirthDropdown(false); setCountryOfBirthSearch(""); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${editForm?.country_of_birth === c ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-primary/10"}`}>
                {c}
              </button>
            ))}
            {filteredCountriesOfBirth.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">{t("noResults")}</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
