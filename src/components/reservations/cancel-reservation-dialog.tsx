"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CancelReservationDialogProps {
  reservationId: string;
  guestName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const CANCELLATION_REASONS = [
  { value: "guest_request", label: "Guest Request" },
  { value: "overbooking", label: "Overbooking" },
  { value: "property_issue", label: "Property Issue" },
  { value: "other", label: "Other" },
];

export default function CancelReservationDialog({
  reservationId,
  guestName,
  onCancel,
  onConfirm,
}: CancelReservationDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState("guest_request");
  const [notes, setNotes] = useState("");

  const handleCancelReservation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellation_reason: reason,
          cancellation_notes: notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to cancel reservation");
        return;
      }

      toast.success("Reservation cancelled");
      onConfirm();
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel reservation");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[9999]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-lg z-[10000]">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold">Cancel Reservation</Dialog.Title>
            <Dialog.Close
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Warning */}
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Warning</p>
                <p className="text-sm text-red-600 mt-1">
                  You are about to cancel the reservation for <span className="font-semibold">{guestName}</span>. This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium mb-2">Cancellation Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {CANCELLATION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Additional Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                disabled={isLoading}
                placeholder="Explain the cancellation..."
                maxLength={500}
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none h-24"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {notes.length}/500 characters
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleCancelReservation}
                disabled={isLoading}
                className="flex-1 px-3 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? "Cancelling..." : "Cancel Reservation"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
