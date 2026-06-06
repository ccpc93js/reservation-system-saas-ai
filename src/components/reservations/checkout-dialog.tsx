"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface CheckoutDialogProps {
  reservationId: string;
  guestName: string;
  reservationNumber: string;
  checkIn: string;
  checkOut: string;
  roomName: string;
  bedName: string;
  totalAmount: number;
  paidAmount?: number;
  onComplete: () => void;
  onCancel: () => void;
}

export default function CheckoutDialog({
  reservationId,
  guestName,
  reservationNumber,
  checkIn,
  checkOut,
  roomName,
  bedName,
  totalAmount,
  paidAmount = 0,
  onComplete,
  onCancel,
}: CheckoutDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const balanceDue = totalAmount - paidAmount;

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}/checkout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paid_amount: markAsPaid ? totalAmount : paidAmount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to check out");
        return;
      }

      toast.success("Guest checked out successfully");
      onComplete();
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to check out guest");
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
            <Dialog.Title className="text-lg font-bold">Check Out Guest</Dialog.Title>
            <Dialog.Close
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Guest Info */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="text-sm">
                <span className="font-medium text-muted-foreground">Guest:</span>
                <span className="ml-2 text-foreground font-semibold">{guestName}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-muted-foreground">Reservation #:</span>
                <span className="ml-2 text-foreground font-mono">{reservationNumber}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-muted-foreground">Room / Bed:</span>
                <span className="ml-2 text-foreground">{roomName} - {bedName}</span>
              </div>
            </div>

            {/* Stay Summary */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="text-sm">
                <span className="font-medium text-muted-foreground">Check-in:</span>
                <span className="ml-2 text-foreground">{checkIn}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-muted-foreground">Check-out:</span>
                <span className="ml-2 text-foreground">{checkOut}</span>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <DollarSign className="w-4 h-4" />
                <span>Payment Summary</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-semibold">${totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Paid:</span>
                  <span className="font-semibold">${paidAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-emerald-200 pt-2 flex justify-between">
                  <span className="text-emerald-700 font-semibold">Balance Due:</span>
                  <span className="text-emerald-700 font-bold">${balanceDue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Mark as Paid */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mark-paid"
                checked={markAsPaid}
                onChange={(e) => setMarkAsPaid(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="mark-paid" className="text-sm cursor-pointer">
                Mark as paid in full
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={isLoading}
                className="flex-1 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {isLoading ? "Checking out..." : "Confirm Check-Out"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
