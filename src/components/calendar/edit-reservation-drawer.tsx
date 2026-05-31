"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { updateReservationSchema, type UpdateReservationInput } from "@/lib/validations/reservation";
import { createBrowserClient } from "@/lib/supabase/client";

interface EditReservationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId?: string;
  onReservationUpdated?: () => void;
}

const STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

const STATUS_TONE: Record<string, string> = {
  pending: "text-amber-700",
  confirmed: "text-emerald-700",
  checked_in: "text-indigo-700",
  checked_out: "text-slate-700",
  cancelled: "text-red-700",
  no_show: "text-rose-700",
};

export default function EditReservationDrawer({
  open,
  onOpenChange,
  reservationId,
  onReservationUpdated,
}: EditReservationDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reservation, setReservation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<UpdateReservationInput>({
    resolver: yupResolver(updateReservationSchema),
    defaultValues: {
      status: "pending",
      check_out: "",
      notes: "",
    },
  });

  const status = watch("status");
  const checkInDate = reservation?.check_in ? new Date(reservation.check_in) : null;
  const checkOutDate = reservation?.check_out ? new Date(reservation.check_out) : null;
  const nights =
    checkInDate && checkOutDate
      ? Math.max(0, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
  const pricePerNight = Number(reservation?.reservation_items?.[0]?.price_per_night ?? 0);
  const estimatedTotal = nights * pricePerNight;

  const parseApiResponse = async (response: Response): Promise<{ error?: string; [key: string]: any }> => {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const textBody = await response.text();
    try {
      return JSON.parse(textBody);
    } catch {
      return { error: textBody || `Request failed with status ${response.status}` };
    }
  };

  // Fetch reservation data
  useEffect(() => {
    if (!open || !reservationId) return;

    const fetchReservation = async () => {
      setIsLoading(true);
      try {
        const supabase = createBrowserClient();
        const { data, error } = await supabase
          .from("reservations")
          .select(
            `
            id, reservation_number, status, check_in, check_out, notes,
            guests(first_name, last_name),
            reservation_items(price_per_night)
          `
          )
          .eq("id", reservationId)
          .single();

        if (error) throw error;
        setReservation(data);
        reset({
          status: (data as any).status || "pending",
          notes: (data as any).notes || "",
          check_out: (data as any).check_out || "",
        });
      } catch (error) {
        toast.error("Failed to load reservation");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservation();
  }, [open, reservationId, reset]);

  const onSubmit = async (data: UpdateReservationInput) => {
    if (!reservationId) {
      toast.error("Reservation ID is missing");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await parseApiResponse(response);

      if (!response.ok) {
        toast.error(result.error || "Failed to update reservation");
        return;
      }

      toast.success("Reservation updated!");
      onOpenChange(false);
      onReservationUpdated?.();
    } catch (error) {
      toast.error("Error updating reservation");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!reservationId || !confirm("Are you sure you want to delete this reservation?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "DELETE",
      });

      const result = await parseApiResponse(response);

      if (!response.ok) {
        toast.error(result.error || "Failed to delete reservation");
        return;
      }

      toast.success("Reservation deleted!");
      onOpenChange(false);
      onReservationUpdated?.();
    } catch (error) {
      toast.error("Error deleting reservation");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed right-0 top-0 z-50 w-full max-w-md h-screen bg-surface border-l border-border shadow-2xl p-6"
          >
            <p className="text-muted-foreground">Loading...</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (!reservation) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-50 w-full max-w-md h-screen bg-surface border-l border-border shadow-2xl p-0 overflow-y-auto transition-all duration-300 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
        >
          <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 z-10 bg-surface">
            <div>
              <Dialog.Title className="text-lg font-bold text-foreground">
              {reservation.guests?.first_name} {reservation.guests?.last_name}
              </Dialog.Title>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">Ref: {reservation.reservation_number}</p>
            </div>
            <Dialog.Close className="rounded p-1 hover:bg-muted transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
            {/* Reservation number */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 transition-colors duration-200 hover:bg-muted/40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Reservation #{reservation.reservation_number}
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  Check-in: {new Date(reservation.check_in).toLocaleDateString()}
                </span>
                <span>
                  Check-out: {new Date(reservation.check_out).toLocaleDateString()}
                </span>
              </div>
              {nights > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{nights} night{nights !== 1 ? "s" : ""}</span>
                  <span className="font-semibold text-foreground">€{estimatedTotal.toFixed(2)}</span>
                </div>
              )}
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide">
                <span className="text-muted-foreground">Status: </span>
                <span className={STATUS_TONE[status] ?? "text-slate-700"}>
                  {status.replace("_", " ")}
                </span>
              </p>
            </div>

            {/* Status dropdown */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-muted-foreground">
                Status
              </label>
              <select
                {...register("status")}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-muted-foreground">
                Notes
              </label>
              <textarea
                {...register("notes")}
                placeholder="Any notes..."
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
              />
            </div>

            {/* Delete button — danger zone */}
            <div className="p-3 rounded-lg border border-red-200 bg-red-50/40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-1">Danger Zone</p>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors duration-150 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete this reservation"}
              </button>
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border sticky bottom-0 bg-surface/95 backdrop-blur-sm -mx-6 px-6 pb-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-background text-foreground border border-border hover:bg-muted hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
