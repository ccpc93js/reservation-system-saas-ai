"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CancelReservationDialogProps {
  reservationId: string;
  guestName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const CANCELLATION_REASON_VALUES = ["guest_request", "overbooking", "property_issue", "other"] as const;

export default function CancelReservationDialog({
  reservationId,
  guestName,
  onCancel,
  onConfirm,
}: CancelReservationDialogProps) {
  const t = useTranslations("cancelReservationDialog");
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
        toast.error(error.error || t("toastCancelFailed"));
        return;
      }

      toast.success(t("toastCancelled"));
      onConfirm();
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error(t("toastCancelFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[9999]" />
        {/* lg: shifted left by half the drawer width so it centers in the visible area */}
        <Dialog.Content className="fixed left-1/2 lg:left-[calc(50%-16rem)] top-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-lg z-[10000] max-h-[90dvh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-serif text-2xl font-semibold">{t("title")}</Dialog.Title>
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
                <p className="text-sm font-semibold text-red-700">{t("warning")}</p>
                <p className="text-sm text-red-600 mt-1">
                  {t.rich("aboutToCancel", { strong: (chunks) => <span className="font-semibold">{chunks}</span>, guestName })}
                </p>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium mb-2">{t("cancellationReason")}</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              >
                {CANCELLATION_REASON_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {t(`reason_${v}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">{t("additionalNotes")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                disabled={isLoading}
                placeholder={t("explainCancellation")}
                maxLength={500}
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 resize-none h-24"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("charCount", { count: notes.length })}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {t("back")}
              </button>
              <button
                onClick={handleCancelReservation}
                disabled={isLoading}
                className="flex-1 px-3 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? t("cancellingEllipsis") : t("cancelReservation")}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
