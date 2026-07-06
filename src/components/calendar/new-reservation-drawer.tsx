"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Search, CheckCircle2, BedDouble } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@/lib/supabase/client";
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
  const t = useTranslations("calendar.newReservation");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestMode, setGuestMode] = useState<"select" | "new">("new");
  const [conflict, setConflict] = useState<{ reservation_number: string; guest: string; check_in: string; check_out: string } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  // Existing guest search
  const [guestSearch, setGuestSearch] = useState("");
  const [guestResults, setGuestResults] = useState<any[]>([]);
  const [searchingGuests, setSearchingGuests] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  // Multi-bed selection
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomBeds, setRoomBeds] = useState<{ id: string; name: string; available: boolean; is_active: boolean }[]>([]);
  const [selectedBedIds, setSelectedBedIds] = useState<string[]>(bedId ? [bedId] : []);

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

  // Debounced guest search
  useEffect(() => {
    if (guestMode !== "select" || guestSearch.trim().length < 2) {
      setGuestResults([]);
      setShowDropdown(false);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingGuests(true);
      try {
        const supabase = createBrowserClient();
        const q = guestSearch.trim();
        const { data } = await (supabase as any)
          .from("guests")
          .select("id, first_name, last_name, email, document_number, nationality")
          .eq("organization_id", orgId)
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,document_number.ilike.%${q}%`)
          .limit(8);
        setGuestResults(data ?? []);
        setShowDropdown(true);
      } finally {
        setSearchingGuests(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [guestSearch, guestMode, orgId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectGuest = (g: any) => {
    setSelectedGuest(g);
    setValue("guest_id", g.id);
    setValue("first_name", g.first_name ?? "");
    setValue("last_name", g.last_name ?? "");
    setValue("email", g.email ?? "");
    setGuestSearch(`${g.first_name} ${g.last_name}`);
    setShowDropdown(false);
  };

  const clearGuestSelection = () => {
    setSelectedGuest(null);
    setValue("guest_id", "new");
    setGuestSearch("");
    setGuestResults([]);
  };

  const switchGuestMode = (mode: "new" | "select") => {
    setGuestMode(mode);
    setSelectedGuest(null);
    setGuestSearch("");
    setGuestResults([]);
    setValue("guest_id", "new");
  };

  const checkOut = watch("check_out");
  const pricePerNight = watch("price_per_night");
  const checkIn = watch("check_in");

  // Resolve the anchor bed's room so we can offer the other beds in it.
  useEffect(() => {
    if (!open || !bedId) return;
    setSelectedBedIds([bedId]);
    setRoomBeds([]);
    (async () => {
      const supabase = createBrowserClient();
      const { data: bed } = await (supabase as any)
        .from("beds").select("room_id").eq("id", bedId).single();
      setRoomId(bed?.room_id ?? null);
    })();
  }, [open, bedId]);

  // Load per-bed availability for the room once dates are chosen.
  useEffect(() => {
    if (!open || !roomId || !checkIn || !checkOut) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/reservations/availability?room_id=${roomId}&check_in=${checkIn}&check_out=${checkOut}`
        );
        const data = await res.json();
        if (cancelled) return;
        const beds = data.beds ?? [];
        setRoomBeds(beds);
        // Drop selections that are no longer free; keep the anchor if it is.
        setSelectedBedIds((prev) => {
          const avail = new Set(beds.filter((b: any) => b.available).map((b: any) => b.id));
          let next = prev.filter((id) => avail.has(id));
          if (next.length === 0 && bedId && avail.has(bedId)) next = [bedId];
          return next;
        });
      } catch {
        /* server re-validates on submit */
      }
    })();
    return () => { cancelled = true; };
  }, [open, roomId, checkIn, checkOut, bedId]);

  const availableBeds = roomBeds.filter((b) => b.available);
  const freeCount = availableBeds.length;
  const selectedCount = selectedBedIds.length || 1;

  const toggleBed = (id: string) => {
    setSelectedBedIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  // Auto-assign: pick the first N free beds, anchor bed prioritised.
  const setQuantity = (n: number) => {
    const clamped = Math.max(0, Math.min(n, freeCount));
    const ordered = [
      ...(bedId && availableBeds.some((b) => b.id === bedId) ? [bedId] : []),
      ...availableBeds.map((b) => b.id).filter((id) => id !== bedId),
    ];
    setSelectedBedIds(ordered.slice(0, clamped));
  };

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
  const totalPrice = nights * pricePerNight * selectedCount;

  const onSubmit = async (data: CreateReservationInput) => {
    if (!bedId) {
      toast.error(t("toastBedIdMissing"));
      return;
    }

    // Beds to book: explicit selection, or the anchor bed for single-bed rooms.
    const bedIds = selectedBedIds.length > 0 ? selectedBedIds : [bedId];
    if (roomBeds.length > 1 && bedIds.length === 0) {
      toast.error(t("selectAtLeastOneBed"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reservations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          bed_id: bedId,
          bed_ids: bedIds,
          org_id: orgId,
        }),
      });

      const result = await parseApiResponse(response);
      console.log("API Response:", response.status, result);

      if (!response.ok) {
        console.error("API Error:", result);
        toast.error(result.error || t("toastCreateFailed"));
        return;
      }

      toast.success(t("toastCreateSuccess"));
      onOpenChange(false);
      reset();
      setConflict(null);
      onReservationCreated?.();
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error(t("toastCreateError"));
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
          className="fixed right-0 top-0 z-50 w-full max-w-md h-[100dvh] bg-surface border-l border-border shadow-2xl p-0 overflow-y-auto transition-all duration-300 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
        >
          <div className="flex items-center justify-between p-6 border-b border-border bg-surface sticky top-0 z-10">
            <div>
              <Dialog.Title className="font-serif text-2xl font-semibold text-foreground">{t("title")}</Dialog.Title>
              <p className="text-xs text-muted-foreground mt-0.5">{t("subtitle")}</p>
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("bookingContext")}</p>
              <p className="text-sm font-semibold text-foreground mt-1">{t("bookingContextDesc")}</p>
              {checkIn && <p className="text-xs text-muted-foreground mt-1">{t("startDate", { date: checkIn })}</p>}
            </div>

            {/* Check-in date (readonly) */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {t("checkIn")}
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
                {t("checkOut")} {errors.check_out && <span className="text-red-500">*</span>}
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
                <p className="text-xs mt-1 text-muted-foreground">{t("checkingAvailability")}</p>
              )}
              {conflict && !checkingAvailability && (
                <div className="mt-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-xs text-red-700 font-medium">{t("bedAlreadyBooked")}</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {t("conflictDetail", { guest: conflict.guest, resNumber: conflict.reservation_number, checkIn: conflict.check_in, checkOut: conflict.check_out })}
                  </p>
                </div>
              )}
              {errors.check_out && (
                <p className="text-xs text-red-500 mt-1">{errors.check_out.message}</p>
              )}
              {!errors.check_out && !conflict && checkIn && checkOut && (
                <p className="text-xs mt-1 text-muted-foreground">
                  {t("nights", { count: nights })}
                </p>
              )}
            </div>

            {/* Beds (multi-bed rooms only) */}
            {roomBeds.length > 1 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <BedDouble className="w-3.5 h-3.5" /> {t("beds")}
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {t("bedsSummary", { selected: selectedBedIds.length, free: freeCount })}
                  </span>
                </div>

                {/* Quantity quick-pick (auto-assign N free beds) */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(selectedBedIds.length - 1)}
                    disabled={selectedBedIds.length <= 0}
                    className="w-8 h-8 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-sm font-semibold text-foreground">
                    {selectedBedIds.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(selectedBedIds.length + 1)}
                    disabled={selectedBedIds.length >= freeCount}
                    className="w-8 h-8 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantity(freeCount)}
                    disabled={freeCount === 0}
                    className="ml-auto text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-40"
                  >
                    {t("wholeRoom")}
                  </button>
                </div>

                {/* Explicit bed list */}
                <div className="rounded-lg border border-border divide-y divide-border max-h-44 overflow-y-auto">
                  {roomBeds.map((b) => {
                    const checked = selectedBedIds.includes(b.id);
                    const disabled = !b.available;
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 px-3 py-2 text-sm ${
                          disabled ? "opacity-50" : "cursor-pointer hover:bg-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleBed(b.id)}
                          className="rounded"
                        />
                        <span className="flex-1 text-foreground">{b.name}</span>
                        {!b.is_active ? (
                          <span className="text-[10px] text-muted-foreground">{t("bedInactive")}</span>
                        ) : disabled ? (
                          <span className="text-[10px] text-[#9C4A37]">{t("bedBooked")}</span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Guest selection */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {t("guest")}
              </label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => switchGuestMode("new")}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    guestMode === "new"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground/85 hover:bg-muted/80"
                  }`}
                >
                  {t("newGuestTab")}
                </button>
                <button
                  type="button"
                  onClick={() => switchGuestMode("select")}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    guestMode === "select"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground/85 hover:bg-muted/80"
                  }`}
                >
                  {t("existingGuestTab")}
                </button>
              </div>

              {guestMode === "select" && (
                <div ref={searchRef} className="relative">
                  {selectedGuest ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-300 bg-emerald-50">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {selectedGuest.first_name} {selectedGuest.last_name}
                        </p>
                        {selectedGuest.email && (
                          <p className="text-xs text-muted-foreground truncate">{selectedGuest.email}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={clearGuestSelection}
                        className="text-xs text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          value={guestSearch}
                          onChange={(e) => setGuestSearch(e.target.value)}
                          onFocus={() => guestResults.length > 0 && setShowDropdown(true)}
                          placeholder={t("searchGuestPlaceholder")}
                          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
                        />
                        {searchingGuests && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">…</span>
                        )}
                      </div>
                      {showDropdown && guestResults.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
                          {guestResults.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => selectGuest(g)}
                              className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border/50 last:border-0"
                            >
                              <p className="text-sm font-medium text-foreground">
                                {g.first_name} {g.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {[g.email, g.document_number, g.nationality].filter(Boolean).join(" · ")}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                      {showDropdown && !searchingGuests && guestResults.length === 0 && guestSearch.trim().length >= 2 && (
                        <p className="text-xs text-muted-foreground mt-1.5 px-1">{t("noGuestsFound")}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {guestMode === "new" && (
                <>
                  <input
                    {...register("first_name")}
                    placeholder={t("firstNamePlaceholder")}
                    className={`w-full rounded-lg border px-3 py-2 text-sm mb-2 bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all ${
                      errors.first_name ? "border-red-500" : "border-border"
                    }`}
                  />
                  {errors.first_name && (
                    <p className="text-xs text-red-500 mb-2">{errors.first_name.message}</p>
                  )}

                  <input
                    {...register("last_name")}
                    placeholder={t("lastNamePlaceholder")}
                    className={`w-full rounded-lg border px-3 py-2 text-sm mb-2 bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all ${
                      errors.last_name ? "border-red-500" : "border-border"
                    }`}
                  />
                  {errors.last_name && (
                    <p className="text-xs text-red-500 mb-2">{errors.last_name.message}</p>
                  )}

                  <input
                    {...register("email")}
                    placeholder={t("emailPlaceholder")}
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
                {t("pricePerNight")} {errors.price_per_night && <span className="text-red-500">*</span>}
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-1.5">{t("estimatedTotal")}</p>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {t("nights", { count: nights })}
                    {selectedCount > 1 && ` × ${t("bedsCount", { count: selectedCount })}`}
                  </span>
                  <span className="font-semibold text-foreground">€{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {t("notesLabel")}
              </label>
              <textarea
                {...register("notes")}
                placeholder={t("notesPlaceholder")}
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
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {isSubmitting ? t("saving") : t("saveReservation")}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
