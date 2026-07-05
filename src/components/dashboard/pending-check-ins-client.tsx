"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader,
  RefreshCw,
  Copy,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { generateGuestPortalLink, generateQRCodeUrl } from "@/lib/qr-code";

interface PendingCheckIn {
  id: string;
  check_in_token: string;
  reservation_number: string;
  check_in: string;
  submitted_at: string;
  guest: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  } | null;
  room: string;
  self_check_in_data: Record<string, any>;
  id_photos: Array<{ url: string; type: "front" | "back"; uploaded_at: string }>;
}

interface VerificationState {
  reservationId: string | null;
  isApproving: boolean;
  isRejecting: boolean;
  action: "approve" | "reject" | null;
  rejectionReason: string;
  customRejectionText: string;
  showQR: boolean;
}

const REJECTION_REASONS = [
  "ID illegible",
  "Expired document",
  "Doesn't match guest",
  "Name mismatch",
  "Other",
];

export default function PendingCheckInsClient() {
  const t = useTranslations("pendingCheckIns");
  const reasonLabels: Record<string, string> = {
    "ID illegible": t("reasons.idIllegible"),
    "Expired document": t("reasons.expiredDocument"),
    "Doesn't match guest": t("reasons.guestMismatch"),
    "Name mismatch": t("reasons.nameMismatch"),
    "Other": t("reasons.other"),
  };
  const timeAgo = (iso: string) => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };
  const initialsOf = (first?: string, last?: string) =>
    `${first?.charAt(0) ?? ""}${last?.charAt(0) ?? ""}`.toUpperCase() || "G";
  const [pending, setPending] = useState<PendingCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheckIn, setSelectedCheckIn] = useState<PendingCheckIn | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
  const [bulkRejectionReason, setBulkRejectionReason] = useState("");
  const [bulkCustomText, setBulkCustomText] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [verification, setVerification] = useState<VerificationState>({
    reservationId: null,
    isApproving: false,
    isRejecting: false,
    action: null,
    rejectionReason: "",
    customRejectionText: "",
    showQR: false,
  });

  // Fetch pending check-ins
  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/staff/check-in-pending");
      if (!res.ok) throw new Error(t("toasts.fetchFailed"));
      const result = await res.json();
      setPending(result.pending || []);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(error.message || t("toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map((p) => p.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkSubmitting(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/staff/reservations/${id}/verify-check-in`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verified: true }),
        });
      }
      toast.success(t("toasts.approvedCount", { count: selectedIds.size }));
      setSelectedIds(new Set());
      fetchPending();
    } catch (error: any) {
      toast.error(error.message || t("toasts.approveFailed"));
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkRejectionReason) {
      toast.error(t("toasts.selectReasonFirst"));
      return;
    }
    if (bulkRejectionReason === "Other" && !bulkCustomText) {
      toast.error(t("toasts.customReasonRequired"));
      return;
    }

    setBulkSubmitting(true);
    try {
      const finalReason =
        bulkRejectionReason === "Other"
          ? `Other: ${bulkCustomText}`
          : bulkRejectionReason;

      for (const id of selectedIds) {
        await fetch(`/api/staff/reservations/${id}/verify-check-in`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verified: false, rejection_reason: finalReason }),
        });
      }
      toast.success(t("toasts.rejectedCount", { count: selectedIds.size }));
      setSelectedIds(new Set());
      setBulkAction(null);
      setBulkRejectionReason("");
      setBulkCustomText("");
      fetchPending();
    } catch (error: any) {
      toast.error(error.message || t("toasts.rejectFailed"));
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleApprove = async (reservationId: string) => {
    try {
      setVerification((prev) => ({
        ...prev,
        reservationId,
        isApproving: true,
      }));

      const res = await fetch(
        `/api/staff/reservations/${reservationId}/verify-check-in`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verified: true }),
        }
      );

      if (!res.ok) throw new Error(t("toasts.approveOneFailed"));

      toast.success(t("toasts.approvedNotified"));
      setPending((prev) =>
        prev.filter((p) => p.id !== reservationId)
      );
      setSelectedCheckIn(null);
    } catch (error: any) {
      toast.error(error.message || t("toasts.approveOneFailed"));
    } finally {
      setVerification((prev) => ({
        ...prev,
        isApproving: false,
        reservationId: null,
      }));
    }
  };

  const handleReject = async (reservationId: string) => {
    if (!verification.rejectionReason) {
      toast.error(t("toasts.selectReasonFirst"));
      return;
    }

    if (verification.rejectionReason === "Other" && !verification.customRejectionText) {
      toast.error(t("toasts.customReasonRequired"));
      return;
    }

    try {
      setVerification((prev) => ({
        ...prev,
        isRejecting: true,
      }));

      const finalReason =
        verification.rejectionReason === "Other"
          ? `Other: ${verification.customRejectionText}`
          : verification.rejectionReason;

      const res = await fetch(
        `/api/staff/reservations/${reservationId}/verify-check-in`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verified: false,
            rejection_reason: finalReason,
          }),
        }
      );

      if (!res.ok) throw new Error(t("toasts.rejectOneFailed"));

      toast.success(t("toasts.rejectedResubmit"));
      setPending((prev) =>
        prev.filter((p) => p.id !== reservationId)
      );
      setSelectedCheckIn(null);
    } catch (error: any) {
      toast.error(error.message || t("toasts.rejectOneFailed"));
    } finally {
      setVerification((prev) => ({
        ...prev,
        isRejecting: false,
        rejectionReason: "",
        customRejectionText: "",
      }));
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">
                {t("title")}
              </h1>
              <p className="text-muted-foreground">
                {t("subtitle")}
              </p>
            </div>
            <button
              onClick={fetchPending}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface hover:bg-muted transition-colors disabled:opacity-50 shrink-0 text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {t("refresh")}
            </button>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-12 text-center">
            <CheckCircle className="w-12 h-12 text-[#4A6740] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("allCaughtUp")}
            </h2>
            <p className="text-muted-foreground mt-2">
              {t("noneToReview")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-foreground">
              {t("title")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="px-3 py-1.5 rounded-full bg-[#F0E6CD] text-[#8A6A16] text-xs font-semibold whitespace-nowrap">
              {t("waitingChip", { count: pending.length })}
            </span>
            <button
              onClick={fetchPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface hover:bg-muted transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              {t("refresh")}
            </button>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {t("selectedCount", { count: selectedIds.size })}
            </p>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={handleBulkApprove}
                disabled={bulkSubmitting}
                className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[#4A6740] hover:bg-[#3d5636] text-white rounded-lg text-sm whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkSubmitting ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {t("approveAll")}
              </button>
              <button
                onClick={() => setBulkAction("reject")}
                disabled={bulkSubmitting}
                className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[#9C4A37] hover:bg-[#853d2e] text-white rounded-lg text-sm whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4" />
                {t("rejectAll")}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 sm:px-4 py-2 border border-primary/20 text-foreground rounded-lg text-sm whitespace-nowrap hover:bg-primary/10 transition-colors"
              >
                {t("clear")}
              </button>
            </div>
          </div>
        )}

        {/* Pending table */}
        <div className="rounded-2xl border border-border overflow-hidden bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider">
                  <th className="px-6 py-3 font-semibold">{t("colGuest")}</th>
                  <th className="px-6 py-3 font-semibold">{t("colCheckIn")}</th>
                  <th className="px-6 py-3 font-semibold">{t("colRoom")}</th>
                  <th className="px-6 py-3 font-semibold">{t("colEmail")}</th>
                  <th className="px-6 py-3 font-semibold">{t("colSubmitted")}</th>
                  <th className="px-6 py-3 font-semibold text-right">{t("colAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pending.map((checkIn) => (
                  <tr key={checkIn.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(checkIn.id)}
                          onChange={() => toggleSelection(checkIn.id)}
                          className="w-4 h-4 cursor-pointer shrink-0 accent-[#5F7048]"
                        />
                        <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                          {initialsOf(checkIn.guest?.first_name, checkIn.guest?.last_name)}
                        </div>
                        <span className="font-medium text-foreground whitespace-nowrap">
                          {checkIn.guest?.first_name} {checkIn.guest?.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                      {new Date(checkIn.check_in).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                      {checkIn.room}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {checkIn.guest?.email || t("notAvailable")}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                      {timeAgo(checkIn.submitted_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedCheckIn(checkIn)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
                      >
                        {t("review")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      {selectedCheckIn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-lg shadow-xl max-w-2xl w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-surface border-b border-border p-6 flex items-center justify-between">
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                {t("verifyCheckIn")}
              </h2>
              <button
                onClick={() => setSelectedCheckIn(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8">
              {/* Guest Info */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {t("guestInformation")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-background p-4 rounded-lg break-words">
                  {Object.entries(selectedCheckIn.self_check_in_data).map(
                    ([key, value]) => (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground uppercase">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {String(value)}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* ID Photos */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {t("idPhotos")}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedCheckIn.id_photos.map((photo) => (
                    <div key={photo.type}>
                      <p className="text-sm font-medium text-foreground mb-2 capitalize">
                        {t("idPhotoOf", { type: photo.type })}
                      </p>
                      <a
                        href={photo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border border-border rounded-lg overflow-hidden hover:border-primary transition-colors"
                      >
                        <img
                          src={photo.url}
                          alt={`${photo.type} ID`}
                          className="w-full h-48 object-cover"
                        />
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guest Portal Link */}
              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {t("guestPortalLink")}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t("guestPortalLinkHint")}
                </p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generateGuestPortalLink(selectedCheckIn.check_in_token)}
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-muted-foreground"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          generateGuestPortalLink(selectedCheckIn.check_in_token)
                        );
                        toast.success(t("toasts.linkCopied"));
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/70 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      setVerification((prev) => ({
                        ...prev,
                        showQR: !prev.showQR,
                      }))
                    }
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-background transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    {verification.showQR ? t("hideQR") : t("showQR")}
                  </button>

                  {verification.showQR && (
                    <div className="p-4 bg-background rounded-lg flex justify-center">
                      <img
                        src={generateQRCodeUrl(selectedCheckIn.check_in_token)}
                        alt="Guest portal QR code"
                        className="w-48 h-48"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Actions */}
              <div className="border-t border-border pt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("verificationStatus")}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-background transition-colors">
                      <input
                        type="radio"
                        name="verification"
                        value="approve"
                        checked={verification.action === "approve"}
                        onChange={() =>
                          setVerification({
                            ...verification,
                            action: "approve",
                            rejectionReason: "",
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-foreground">
                        {t("approveCheckIn")}
                      </span>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-background transition-colors">
                      <input
                        type="radio"
                        name="verification"
                        value="reject"
                        checked={verification.action === "reject"}
                        onChange={() =>
                          setVerification({
                            ...verification,
                            action: "reject",
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-foreground">
                        {t("rejectCheckIn")}
                      </span>
                    </label>
                  </div>
                </div>

                {verification.action === "reject" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t("rejectionReason")} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={verification.rejectionReason}
                        onChange={(e) =>
                          setVerification({
                            ...verification,
                            rejectionReason: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">{t("selectReason")}</option>
                        {REJECTION_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reasonLabels[reason]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {verification.rejectionReason === "Other" && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          {t("details")} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={verification.customRejectionText}
                          onChange={(e) => {
                            setVerification({
                              ...verification,
                              customRejectionText: e.target.value,
                            });
                          }}
                          placeholder={t("detailsPlaceholder")}
                          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => setSelectedCheckIn(null)}
                  className="flex-1 px-4 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg transition-colors font-medium"
                >
                  {t("cancel")}
                </button>
                {verification.action === "approve" ? (
                  <button
                    onClick={() => handleApprove(selectedCheckIn.id)}
                    disabled={verification.isApproving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#4A6740] hover:bg-[#3d5636] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verification.isApproving ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {t("approve")}
                  </button>
                ) : verification.action === "reject" ? (
                  <button
                    onClick={() => handleReject(selectedCheckIn.id)}
                    disabled={
                      verification.isRejecting ||
                      !verification.rejectionReason ||
                      (verification.rejectionReason === "Other" &&
                        !verification.customRejectionText)
                    }
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#9C4A37] hover:bg-[#853d2e] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verification.isRejecting ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {t("reject")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Rejection Modal */}
      {bulkAction === "reject" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-lg shadow-xl max-w-md w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                {t("rejectNCheckIns", { count: selectedIds.size })}
              </h2>
              <button
                onClick={() => setBulkAction(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("rejectionReason")} <span className="text-red-500">*</span>
                </label>
                <select
                  value={bulkRejectionReason}
                  onChange={(e) => {
                    setBulkRejectionReason(e.target.value);
                    setBulkCustomText("");
                  }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">{t("selectReason")}</option>
                  {REJECTION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reasonLabels[reason]}
                    </option>
                  ))}
                </select>
              </div>

              {bulkRejectionReason === "Other" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("details")} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={bulkCustomText}
                    onChange={(e) => setBulkCustomText(e.target.value)}
                    placeholder={t("detailsPlaceholder")}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    rows={3}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setBulkAction(null)}
                  className="flex-1 px-4 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg transition-colors font-medium"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={
                    bulkSubmitting ||
                    !bulkRejectionReason ||
                    (bulkRejectionReason === "Other" && !bulkCustomText)
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#9C4A37] hover:bg-[#853d2e] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSubmitting ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {t("rejectAll")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
