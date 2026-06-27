"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createReservationSchema, type CreateReservationInput } from "@/lib/validations/reservation";

interface NewReservationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bedId?: string;
  checkInDate?: string;
  orgId: string;
  onReservationCreated?: () => void;
}

export default function NewReservationDrawer({
  open,
  onOpenChange,
  bedId,
  checkInDate,
  orgId,
  onReservationCreated,
}: NewReservationDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestMode, setGuestMode] = useState<"select" | "new">("new");
  const [conflict, setConflict] = useState<{ reservation_number: string; guest: string; check_in: string; check_out: string } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const getTodayLocalDateStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue,
  } = useForm<CreateReservationInput>({
    resolver: yupResolver(createReservationSchema),
    defaultValues: {
      check_in: checkInDate || "",
      guest_id: "new",
      first_name: "",
      last_name: "",
      email: "",
      check_out: "",
      price_per_night: 12,
      notes: "",
      bed_id: bedId || "",
      org_id: orgId || "",
    },
  });

  // Update check_in when checkInDate prop changes
  React.useEffect(() => {
    if (checkInDate) {
      const todayStr = getTodayLocalDateStr();
      const safeCheckInDate = checkInDate < todayStr ? todayStr : checkInDate;

      setValue("check_in", safeCheckInDate);
      setValue("bed_id", bedId || "");
      setValue("org_id", orgId || "");
    }
  }, [checkInDate, bedId, orgId, setValue]);

  const checkOut = watch("check_out");
  const pricePerNight = watch("price_per_night");
  const checkIn = watch("check_in");

  const checkAvailability = async (checkInDate: string, checkOutDate: string) => {
    if (!bedId || !checkInDate || !checkOutDate) return;
    setCheckingAvailability(true);
    setConflict(null);
    try {
      const res = await fetch(
        `/api/reservations/availability?bed_id=${bedId}&check_in=${checkInDate}&check_out=${checkOutDate}`
      );
      const data = await res.json();
      if (!data.available && data.conflicts?.length > 0) {
        setConflict(data.conflicts[0]);
      }
    } catch {
      // silently fail — server will block on submit anyway
    } finally {
      setCheckingAvailability(false);
    }
  };

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const nights = calculateNights();
  const totalPrice = nights * pricePerNight;

  const onSubmit = async (data: CreateReservationInput) => {
    if (!bedId) {
      toast.error("Bed ID is missing");
      return;
    }

    console.log("Submitting reservation:", { ...data, bed_id: bedId, org_id: orgId });

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reservations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          bed_id: bedId,
          org_id: orgId,
        }),
      });

      const result = await parseApiResponse(response);
      console.log("API Response:", response.status, result);

      if (!response.ok) {
        console.error("API Error:", result);
        toast.error(result.error || "Failed to create reservation");
        return;
      }

      toast.success("Reservation created!");
      onOpenChange(false);
      reset();
      setConflict(null);
      onReservationCreated?.();
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Error creating reservation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-50 w-full max-w-md h-screen bg-surface border-l border-border shadow-2xl p-0 overflow-y-auto transition-all duration-300 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
        >
          <div className="flex items-center justify-between p-6 border-b border-border bg-surface sticky top-0 z-10">
            <div>
              <Dialog.Title className="text-lg font-bold text-foreground">New Reservation</Dialog.Title>
              <p className="text-xs text-muted-foreground mt-0.5">Create booking for selected bed</p>
            </div>
            <Dialog.Close className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
            {/* Hidden inputs for bed_id and org_id */}
            <input {...register("bed_id")} type="hidden" />
            <input {...register("org_id")} type="hidden" />

            <div className="rounded-xl border border-border bg-muted/30 p-3 transition-colors duration-200 hover:bg-muted/40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Booking Context</p>
              <p className="text-sm font-semibold text-foreground mt-1">Create booking for selected unit</p>
              {checkIn && <p className="text-xs text-muted-foreground mt-1">Start date: {checkIn}</p>}
            </div>

            {/* Check-in date (readonly) */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Check-in
              </label>
              <input
                {...register("check_in")}
                type="date"
                disabled
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-muted text-foreground opacity-60"
              />
              {errors.check_in && (
                <p className="text-xs text-red-500 mt-1">{errors.check_in.message}</p>
              )}
            </div>

            {/* Check-out date */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Check-out {errors.check_out && <span className="text-red-500">*</span>}
              </label>
              <input
                {...register("check_out")}
                type="date"
                min={checkIn}
                onChange={(e) => {
                  register("check_out").onChange(e);
                  if (e.target.value && checkIn) checkAvailability(checkIn, e.target.value);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all ${
                  errors.check_out || conflict ? "border-red-500" : "border-border"
                }`}
              />
              {checkingAvailability && (
                <p className="text-xs mt-1 text-muted-foreground">Checking availability...</p>
              )}
              {conflict && !checkingAvailability && (
                <div className="mt-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-xs text-red-700 font-medium">Bed already booked</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {conflict.guest} · {conflict.reservation_number} · {conflict.check_in} → {conflict.check_out}
                  </p>
                </div>
              )}
              {errors.check_out && (
                <p className="text-xs text-red-500 mt-1">{errors.check_out.message}</p>
              )}
              {!errors.check_out && !conflict && checkIn && checkOut && (
                <p className="text-xs mt-1 text-muted-foreground">
                  {nights} night{nights !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Guest selection */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Guest
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setGuestMode("new")}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    guestMode === "new"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground/85 hover:bg-muted/80"
                  }`}
                >
                  New Guest
                </button>
              </div>

              {guestMode === "new" && (
                <>
                  <input
                    {...register("first_name")}
                    placeholder="First name"
                    className={`w-full rounded-lg border px-3 py-2 text-sm mb-2 bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all ${
                      errors.first_name ? "border-red-500" : "border-border"
                    }`}
                  />
                  {errors.first_name && (
                    <p className="text-xs text-red-500 mb-2">{errors.first_name.message}</p>
                  )}

                  <input
                    {...register("last_name")}
                    placeholder="Last name"
                    className={`w-full rounded-lg border px-3 py-2 text-sm mb-2 bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all ${
                      errors.last_name ? "border-red-500" : "border-border"
                    }`}
                  />
                  {errors.last_name && (
                    <p className="text-xs text-red-500 mb-2">{errors.last_name.message}</p>
                  )}

                  <input
                    {...register("email")}
                    placeholder="Email address"
                    type="email"
                    className={`w-full rounded-lg border px-3 py-2 text-sm bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all ${
                      errors.email ? "border-red-500" : "border-border"
                    }`}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                  )}
                </>
              )}
            </div>

            {/* Price per night */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Price per night (€) {errors.price_per_night && <span className="text-red-500">*</span>}
              </label>
              <input
                {...register("price_per_night", { valueAsNumber: true })}
                type="number"
                step="0.01"
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all ${
                  errors.price_per_night ? "border-red-500" : "border-border"
                }`}
              />
              {errors.price_per_night && (
                <p className="text-xs text-red-500 mt-1">{errors.price_per_night.message}</p>
              )}
            </div>

            {/* Price summary */}
            {nights > 0 && (
              <div className="p-3 rounded-lg border border-primary/25 bg-primary/5 transition-colors duration-200 hover:bg-primary/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-1.5">Estimated Total</p>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{nights} night{nights !== 1 ? "s" : ""}</span>
                  <span className="font-semibold text-foreground">€{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Notes (optional)
              </label>
              <textarea
                {...register("notes")}
                placeholder="Any special requests..."
                className="w-full rounded-lg border border-border px-3 py-2 text-sm h-20 resize-none bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
              />
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
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {isSubmitting ? "Saving..." : "Save Reservation"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
