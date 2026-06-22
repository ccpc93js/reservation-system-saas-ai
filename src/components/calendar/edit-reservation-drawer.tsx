"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LogOut, AlertTriangle, User } from "lucide-react";
import { toast } from "sonner";
import { updateReservationSchema, type UpdateReservationInput } from "@/lib/validations/reservation";
import { createBrowserClient } from "@/lib/supabase/client";
import CheckoutDialog from "@/components/reservations/checkout-dialog";
import CancelReservationDialog from "@/components/reservations/cancel-reservation-dialog";
import CheckInLinkButton from "@/components/dashboard/check-in-link-button";
import GuestDialog from "@/components/guests/guest-dialog";

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
  const [isUpdatingDates, setIsUpdatingDates] = useState(false);
  const [reservation, setReservation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [changingGuest, setChangingGuest] = useState(false);
  const [guestSearch, setGuestSearch] = useState("");
  const [guestResults, setGuestResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [editingDates, setEditingDates] = useState(false);
  const [newCheckIn, setNewCheckIn] = useState("");
  const [newCheckOut, setNewCheckOut] = useState("");

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
            id, reservation_number, status, check_in, check_out, notes, total_amount, paid_amount, check_in_token, guest_id, organization_id,
            guests(first_name, last_name),
            reservation_items(price_per_night, beds(name, rooms(name)))
          `
          )
          .eq("id", reservationId)
          .single();

        if (error) throw error;
        setReservation(data);
        setNewCheckIn((data as any).check_in || "");
        setNewCheckOut((data as any).check_out || "");
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

  const handleUpdateDates = async () => {
    if (!newCheckIn || !newCheckOut) {
      toast.error("Both check-in and check-out dates are required");
      return;
    }

    if (new Date(newCheckOut) <= new Date(newCheckIn)) {
      toast.error("Check-out date must be after check-in date");
      return;
    }

    setIsUpdatingDates(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}/update-dates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_in: newCheckIn,
          check_out: newCheckOut,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to update dates");
        return;
      }

      toast.success("Reservation dates updated!");
      setEditingDates(false);
      onReservationUpdated?.();
    } catch (error) {
      toast.error("Error updating dates");
      console.error(error);
    } finally {
      setIsUpdatingDates(false);
    }
  };

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

  const handleGuestSearch = async (query: string) => {
    setGuestSearch(query);
    if (query.length < 2) { setGuestResults([]); return; }
    setIsSearching(true);
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("guests")
      .select("id, first_name, last_name, email")
      .eq("organization_id", reservation?.organization_id)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(6);
    setGuestResults(data || []);
    setIsSearching(false);
  };

  const handleAssignGuest = async (guest: any) => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_id: guest.id, status: reservation.status }),
      });
      if (!response.ok) throw new Error();
      setReservation((prev: any) => ({
        ...prev,
        guest_id: guest.id,
        guests: { first_name: guest.first_name, last_name: guest.last_name },
      }));
      setChangingGuest(false);
      setGuestSearch("");
      setGuestResults([]);
      toast.success(`Guest changed to ${guest.first_name} ${guest.last_name}`);
      onReservationUpdated?.();
    } catch {
      toast.error("Failed to change guest");
    }
  };

  if (isLoading) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[9999]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed right-0 top-0 z-[10000] w-full max-w-md h-screen bg-surface border-l border-border shadow-2xl p-6"
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
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[9999]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-[10000] w-full max-w-md h-screen bg-surface border-l border-border shadow-2xl p-0 overflow-y-auto transition-all duration-300 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
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
            {/* Reservation Details */}
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

            {/* Edit Dates Section */}
            {!editingDates ? (
              <button
                type="button"
                onClick={() => setEditingDates(true)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                Edit Dates
              </button>
            ) : (
              <div className="space-y-3 p-3 rounded-lg border border-indigo-200 bg-indigo-50">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-indigo-700">
                    Check-in
                  </label>
                  <input
                    type="date"
                    value={newCheckIn}
                    onChange={(e) => setNewCheckIn(e.target.value)}
                    className="w-full rounded-lg border border-indigo-300 bg-white text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-indigo-700">
                    Check-out
                  </label>
                  <input
                    type="date"
                    value={newCheckOut}
                    onChange={(e) => setNewCheckOut(e.target.value)}
                    className="w-full rounded-lg border border-indigo-300 bg-white text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDates(false)}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateDates}
                    disabled={isUpdatingDates}
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isUpdatingDates ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
            )}

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

            {/* Guest section */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Guest
              </label>

              {!changingGuest ? (
                <div className="flex gap-2">
                  {reservation?.guest_id && (
                    <button
                      type="button"
                      onClick={() => setShowGuestDialog(true)}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <User className="w-4 h-4 shrink-0" />
                      <span className="truncate">{reservation.guests?.first_name} {reservation.guests?.last_name}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setChangingGuest(true)}
                    className="px-3 py-2 text-sm rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={guestSearch}
                      onChange={(e) => handleGuestSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      autoFocus
                      className="flex-1 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                    />
                    <button
                      type="button"
                      onClick={() => { setChangingGuest(false); setGuestSearch(""); setGuestResults([]); }}
                      className="px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {isSearching && <p className="text-xs text-muted-foreground px-1">Searching...</p>}
                  {guestResults.length > 0 && (
                    <div className="rounded-lg border border-border bg-background shadow-md overflow-hidden">
                      {guestResults.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleAssignGuest(g)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
                        >
                          <span className="font-medium text-foreground">{g.first_name} {g.last_name}</span>
                          {g.email && <span className="text-xs text-muted-foreground ml-2">{g.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {guestSearch.length >= 2 && !isSearching && guestResults.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1">No guests found</p>
                  )}
                </div>
              )}
            </div>

            {/* Guest Check-In Link */}
            {reservation?.check_in_token && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">
                  Guest Check-In Link
                </label>
                <CheckInLinkButton checkInToken={reservation.check_in_token} />
              </div>
            )}

            {/* Action Buttons */}
            {status === "checked_in" && (
              <button
                type="button"
                onClick={() => setShowCheckoutDialog(true)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Check Out Guest
              </button>
            )}

            {/* Delete button — danger zone */}
            <div className="p-3 rounded-lg border border-red-200 bg-red-50/40 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-1">Danger Zone</p>
              <button
                type="button"
                onClick={() => setShowCancelDialog(true)}
                className="w-full text-sm font-medium text-red-600 hover:text-red-700 transition-colors duration-150 px-3 py-2 rounded border border-red-200 hover:bg-red-100 flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Cancel Reservation
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full text-sm font-medium text-red-600 hover:text-red-700 transition-colors duration-150 disabled:opacity-50"
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

          {/* Checkout Dialog */}
          {showCheckoutDialog && (
            <CheckoutDialog
              reservationId={reservationId!}
              guestName={`${reservation.guests?.first_name} ${reservation.guests?.last_name}`}
              reservationNumber={reservation.reservation_number}
              checkIn={reservation.check_in}
              checkOut={reservation.check_out}
              roomName={reservation.reservation_items?.[0]?.beds?.rooms?.name || "Unknown"}
              bedName={reservation.reservation_items?.[0]?.beds?.name || "Unknown"}
              totalAmount={reservation.total_amount || 0}
              paidAmount={reservation.paid_amount || 0}
              onComplete={() => {
                setShowCheckoutDialog(false);
                onOpenChange(false);
                onReservationUpdated?.();
              }}
              onCancel={() => setShowCheckoutDialog(false)}
            />
          )}

          {/* Guest Dialog */}
          {showGuestDialog && (
            <GuestDialog
              open={showGuestDialog}
              onOpenChange={setShowGuestDialog}
              guestId={reservation.guest_id}
              orgId={reservation.organization_id}
              onGuestCreated={() => setShowGuestDialog(false)}
            />
          )}

          {/* Cancel Dialog */}
          {showCancelDialog && (
            <CancelReservationDialog
              reservationId={reservationId!}
              guestName={`${reservation.guests?.first_name} ${reservation.guests?.last_name}`}
              onCancel={() => setShowCancelDialog(false)}
              onConfirm={() => {
                setShowCancelDialog(false);
                onOpenChange(false);
                onReservationUpdated?.();
              }}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
