"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
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
      if (!res.ok) throw new Error("Failed to fetch pending check-ins");
      const result = await res.json();
      setPending(result.pending || []);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to load pending check-ins");
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
      toast.success(`Approved ${selectedIds.size} check-in${selectedIds.size !== 1 ? "s" : ""}`);
      setSelectedIds(new Set());
      fetchPending();
    } catch (error: any) {
      toast.error(error.message || "Failed to approve check-ins");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkRejectionReason) {
      toast.error("Please select a rejection reason");
      return;
    }
    if (bulkRejectionReason === "Other" && !bulkCustomText) {
      toast.error("Please provide details for custom rejection reason");
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
      toast.success(`Rejected ${selectedIds.size} check-in${selectedIds.size !== 1 ? "s" : ""}`);
      setSelectedIds(new Set());
      setBulkAction(null);
      setBulkRejectionReason("");
      setBulkCustomText("");
      fetchPending();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject check-ins");
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

      if (!res.ok) throw new Error("Failed to approve check-in");

      toast.success("Check-in approved! Guest will be notified.");
      setPending((prev) =>
        prev.filter((p) => p.id !== reservationId)
      );
      setSelectedCheckIn(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to approve check-in");
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
      toast.error("Please select a rejection reason");
      return;
    }

    if (verification.rejectionReason === "Other" && !verification.customRejectionText) {
      toast.error("Please provide details for custom rejection reason");
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

      if (!res.ok) throw new Error("Failed to reject check-in");

      toast.success("Check-in rejected. Guest will be asked to resubmit.");
      setPending((prev) =>
        prev.filter((p) => p.id !== reservationId)
      );
      setSelectedCheckIn(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to reject check-in");
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
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Pending Check-Ins
          </h1>
          <p className="text-muted-foreground mb-8">
            Review and verify guest self-check-ins
          </p>

          <div className="bg-slate-50 border border-border rounded-lg p-12 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">
              All caught up!
            </h2>
            <p className="text-muted-foreground mt-2">
              No pending check-ins to review
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Pending Check-Ins
            </h1>
            <p className="text-muted-foreground mt-1">
              {pending.length} guest{pending.length !== 1 ? "s" : ""} waiting for
              verification
            </p>
          </div>
          <button
            onClick={fetchPending}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/70 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <p className="text-sm font-medium text-blue-900">
              {selectedIds.size} selected
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleBulkApprove}
                disabled={bulkSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkSubmitting ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Approve All
              </button>
              <button
                onClick={() => setBulkAction("reject")}
                disabled={bulkSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4" />
                Reject All
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 border border-blue-200 text-blue-900 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Pending list */}
        <div className="grid gap-4">
          {pending.map((checkIn) => (
            <div
              key={checkIn.id}
              className="bg-white border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(checkIn.id)}
                    onChange={() => toggleSelection(checkIn.id)}
                    className="w-5 h-5 mt-1 cursor-pointer"
                  />
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {checkIn.guest?.first_name} {checkIn.guest?.last_name}
                    </h3>
                    <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                      {checkIn.reservation_number}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Check-in</p>
                      <p className="font-medium text-foreground">
                        {new Date(checkIn.check_in).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Room</p>
                      <p className="font-medium text-foreground">
                        {checkIn.room}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium text-foreground">
                        {checkIn.guest?.email || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Submitted</p>
                      <p className="font-medium text-foreground">
                        {new Date(checkIn.submitted_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => setSelectedCheckIn(checkIn)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verification Modal */}
      {selectedCheckIn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-border p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">
                Verify Check-In
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
                  Guest Information
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
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
                  ID Photos
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedCheckIn.id_photos.map((photo) => (
                    <div key={photo.type}>
                      <p className="text-sm font-medium text-foreground mb-2 capitalize">
                        {photo.type} of ID
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
                  Guest Portal Link
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Share this link with the guest to complete check-in
                </p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generateGuestPortalLink(selectedCheckIn.check_in_token)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-border rounded-lg text-sm font-mono text-muted-foreground"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          generateGuestPortalLink(selectedCheckIn.check_in_token)
                        );
                        toast.success("Link copied!");
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
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    {verification.showQR ? "Hide" : "Show"} QR Code
                  </button>

                  {verification.showQR && (
                    <div className="p-4 bg-slate-50 rounded-lg flex justify-center">
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
                    Verification Status
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
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
                        ✓ Approve Check-In
                      </span>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
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
                        ✗ Reject Check-In
                      </span>
                    </label>
                  </div>
                </div>

                {verification.action === "reject" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Rejection Reason <span className="text-red-500">*</span>
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
                        <option value="">Select a reason...</option>
                        {REJECTION_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    </div>

                    {verification.rejectionReason === "Other" && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Details <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={verification.customRejectionText}
                          onChange={(e) => {
                            setVerification({
                              ...verification,
                              customRejectionText: e.target.value,
                            });
                          }}
                          placeholder="Describe what needs to be corrected..."
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
                  Cancel
                </button>
                {verification.action === "approve" ? (
                  <button
                    onClick={() => handleApprove(selectedCheckIn.id)}
                    disabled={verification.isApproving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verification.isApproving ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve
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
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verification.isRejecting ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Reject
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                Reject {selectedIds.size} Check-In{selectedIds.size !== 1 ? "s" : ""}?
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
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={bulkRejectionReason}
                  onChange={(e) => {
                    setBulkRejectionReason(e.target.value);
                    setBulkCustomText("");
                  }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select a reason...</option>
                  {REJECTION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {bulkRejectionReason === "Other" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={bulkCustomText}
                    onChange={(e) => setBulkCustomText(e.target.value)}
                    placeholder="Describe what needs to be corrected..."
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
                  Cancel
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={
                    bulkSubmitting ||
                    !bulkRejectionReason ||
                    (bulkRejectionReason === "Other" && !bulkCustomText)
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSubmitting ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Reject All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
