"use client";

import { useState, useEffect } from "react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LogOut, AlertTriangle, User, UserPlus, Users, Trash2, Pencil, BedDouble, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
  checkoutWarnings?: string[];
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
  confirmed: "text-[#4A6740]",
  checked_in: "text-[#3A5F82]",
  checked_out: "text-foreground",
  cancelled: "text-red-700",
  no_show: "text-rose-700",
};

export default function EditReservationDrawer({
  open,
  onOpenChange,
  reservationId,
  onReservationUpdated,
  checkoutWarnings,
}: EditReservationDrawerProps) {
  const t = useTranslations("calendar.editReservation");
  const statusLabels: Record<string, string> = {
    pending: t("statusOptions.pending"),
    confirmed: t("statusOptions.confirmed"),
    checked_in: t("statusOptions.checked_in"),
    checked_out: t("statusOptions.checked_out"),
    cancelled: t("statusOptions.cancelled"),
    no_show: t("statusOptions.no_show"),
  };
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

  // Payment state
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("EUR");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState("EUR");
  const [actualCheckIn, setActualCheckIn] = useState("");
  const [actualCheckOut, setActualCheckOut] = useState("");
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  // Extension state
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [extendRate, setExtendRate] = useState("");
  const [isExtending, setIsExtending] = useState(false);
  // Segment rate editing
  const [segmentRates, setSegmentRates] = useState<Record<number, string>>({});
  const [savingSegment, setSavingSegment] = useState<number | null>(null);
  // Guest book
  const [inBook, setInBook] = useState(false);
  const [addingToBook, setAddingToBook] = useState(false);
  // Additional (companion) guests
  const [companions, setCompanions] = useState<any[]>([]);
  const [addingCompanion, setAddingCompanion] = useState(false);
  const [companionSearch, setCompanionSearch] = useState("");
  const [companionResults, setCompanionResults] = useState<any[]>([]);
  const [companionSearching, setCompanionSearching] = useState(false);
  const [savingCompanion, setSavingCompanion] = useState(false);
  const [companionEditId, setCompanionEditId] = useState<string | null>(null);
  const [creatingCompanion, setCreatingCompanion] = useState(false);
  // Beds on the reservation
  const [addingBed, setAddingBed] = useState(false);
  const [bedOptions, setBedOptions] = useState<{ id: string; name: string; available: boolean; is_active: boolean }[]>([]);
  const [savingBed, setSavingBed] = useState(false);

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
  // Capacity = one guest per booked bed. Primary counts as one.
  const bedCount = reservation?.reservation_items?.length ?? 0;
  const guestsFull = bedCount > 0 && companions.length + 1 >= bedCount;
  const checkInDate = reservation?.check_in ? new Date(reservation.check_in) : null;
  const checkOutDate = reservation?.check_out ? new Date(reservation.check_out) : null;
  const nights =
    checkInDate && checkOutDate
      ? Math.max(0, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
  const estimatedTotal = Number(reservation?.total_amount ?? 0);

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

  const loadCompanions = async (resId?: string | null) => {
    const rid = resId ?? reservationId;
    if (!rid) return;
    try {
      const res = await fetch(`/api/reservations/${rid}/guests`);
      const json = await res.json();
      if (res.ok) setCompanions((json.guests ?? []).filter((g: any) => !g.is_primary));
    } catch {
      /* non-blocking */
    }
  };

  // Re-fetch the reservation (items + total) after a bed change.
  const reloadReservation = async () => {
    if (!reservationId) return;
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("reservations")
      .select(
        `
        id, reservation_number, status, check_in, check_out, notes, total_amount, paid_amount, check_in_token, guest_id, organization_id,
        payment_confirmed, payment_currency, payment_method, deposit_amount, deposit_currency,
        actual_check_in_at, actual_check_out_at,
        guests(first_name, last_name),
        reservation_items(id, bed_id, price_per_night, total_price, check_in, check_out, created_at, beds(id, name, room_id, rooms(name)))
      `
      )
      .eq("id", reservationId)
      .single();
    if (data) setReservation(data);
  };

  // Available beds in the reservation's room(s), excluding beds already on it.
  const loadBedOptions = async () => {
    if (!reservation) return;
    const items: any[] = reservation.reservation_items ?? [];
    const roomId = items[0]?.beds?.room_id;
    if (!roomId) { setBedOptions([]); return; }
    const onReservation = new Set(items.map((it) => it.bed_id));
    try {
      const res = await fetch(
        `/api/reservations/availability?room_id=${roomId}&check_in=${reservation.check_in}&check_out=${reservation.check_out}&exclude_id=${reservationId}`
      );
      const data = await res.json();
      const beds = (data.beds ?? []).filter((b: any) => !onReservation.has(b.id));
      setBedOptions(beds);
    } catch {
      setBedOptions([]);
    }
  };

  const handleAddBed = async (bedId: string, name: string) => {
    setSavingBed(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bed_ids: [bedId] }),
      });
      const json = await parseApiResponse(res);
      if (!res.ok) { toast.error(json.error || t("toasts.bedAddFailed")); return; }
      await reloadReservation();
      setAddingBed(false);
      setBedOptions([]);
      toast.success(t("toasts.bedAdded", { name }));
      onReservationUpdated?.();
    } catch {
      toast.error(t("toasts.bedAddFailed"));
    } finally {
      setSavingBed(false);
    }
  };

  const handleRemoveBed = async (bedId: string, name: string) => {
    if (!(await confirmDialog(t("toasts.bedRemoveConfirm", { name })))) return;
    try {
      const res = await fetch(`/api/reservations/${reservationId}/items?bed_id=${bedId}`, { method: "DELETE" });
      const json = await parseApiResponse(res);
      if (!res.ok) { toast.error(json.error || t("toasts.bedRemoveFailed")); return; }
      await reloadReservation();
      toast.success(t("toasts.bedRemoved", { name }));
      onReservationUpdated?.();
    } catch {
      toast.error(t("toasts.bedRemoveFailed"));
    }
  };

  // "In book" only when EVERY occupant (primary + companions) has a registry
  // row, so adding a companion later re-enables the button to register them.
  const refreshInBook = async () => {
    if (!reservationId) return;
    const supabase = createBrowserClient();
    const [{ data: regRows }, { data: occRows }] = await Promise.all([
      (supabase as any)
        .from("checkin_registry")
        .select("guest_id")
        .eq("reservation_id", reservationId),
      (supabase as any)
        .from("reservation_guests")
        .select("guest_id")
        .eq("reservation_id", reservationId),
    ]);
    const registered = new Set((regRows ?? []).map((r: any) => r.guest_id).filter(Boolean));
    const hasLegacyRow = (regRows ?? []).some((r: any) => !r.guest_id);
    const occupants: string[] = (occRows ?? []).map((r: any) => r.guest_id);
    if (occupants.length === 0) {
      // Pre-companion data: any row counts as registered.
      setInBook((regRows ?? []).length > 0);
      return;
    }
    setInBook(occupants.every((gid) => registered.has(gid)) || (hasLegacyRow && occupants.length === 1));
  };

  // Fetch reservation data
  useEffect(() => {
    if (!open) {
      setInBook(false);
      return;
    }
    if (!reservationId) return;

    const fetchReservation = async () => {
      setIsLoading(true);
      try {
        const supabase = createBrowserClient();
        const { data, error } = await supabase
          .from("reservations")
          .select(
            `
            id, reservation_number, status, check_in, check_out, notes, total_amount, paid_amount, check_in_token, guest_id, organization_id,
            payment_confirmed, payment_currency, payment_method, deposit_amount, deposit_currency,
            actual_check_in_at, actual_check_out_at,
            guests(first_name, last_name),
            reservation_items(id, bed_id, price_per_night, total_price, check_in, check_out, created_at, beds(id, name, room_id, rooms(name)))
          `
          )
          .eq("id", reservationId)
          .single();

        if (error) throw error;
        setReservation(data);
        setSegmentRates({});

        await refreshInBook();
        await loadCompanions(reservationId);
        setNewCheckIn((data as any).check_in || "");
        setNewCheckOut((data as any).check_out || "");
        setPaymentConfirmed((data as any).payment_confirmed ?? false);
        setPaidAmount((data as any).paid_amount != null ? String((data as any).paid_amount) : "");
        setPaymentCurrency((data as any).payment_currency || "EUR");
        setPaymentMethod((data as any).payment_method || "");
        setDepositAmount((data as any).deposit_amount != null ? String((data as any).deposit_amount) : "");
        setDepositCurrency((data as any).deposit_currency || "EUR");
        const cin = (data as any).actual_check_in_at;
        const cout = (data as any).actual_check_out_at;
        setActualCheckIn(cin ? new Date(cin).toISOString().slice(0, 16) : "");
        setActualCheckOut(cout ? new Date(cout).toISOString().slice(0, 16) : "");
        reset({
          status: (data as any).status || "pending",
          notes: (data as any).notes || "",
          check_out: (data as any).check_out || "",
        });
      } catch (error) {
        toast.error(t("toasts.loadFailed"));
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservation();
  }, [open, reservationId, reset]);

  const handleUpdateDates = async () => {
    if (!newCheckIn || !newCheckOut) {
      toast.error(t("toasts.bothDatesRequired"));
      return;
    }

    if (new Date(newCheckOut) <= new Date(newCheckIn)) {
      toast.error(t("toasts.checkOutAfterCheckIn"));
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
        toast.error(error.error || t("toasts.datesUpdateFailed"));
        return;
      }

      toast.success(t("toasts.datesUpdated"));
      setEditingDates(false);
      onReservationUpdated?.();
    } catch (error) {
      toast.error(t("toasts.datesUpdateError"));
      console.error(error);
    } finally {
      setIsUpdatingDates(false);
    }
  };

  const handleAddToBook = async () => {
    if (!reservationId) return;
    setAddingToBook(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/registry`, { method: "POST" });
      const json = await res.json();
      if (res.status === 409) { setInBook(true); toast.success(t("toasts.alreadyInBook")); return; }
      if (!res.ok) { toast.error(json.error || t("toasts.addToBookFailed")); return; }
      setInBook(true);
      toast.success(t("toasts.addedToBook"));
    } catch { toast.error(t("toasts.addToBookError")); }
    finally { setAddingToBook(false); }
  };

  const onSubmit = async (data: UpdateReservationInput) => {
    if (!reservationId) {
      toast.error(t("toasts.reservationIdMissing"));
      return;
    }

    const res = reservation as any;
    const totalAmt = Number(res?.total_amount ?? 0);
    // Use UI state value — user may have filled amount paid without clicking Save Payment Info yet
    const paidAmt = paidAmount !== "" ? Number(paidAmount) : Number(res?.paid_amount ?? 0);
    const balanceDue = totalAmt - paidAmt;

    if (data.status === "checked_in") {
      const missing: string[] = [];
      if (!res?.guest_id) missing.push(t("toasts.noGuestAssigned"));
      if (totalAmt > 0 && paidAmt < totalAmt)
        missing.push(t("toasts.balanceDueCheckIn", { amount: balanceDue.toFixed(2) }));
      if (missing.length > 0) {
        toast.error(missing.join(" · "), { duration: 6000 });
        return;
      }
    }

    if (data.status === "checked_out") {
      const missing: string[] = [];
      if (!res?.guest_id) missing.push(t("toasts.noGuestAssigned"));
      if (balanceDue > 0)
        missing.push(t("toasts.balanceDueCheckOut", { amount: balanceDue.toFixed(2) }));
      if (!paymentConfirmed) missing.push(t("toasts.paymentNotConfirmed"));
      if (!actualCheckIn && !res?.actual_check_in_at) missing.push(t("toasts.actualCheckInMissing"));
      if (missing.length > 0) {
        toast.error(missing.join(" · "), { duration: 6000 });
        return;
      }
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
        toast.error(result.error || t("toasts.updateFailed"));
        return;
      }

      toast.success(t("toasts.updated"));
      onOpenChange(false);
      onReservationUpdated?.();
    } catch (error) {
      toast.error(t("toasts.updateError"));
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!reservationId || !(await confirmDialog(t("toasts.confirmDelete")))) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "DELETE",
      });

      const result = await parseApiResponse(response);

      if (!response.ok) {
        toast.error(result.error || t("toasts.deleteFailed"));
        return;
      }

      toast.success(t("toasts.deleted"));
      onOpenChange(false);
      onReservationUpdated?.();
    } catch (error) {
      toast.error(t("toasts.deleteError"));
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
      // Primary changed → reservation_guests re-synced server-side; reload list.
      await loadCompanions(reservationId);
      toast.success(t("toasts.guestChanged", { name: `${guest.first_name} ${guest.last_name}` }));
      onReservationUpdated?.();
    } catch {
      toast.error(t("toasts.guestChangeFailed"));
    }
  };

  const handleCompanionSearch = async (query: string) => {
    setCompanionSearch(query);
    if (query.trim().length < 2) { setCompanionResults([]); return; }
    setCompanionSearching(true);
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("guests")
      .select("id, first_name, last_name, email")
      .eq("organization_id", reservation?.organization_id)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(8);
    // Exclude the primary and already-attached companions.
    const attached = new Set([reservation?.guest_id, ...companions.map((c) => c.guest_id)]);
    setCompanionResults((data || []).filter((g: any) => !attached.has(g.id)));
    setCompanionSearching(false);
  };

  const handleAddCompanion = async (guest: any) => {
    setSavingCompanion(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_id: guest.id }),
      });
      const json = await parseApiResponse(res);
      if (!res.ok) { toast.error(json.error || t("toasts.companionAddFailed")); return; }
      setCompanions((prev) => [...prev, json.guest]);
      setCompanionSearch("");
      setCompanionResults([]);
      setAddingCompanion(false);
      await refreshInBook();
      toast.success(t("toasts.companionAdded", { name: `${guest.first_name} ${guest.last_name}` }));
    } catch {
      toast.error(t("toasts.companionAddFailed"));
    } finally {
      setSavingCompanion(false);
    }
  };

  // Link a just-created guest (from the guest dialog) as a companion.
  const addCompanionById = async (guestId: string) => {
    try {
      const res = await fetch(`/api/reservations/${reservationId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_id: guestId }),
      });
      const json = await parseApiResponse(res);
      if (!res.ok) {
        toast.error(json.error || t("toasts.companionAddFailed"));
        return;
      }
      await loadCompanions(reservationId);
      await refreshInBook();
      const g = json.guest?.guests;
      toast.success(t("toasts.companionAdded", { name: g ? `${g.first_name} ${g.last_name}` : "" }));
    } catch {
      toast.error(t("toasts.companionAddFailed"));
    }
  };

  const handleRemoveCompanion = async (guestId: string, name: string) => {
    if (!(await confirmDialog(t("toasts.companionRemoveConfirm", { name })))) return;
    try {
      const res = await fetch(`/api/reservations/${reservationId}/guests?guest_id=${guestId}`, { method: "DELETE" });
      const json = await parseApiResponse(res);
      if (!res.ok) { toast.error(json.error || t("toasts.companionRemoveFailed")); return; }
      setCompanions((prev) => prev.filter((c) => c.guest_id !== guestId));
      await refreshInBook();
      toast.success(t("toasts.companionRemoved"));
    } catch {
      toast.error(t("toasts.companionRemoveFailed"));
    }
  };

  const handleExtend = async () => {
    if (!extendDate || !extendRate) { toast.error(t("toasts.extendMissingFields")); return; }
    setIsExtending(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_check_out: extendDate, price_per_night: Number(extendRate) }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || t("toasts.extendFailed")); return; }
      toast.success(t("toasts.extended", { currency: paymentCurrency, total: data.new_total.toFixed(2) }));
      setShowExtend(false);
      setExtendDate("");
      setExtendRate("");
      // Reload reservation data
      const supabase = createBrowserClient();
      const { data: updated } = await supabase
        .from("reservations")
        .select(`id, reservation_number, status, check_in, check_out, notes, total_amount, paid_amount, check_in_token, guest_id, organization_id, payment_confirmed, payment_currency, payment_method, deposit_amount, deposit_currency, actual_check_in_at, actual_check_out_at, guests(first_name, last_name), reservation_items(id, bed_id, price_per_night, total_price, check_in, check_out, created_at, beds(id, name, room_id, rooms(name)))`)
        .eq("id", reservationId!)
        .single();
      if (updated) { setReservation(updated); setSegmentRates({}); }
      onReservationUpdated?.();
    } catch { toast.error(t("toasts.extendError")); }
    finally { setIsExtending(false); }
  };

  const handleSegmentRateBlur = async (segmentIndex: number, itemIds: string[], newRate: string) => {
    const rate = Number(newRate);
    if (!newRate || isNaN(rate) || rate < 0 || !reservationId) return;
    const currentRate = Number(
      (reservation?.reservation_items ?? [])
        .find((i: any) => itemIds.includes(i.id))?.price_per_night ?? 0
    );
    if (rate === currentRate) return;

    setSavingSegment(segmentIndex);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/segment-rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: itemIds, price_per_night: rate }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || t("toasts.rateUpdateFailed")); return; }

      // Update local reservation state
      setReservation((prev: any) => {
        if (!prev) return prev;
        const updatedItems = (prev.reservation_items ?? []).map((item: any) =>
          itemIds.includes(item.id)
            ? { ...item, price_per_night: rate, total_price: rate * Math.max(1,
                Math.round((new Date(item.check_out).getTime() - new Date(item.check_in).getTime()) / 86400000)) }
            : item
        );
        return { ...prev, reservation_items: updatedItems, total_amount: json.new_total };
      });
      toast.success(t("toasts.rateUpdated"));
      onReservationUpdated?.();
    } catch { toast.error(t("toasts.rateUpdateError")); }
    finally { setSavingSegment(null); }
  };

  const handleSavePayment = async () => {
    setIsSavingPayment(true);
    try {
      const body: Record<string, any> = {
        payment_confirmed: paymentConfirmed,
        payment_currency: paymentCurrency || null,
        payment_method: paymentMethod || null,
        paid_amount: paidAmount !== "" ? Number(paidAmount) : null,
        deposit_amount: depositAmount !== "" ? Number(depositAmount) : null,
        deposit_currency: depositCurrency || null,
        actual_check_in_at: actualCheckIn ? new Date(actualCheckIn).toISOString() : null,
        actual_check_out_at: actualCheckOut ? new Date(actualCheckOut).toISOString() : null,
      };
      const res = await fetch(`/api/reservations/${reservationId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json();
        toast.error(e.error || t("toasts.paymentSaveFailed"));
        return;
      }
      toast.success(t("toasts.paymentSaved"));
      await refreshInBook();
      onReservationUpdated?.();
    } catch {
      toast.error(t("toasts.paymentSaveError"));
    } finally {
      setIsSavingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[9999]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed right-0 top-0 z-[10000] w-full max-w-lg h-[100dvh] bg-surface border-l border-border shadow-2xl p-6"
          >
            <p className="text-muted-foreground">{t("loading")}</p>
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
          className="fixed right-0 top-0 z-[10000] w-full max-w-lg h-[100dvh] bg-surface border-l border-border shadow-2xl p-0 overflow-y-auto transition-all duration-300 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
        >
          <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 z-10 bg-surface">
            <div>
              <Dialog.Title className="font-serif text-2xl font-semibold text-foreground">
              {reservation.guests?.first_name} {reservation.guests?.last_name}
              </Dialog.Title>
              <p className="text-xs text-primary font-semibold mt-0.5 font-mono">{t("ref", { number: reservation.reservation_number })}</p>
            </div>
            <Dialog.Close className="rounded p-1 hover:bg-muted transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </Dialog.Close>
          </div>

          {/* Checkout warnings banner */}
          {checkoutWarnings && checkoutWarnings.length > 0 && (
            <div className="mx-6 mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {t("checkoutWarningsTitle")}
              </p>
              <ul className="space-y-0.5">
                {checkoutWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-800 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-amber-600 mt-2">{t("checkoutWarningsHint")}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
            {/* Reservation Details */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 transition-colors duration-200 hover:bg-muted/40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                {t("reservationNumber", { number: reservation.reservation_number })}
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  {t("checkInLabel", { date: new Date(reservation.check_in).toLocaleDateString() })}
                </span>
                <span>
                  {t("checkOutLabel", { date: new Date(reservation.check_out).toLocaleDateString() })}
                </span>
              </div>
              {nights > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("nights", { count: nights })}</span>
                  <span className="font-semibold text-foreground">€{estimatedTotal.toFixed(2)}</span>
                </div>
              )}
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide">
                <span className="text-muted-foreground">{t("statusLabel")}</span>
                <span className={STATUS_TONE[status] ?? "text-foreground"}>
                  {statusLabels[status] ?? status}
                </span>
              </p>
            </div>

            {/* Edit Dates Section */}
            {!editingDates ? (
              <button
                type="button"
                onClick={() => setEditingDates(true)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#C2D2E2] bg-[#DDE7F0] text-[#3A5F82] hover:bg-[#C8D8E8] transition-colors"
              >
                {t("editDates")}
              </button>
            ) : (
              <div className="space-y-3 p-3 rounded-lg border border-[#C2D2E2] bg-[#DDE7F0]">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[#3A5F82]">
                    {t("checkIn")}
                  </label>
                  <input
                    type="date"
                    value={newCheckIn}
                    onChange={(e) => setNewCheckIn(e.target.value)}
                    className="w-full rounded-lg border border-[#C2D2E2] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A5F82]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[#3A5F82]">
                    {t("checkOut")}
                  </label>
                  <input
                    type="date"
                    value={newCheckOut}
                    min={newCheckIn || undefined}
                    onChange={(e) => setNewCheckOut(e.target.value)}
                    className="w-full rounded-lg border border-[#C2D2E2] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A5F82]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDates(false)}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#C2D2E2] text-[#3A5F82] hover:bg-[#C8D8E8]"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateDates}
                    disabled={isUpdatingDates}
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-[#3A5F82] text-white hover:bg-[#31506E] disabled:opacity-50"
                  >
                    {isUpdatingDates ? t("updating") : t("update")}
                  </button>
                </div>
              </div>
            )}

            {/* Status dropdown */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-muted-foreground">
                {t("status")}
              </label>
              <select
                {...register("status")}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-muted-foreground">
                {t("notes")}
              </label>
              <textarea
                {...register("notes")}
                placeholder={t("notesPlaceholder")}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
              />
            </div>

            {/* Guest section */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("guest")}
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
                    {t("change")}
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={guestSearch}
                      onChange={(e) => handleGuestSearch(e.target.value)}
                      placeholder={t("searchGuestPlaceholder")}
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
                  {isSearching && <p className="text-xs text-muted-foreground px-1">{t("searching")}</p>}
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
                    <p className="text-xs text-muted-foreground px-1">{t("noGuestsFound")}</p>
                  )}
                </div>
              )}
            </div>

            {/* Beds */}
            {(reservation?.reservation_items?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <BedDouble className="w-3.5 h-3.5" />
                    {t("bedsLabel")}
                    <span className="text-muted-foreground/70">({reservation.reservation_items.length})</span>
                  </label>
                  {!addingBed && (
                    <button
                      type="button"
                      onClick={() => { setAddingBed(true); loadBedOptions(); }}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t("addBed")}
                    </button>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-background divide-y divide-border overflow-hidden">
                  {reservation.reservation_items.map((it: any) => (
                    <div key={it.id} className="flex items-center gap-2 px-3 py-2">
                      <BedDouble className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground truncate block">{it.beds?.name}</span>
                        {it.beds?.rooms?.name && (
                          <span className="text-xs text-muted-foreground truncate block">{it.beds.rooms.name}</span>
                        )}
                      </div>
                      {reservation.reservation_items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBed(it.bed_id, it.beds?.name)}
                          className="p-1.5 rounded-lg hover:bg-[#EEDCD5] transition-colors shrink-0"
                          title={t("removeBed")}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#9C4A37]" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {addingBed && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-muted-foreground">{t("addBedHint")}</span>
                      <button
                        type="button"
                        onClick={() => { setAddingBed(false); setBedOptions([]); }}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    {bedOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">{t("noFreeBeds")}</p>
                    ) : (
                      <div className="rounded-lg border border-border bg-background divide-y divide-border overflow-hidden">
                        {bedOptions.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            disabled={!b.available || savingBed}
                            onClick={() => handleAddBed(b.id, b.name)}
                            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                          >
                            <BedDouble className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-foreground">{b.name}</span>
                            {!b.available && <span className="text-[10px] text-[#9C4A37]">{t("bedTaken")}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Additional guests */}
            {reservation?.guest_id && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    {t("additionalGuests")}
                    {bedCount > 0 && (
                      <span className="text-muted-foreground/70">({companions.length + 1}/{bedCount})</span>
                    )}
                  </label>
                  {!addingCompanion && !guestsFull && (
                    <button
                      type="button"
                      onClick={() => setAddingCompanion(true)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> {t("addGuest")}
                    </button>
                  )}
                </div>

                {companions.length > 0 && (
                  <div className="rounded-lg border border-border bg-background divide-y divide-border overflow-hidden">
                    {companions.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-foreground truncate block">
                            {c.guests?.first_name} {c.guests?.last_name}
                          </span>
                          {c.guests?.email && (
                            <span className="text-xs text-muted-foreground truncate block">{c.guests.email}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCompanionEditId(c.guest_id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                          title={t("editGuest")}
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveCompanion(c.guest_id, `${c.guests?.first_name} ${c.guests?.last_name}`)}
                          className="p-1.5 rounded-lg hover:bg-[#EEDCD5] transition-colors shrink-0"
                          title={t("removeGuest")}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#9C4A37]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {addingCompanion && (
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={companionSearch}
                        onChange={(e) => handleCompanionSearch(e.target.value)}
                        placeholder={t("searchGuestPlaceholder")}
                        autoFocus
                        disabled={savingCompanion}
                        className="flex-1 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => { setAddingCompanion(false); setCompanionSearch(""); setCompanionResults([]); }}
                        className="px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {companionSearching && <p className="text-xs text-muted-foreground px-1">{t("searching")}</p>}
                    {companionResults.length > 0 && (
                      <div className="rounded-lg border border-border bg-background shadow-md overflow-hidden">
                        {companionResults.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleAddCompanion(g)}
                            disabled={savingCompanion}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border last:border-0 disabled:opacity-50"
                          >
                            <span className="font-medium text-foreground">{g.first_name} {g.last_name}</span>
                            {g.email && <span className="text-xs text-muted-foreground ml-2">{g.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {companionSearch.length >= 2 && !companionSearching && companionResults.length === 0 && (
                      <p className="text-xs text-muted-foreground px-1">{t("noGuestsFound")}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => { setAddingCompanion(false); setCompanionSearch(""); setCompanionResults([]); setCreatingCompanion(true); }}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 px-1 pt-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> {t("createNewGuest")}
                    </button>
                  </div>
                )}

                {companions.length === 0 && !addingCompanion && !guestsFull && (
                  <p className="text-xs text-muted-foreground px-1">{t("noAdditionalGuests")}</p>
                )}
                {guestsFull && (
                  <p className="text-xs text-muted-foreground px-1">{t("guestsFull", { count: bedCount })}</p>
                )}
              </div>
            )}

            {/* Guest Check-In Link */}
            {reservation?.check_in_token && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">
                  {t("guestCheckInLink")}
                </label>
                <CheckInLinkButton checkInToken={reservation.check_in_token} />
              </div>
            )}

            {/* Action Buttons */}
            {status === "checked_in" && (
              <button
                type="button"
                onClick={() => setShowCheckoutDialog(true)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                {t("checkOutGuest")}
              </button>
            )}

            {/* Guest Book */}
            {(reservation as any)?.guest_id && (
              <button
                type="button"
                onClick={handleAddToBook}
                disabled={inBook || addingToBook}
                className={`w-full px-3 py-2 text-sm rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                  inBook
                    ? "bg-[#EAF0E6] border border-[#C5D6BC] text-[#4A6740] cursor-default"
                    : "bg-[#3A5F82] hover:bg-[#31506E] text-white disabled:opacity-50"
                }`}
              >
                {inBook ? t("registeredInBook") : addingToBook ? t("addingToBook") : t("addToBook")}
              </button>
            )}

            {/* Payment Section */}
            <div className="rounded-xl border border-[#C5D6BC] bg-[#E0EADB]/30 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6740] mb-1">{t("paymentFolio")}</p>

              {/* Folio ledger — one segment per date range. Adding a bed to the
                  same dates joins the existing line (rate × nights × beds);
                  only a different date range (a real extension) gets its own. */}
              {(() => {
                const items: any[] = reservation?.reservation_items ?? [];
                const paid = Number(paidAmount) || 0;
                const deposit = Number(depositAmount) || 0;
                const fmt = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

                type FolioGroup = { label: string; items: any[]; nights: number; beds: number; rate: number; from: string; to: string };
                const sorted = [...items].sort((a, b) =>
                  new Date(a.check_in).getTime() - new Date(b.check_in).getTime() ||
                  new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
                );
                const byRange = new Map<string, FolioGroup>();
                for (const item of sorted) {
                  const key = `${item.check_in}|${item.check_out}`;
                  const nights = item.check_in && item.check_out
                    ? Math.max(1, Math.round((new Date(item.check_out).getTime() - new Date(item.check_in).getTime()) / 86400000)) : 1;
                  const g = byRange.get(key);
                  if (g) {
                    g.items.push(item);
                    g.beds += 1;
                    g.rate = Number(item.price_per_night);
                  } else {
                    byRange.set(key, {
                      label: "", items: [item], nights, beds: 1,
                      rate: Number(item.price_per_night),
                      from: item.check_in, to: item.check_out,
                    });
                  }
                }
                const groups = Array.from(byRange.values());
                groups.forEach((g, gi) => { g.label = gi === 0 ? t("originalStay") : t("extensionN", { n: gi }); });

                // Total derived from current edited rates (live, not from DB)
                const totalCharged = groups.length > 0
                  ? groups.reduce((sum, g, gi) => sum + (Number(segmentRates[gi] ?? g.rate) || 0) * g.nights * g.beds, 0)
                  : Number(reservation?.total_amount ?? 0);
                const balance = totalCharged - paid;

                return (
                  <div className="rounded-lg bg-surface border border-[#D8E3D1] overflow-hidden text-xs">
                    {groups.map((group, gi) => {
                      const itemIds = group.items.map((i: any) => i.id);
                      const editedRate = segmentRates[gi] ?? String(group.rate);
                      const previewSubtotal = (Number(editedRate) || 0) * group.nights * group.beds;
                      const isSaving = savingSegment === gi;
                      const isExtension = gi > 0;

                      return (
                        <div key={gi} className={`border-b border-[#D8E3D1] last:border-0 ${isExtension ? "bg-[#E0EADB]/30" : ""}`}>
                          {/* Segment label */}
                          <div className="flex items-center justify-between px-3 pt-2 pb-0.5">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isExtension ? "text-accent" : "text-[#4A6740]"}`}>
                              {isExtension ? `⤷ ${group.label}` : group.label}
                            </span>
                            {isSaving && <span className="text-[10px] text-muted-foreground italic">{t("savingSegment")}</span>}
                          </div>
                          {/* Segment detail row — wraps on narrow screens:
                              dates on their own line, rate + subtotal below. */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-2">
                            {/* Date range + nights */}
                            <span className="text-muted-foreground basis-full sm:basis-0 sm:flex-1 whitespace-nowrap">
                              {fmt(group.from)} → {fmt(group.to)}
                              <span className="ml-1 text-foreground font-medium">
                                ({group.nights}n{group.beds > 1 ? ` × ${t("bedsTimes", { count: group.beds })}` : ""})
                              </span>
                            </span>
                            {/* Editable rate */}
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">{paymentCurrency}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editedRate}
                                onChange={(e) => setSegmentRates(prev => ({ ...prev, [gi]: e.target.value }))}
                                onBlur={() => handleSegmentRateBlur(gi, itemIds, editedRate)}
                                disabled={isSaving}
                                className="w-16 rounded border border-[#C5D6BC] bg-surface px-1.5 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#8CA378] disabled:opacity-50"
                              />
                              <span className="text-muted-foreground">/n</span>
                            </div>
                            {/* Subtotal */}
                            <span className="font-semibold text-foreground ml-auto text-right whitespace-nowrap">
                              {paymentCurrency} {previewSubtotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Totals */}
                    <div className="bg-[#EAF0E6] px-3 pt-2 pb-2 space-y-1.5 border-t border-[#C5D6BC]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("totalCharged")}</span>
                        <span className="font-semibold text-foreground">{paymentCurrency} {totalCharged.toFixed(2)}</span>
                      </div>
                      {deposit > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("depositHeld")}</span>
                          <span className="font-medium text-[#3A5F82]">{depositCurrency} {deposit.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("amountPaid")}</span>
                        <span className="font-medium text-[#4A6740]">{paymentCurrency} {paid.toFixed(2)}</span>
                      </div>
                      <div className={`flex justify-between pt-1 border-t border-[#C5D6BC] font-bold text-sm ${balance > 0 ? "text-red-600" : "text-[#4A6740]"}`}>
                        <span>{balance > 0 ? t("balanceDue") : t("settled")}</span>
                        <span>{paymentCurrency} {Math.abs(balance).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Currency + payment method row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#4A6740]">{t("currency")}</label>
                  <select
                    value={paymentCurrency}
                    onChange={(e) => setPaymentCurrency(e.target.value)}
                    className="w-full rounded-lg border border-[#C5D6BC] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8CA378]"
                  >
                    {["EUR", "USD", "GBP", "RSD", "CHF", "SEK", "NOK", "DKK"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#4A6740]">{t("paymentMethod")}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-[#C5D6BC] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8CA378]"
                  >
                    <option value="">{t("selectMethod")}</option>
                    <option value="card">{t("method_card")}</option>
                    <option value="cash">{t("method_cash")}</option>
                    <option value="bank_transfer">{t("method_bank_transfer")}</option>
                    <option value="other">{t("method_other")}</option>
                  </select>
                </div>
              </div>

              {/* Confirmed toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-foreground">{t("paymentConfirmed")}</span>
                <button
                  type="button"
                  onClick={() => setPaymentConfirmed((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#5F7048] ${paymentConfirmed ? "bg-[#5F7048]" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow transition-transform ${paymentConfirmed ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </label>

              {/* Amount paid */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#4A6740]">{t("amountPaidLabel")}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder={`${Number(reservation?.total_amount ?? 0).toFixed(2)}`}
                  className="w-full rounded-lg border border-[#C5D6BC] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8CA378]"
                />
              </div>

              {/* Deposit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#4A6740]">{t("deposit")}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-[#C5D6BC] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8CA378]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#4A6740]">{t("depositCurrency")}</label>
                  <select
                    value={depositCurrency}
                    onChange={(e) => setDepositCurrency(e.target.value)}
                    className="w-full rounded-lg border border-[#C5D6BC] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8CA378]"
                  >
                    {["EUR", "USD", "GBP", "RSD", "CHF", "SEK", "NOK", "DKK"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actual arrival / departure */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#4A6740]">{t("actualArrival")}</label>
                  <input
                    type="datetime-local"
                    value={actualCheckIn}
                    onChange={(e) => setActualCheckIn(e.target.value)}
                    className="w-full rounded-lg border border-[#C5D6BC] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8CA378]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#4A6740]">{t("actualDeparture")}</label>
                  <input
                    type="datetime-local"
                    value={actualCheckOut}
                    onChange={(e) => setActualCheckOut(e.target.value)}
                    className="w-full rounded-lg border border-[#C5D6BC] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8CA378]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSavePayment}
                disabled={isSavingPayment}
                className="w-full px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isSavingPayment ? t("savingPayment") : t("savePaymentInfo")}
              </button>

              {/* Extend Stay */}
              <div className="pt-1 border-t border-[#C5D6BC]">
                <button
                  type="button"
                  onClick={() => {
                    setShowExtend((v) => !v);
                    if (!extendRate && reservation?.reservation_items?.length) {
                      const items: any[] = reservation.reservation_items;
                      const lastRate = items[items.length - 1]?.price_per_night;
                      if (lastRate) setExtendRate(String(lastRate));
                    }
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#A9BF9C] text-[#4A6740] hover:bg-[#DCE7D4] transition-colors font-medium"
                >
                  {showExtend ? t("cancelExtension") : t("extendStay")}
                </button>

                {showExtend && (() => {
                  const currentCheckOut = reservation?.check_out ?? "";
                  const extNights = extendDate && currentCheckOut
                    ? Math.max(0, Math.round((new Date(extendDate).getTime() - new Date(currentCheckOut).getTime()) / 86400000))
                    : 0;
                  const extTotal = extNights * (Number(extendRate) || 0);
                  const newTotal = Number(reservation?.total_amount ?? 0) + extTotal;
                  const paid = Number(paidAmount) || 0;
                  const newBalance = newTotal - paid;

                  return (
                    <div className="mt-2 rounded-lg border border-[#C5D6BC] bg-surface p-3 space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#4A6740]">
                        {t("currentCheckOut", { date: currentCheckOut ? new Date(currentCheckOut + "T00:00:00").toLocaleDateString() : "—" })}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#4A6740]">{t("newCheckOut")}</label>
                          <input
                            type="date"
                            value={extendDate}
                            min={currentCheckOut}
                            onChange={(e) => setExtendDate(e.target.value)}
                            className="w-full rounded-lg border border-[#C5D6BC] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8CA378]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#4A6740]">{t("ratePerNight")}</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={extendRate}
                            onChange={(e) => setExtendRate(e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-lg border border-[#C5D6BC] bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8CA378]"
                          />
                        </div>
                      </div>

                      {extNights > 0 && (
                        <div className="rounded-lg bg-[#EAF0E6] border border-[#C5D6BC] p-2.5 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("extension")}</span>
                            <span className="font-medium">{t("extensionCalc", { nights: extNights, currency: paymentCurrency, rate: Number(extendRate).toFixed(2), total: `${paymentCurrency} ${extTotal.toFixed(2)}` })}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-[#C5D6BC]">
                            <span className="text-muted-foreground">{t("newTotal")}</span>
                            <span className="font-bold text-foreground">{paymentCurrency} {newTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("paidSoFar")}</span>
                            <span className="text-[#4A6740] font-medium">{paymentCurrency} {paid.toFixed(2)}</span>
                          </div>
                          <div className={`flex justify-between font-bold ${newBalance > 0 ? "text-red-600" : "text-[#4A6740]"}`}>
                            <span>{newBalance > 0 ? t("newBalanceDue") : t("settled")}</span>
                            <span>{paymentCurrency} {Math.abs(newBalance).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleExtend}
                        disabled={isExtending || !extendDate || !extendRate || extNights === 0}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors font-medium"
                      >
                        {isExtending ? t("extending") : extNights > 0 ? t("confirmExtensionWithNights", { nights: extNights }) : t("confirmExtension")}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Delete button — danger zone */}
            <div className="p-3 rounded-lg border border-red-200 bg-red-50/40 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-1">{t("dangerZone")}</p>
              <button
                type="button"
                onClick={() => setShowCancelDialog(true)}
                className="w-full text-sm font-medium text-red-600 hover:text-red-700 transition-colors duration-150 px-3 py-2 rounded border border-red-200 hover:bg-red-100 flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                {t("cancelReservation")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full text-sm font-medium text-red-600 hover:text-red-700 transition-colors duration-150 disabled:opacity-50"
              >
                {isDeleting ? t("deleting") : t("deleteReservation")}
              </button>
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
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {isSubmitting ? t("saving") : t("saveChanges")}
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
              roomName={reservation.reservation_items?.[0]?.beds?.rooms?.name || t("unknownRoom")}
              bedName={reservation.reservation_items?.[0]?.beds?.name || t("unknownRoom")}
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

          {/* Guest Dialog (primary guest) */}
          {showGuestDialog && (
            <GuestDialog
              open={showGuestDialog}
              onOpenChange={setShowGuestDialog}
              guestId={reservation.guest_id}
              orgId={reservation.organization_id}
              onGuestUpdated={() => setReservation((prev: any) => ({ ...prev }))}
              onGuestCreated={() => setShowGuestDialog(false)}
              shiftLeft
            />
          )}

          {/* Guest Dialog (companion: edit existing or create new to add) */}
          {(companionEditId || creatingCompanion) && (
            <GuestDialog
              open={!!companionEditId || creatingCompanion}
              onOpenChange={(o) => { if (!o) { setCompanionEditId(null); setCreatingCompanion(false); } }}
              guestId={companionEditId ?? undefined}
              orgId={reservation.organization_id}
              onGuestUpdated={() => { loadCompanions(reservationId); }}
              onGuestCreated={(id) => { setCreatingCompanion(false); if (id) addCompanionById(id); }}
              shiftLeft
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
