"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X, ChevronLeft, ChevronRight, BookOpen, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import EditReservationDrawer from "@/components/calendar/edit-reservation-drawer";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { createBrowserClient } from "@/lib/supabase/client";

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string }
> = {
  pending: { bg: "bg-[#F0E6CD]", text: "text-[#8A6A16]" },
  confirmed: { bg: "bg-[#E0EADB]", text: "text-[#4A6740]" },
  checked_in: { bg: "bg-[#DDE7F0]", text: "text-[#3A5F82]" },
  checked_out: { bg: "bg-[#E8E2D4]", text: "text-[#6F6857]" },
  cancelled: { bg: "bg-[#EEDCD5]", text: "text-[#9C4A37]" },
  no_show: { bg: "bg-[#E8E2D4]", text: "text-[#6F6857]" },
};

interface Reservation {
  id: string;
  reservation_number: string;
  check_in: string;
  check_out: string;
  status: string;
  channel: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  guests: {
    first_name: string;
    last_name: string;
  } | null;
  reservation_items: Array<{
    bed_id: string;
    beds: {
      id: string;
      name: string;
      rooms: { id: string; name: string } | null;
    } | null;
  }>;
}

interface ReservationsListClientProps {
  initialReservations: Reservation[];
  totalReservations: number;
  orgId: string;
}

export default function ReservationsListClient({
  initialReservations,
  totalReservations,
  orgId,
}: ReservationsListClientProps) {
  const t = useTranslations("reservations");
  const statusLabels: Record<string, string> = {
    pending: t("statusOptions.pending"),
    confirmed: t("statusOptions.confirmed"),
    checked_in: t("statusOptions.checked_in"),
    checked_out: t("statusOptions.checked_out"),
    cancelled: t("statusOptions.cancelled"),
    no_show: t("statusOptions.no_show"),
  };
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);

  // Re-sync when arriving here with a new ?q= while already mounted on this route
  // (Next.js reuses the page instance on same-route navigations, so initial useState alone misses this)
  useEffect(() => {
    setSearch(initialQuery);
    setDebouncedSearch(initialQuery);
  }, [initialQuery]);
  const [page, setPage] = useState(1);
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [total, setTotal] = useState(totalReservations);
  const [isLoading, setIsLoading] = useState(false);
  const [editResId, setEditResId] = useState<string | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [checkoutWarnings, setCheckoutWarnings] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    status: "",
    checkInFrom: "",
    checkInTo: "",
  });

  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const pageSize = 25;
  const totalPages = Math.ceil(total / pageSize);

  const handleFetch = async (
    searchQuery: string,
    pageNum: number,
    appliedFilters: typeof filters
  ) => {
    setIsLoading(true);
    try {
      // Fetch larger batch when searching to find matches across all data
      const isSearching = searchQuery.trim().length > 0;
      const fetchPage = isSearching ? 1 : pageNum;
      const fetchLimit = isSearching ? 200 : pageSize;

      const params = new URLSearchParams({
        page: String(fetchPage),
        limit: String(fetchLimit),
      });

      if (appliedFilters.status) {
        params.append("status", appliedFilters.status);
      }
      if (appliedFilters.checkInFrom) {
        params.append("check_in_from", appliedFilters.checkInFrom);
      }
      if (appliedFilters.checkInTo) {
        params.append("check_in_to", appliedFilters.checkInTo);
      }

      const res = await fetch(`/api/reservations?${params}`);
      const data = await res.json();

      let results = data.reservations || [];

      // Client-side filter: res #, guest name (first, last, or full), room, bed
      if (searchQuery.trim()) {
        const searchLower = searchQuery.trim().toLowerCase();
        results = results.filter((res: Reservation) => {
          const resNum = res.reservation_number?.toLowerCase() || "";
          const guestFirst = res.guests?.first_name?.toLowerCase() || "";
          const guestLast = res.guests?.last_name?.toLowerCase() || "";
          const fullName = `${guestFirst} ${guestLast}`.toLowerCase();
          const roomName = res.reservation_items?.[0]?.beds?.rooms?.name?.toLowerCase() || "";
          const bedName = res.reservation_items?.[0]?.beds?.name?.toLowerCase() || "";

          return (
            resNum.includes(searchLower) ||
            guestFirst.includes(searchLower) ||
            guestLast.includes(searchLower) ||
            fullName.includes(searchLower) ||
            roomName.includes(searchLower) ||
            bedName.includes(searchLower)
          );
        });

        // Paginate filtered results
        const offset = (pageNum - 1) * pageSize;
        const paginatedResults = results.slice(offset, offset + pageSize);
        setReservations(paginatedResults);
        setTotal(results.length);
      } else {
        // No search - use normal pagination
        const offset = (pageNum - 1) * pageSize;
        const paginatedResults = results.slice(offset, offset + pageSize);
        setReservations(paginatedResults);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch reservations:", error);
      toast.error(t("toasts.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleFetch(debouncedSearch, 1, filters);
    setPage(1);
  }, [debouncedSearch, filters]);

  useEffect(() => {
    handleFetch(debouncedSearch, page, filters);
  }, [page]);

  const handleOpenEdit = (resId: string, warnings: string[] = []) => {
    setCheckoutWarnings(warnings);
    setEditResId(resId);
    setEditDrawerOpen(true);
  };

  const handleRefetch = () => {
    handleFetch(search, page, filters);
  };

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await handleFetch(search, page, filters);
    setRefreshing(false);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  };

  const handleStatusChange = async (resId: string, newStatus: string) => {
    if (newStatus === "checked_in" || newStatus === "checked_out") {
      const supabase = createBrowserClient();
      const { data: resData } = await (supabase as any)
        .from("reservations")
        .select("guest_id, payment_confirmed, paid_amount, total_amount, actual_check_in_at")
        .eq("id", resId)
        .single();

      const totalAmount = Number(resData?.total_amount ?? 0);
      const paidAmount = Number(resData?.paid_amount ?? 0);
      const balanceDue = totalAmount - paidAmount;

      if (newStatus === "checked_in") {
        const missing: string[] = [];
        if (!resData?.guest_id) missing.push(t("toasts.noGuestAssigned"));
        if (totalAmount > 0 && paidAmount < totalAmount)
          missing.push(t("toasts.balanceDueCheckIn", { amount: balanceDue.toFixed(2) }));

        if (missing.length > 0) {
          toast.error(t("toasts.cannotCheckIn"), { duration: 5000 });
          handleOpenEdit(resId, missing);
          return;
        }
      }

      if (newStatus === "checked_out") {
        const missing: string[] = [];
        if (!resData?.guest_id) missing.push(t("toasts.noGuestAssigned"));
        if (balanceDue > 0)
          missing.push(t("toasts.balanceDueCheckOut", { amount: balanceDue.toFixed(2) }));
        if (!resData?.payment_confirmed) missing.push(t("toasts.paymentNotConfirmed"));
        if (!resData?.actual_check_in_at) missing.push(t("toasts.actualCheckInMissing"));

        if (missing.length > 0) {
          toast.error(t("toasts.cannotCheckOut"), { duration: 5000 });
          handleOpenEdit(resId, missing);
          return;
        }
      }
    }

    setUpdatingStatusId(resId);
    try {
      const response = await fetch(`/api/reservations/${resId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || t("toasts.statusUpdateFailed"));
        return;
      }

      setReservations(prev =>
        prev.map(res => (res.id === resId ? { ...res, status: newStatus } : res))
      );
      toast.success(t("toasts.statusUpdated"));
      if (newStatus === "checked_in") {
        handleOpenEdit(resId);
      }
    } catch (error) {
      console.error("Status update error:", error);
      toast.error(t("toasts.statusUpdateFailed"));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const SortIndicator = ({ column }: { column: string }) => {
    const isActive = sortBy === column;
    const iconClass = isActive ? "text-foreground" : "text-muted-foreground/40";

    if (isActive && sortDir === "desc") {
      return <ChevronDown className={`w-4 h-4 inline ml-1 ${iconClass}`} />;
    }
    return <ChevronUp className={`w-4 h-4 inline ml-1 ${iconClass}`} />;
  };

  const sortedReservations = [...reservations].sort((a, b) => {
    if (!sortBy) return 0;

    let aVal: any = a[sortBy as keyof Reservation];
    let bVal: any = b[sortBy as keyof Reservation];

    if (sortBy === "guestName") {
      aVal = `${a.guests?.first_name || ""} ${a.guests?.last_name || ""}`;
      bVal = `${b.guests?.first_name || ""} ${b.guests?.last_name || ""}`;
    }

    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const nights =
    reservations.length > 0
      ? (res: Reservation) => {
          const checkIn = new Date(res.check_in);
          const checkOut = new Date(res.check_out);
          return Math.ceil(
            (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
          );
        }
      : () => 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-sm mt-0.5 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-border bg-background hover:bg-muted disabled:opacity-50 transition-all shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {t("refresh")}
        </button>
      </div>

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-9 py-2 rounded-lg border border-border text-sm bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        {search.length > 0 && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
            title={t("clearSearch")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase">
            {t("status")}
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">{t("allStatuses")}</option>
            <option value="pending">{statusLabels.pending}</option>
            <option value="confirmed">{statusLabels.confirmed}</option>
            <option value="checked_in">{statusLabels.checked_in}</option>
            <option value="checked_out">{statusLabels.checked_out}</option>
            <option value="cancelled">{statusLabels.cancelled}</option>
            <option value="no_show">{statusLabels.no_show}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase">
            {t("checkInFrom")}
          </label>
          <input
            type="date"
            value={filters.checkInFrom}
            onChange={(e) => setFilters({ ...filters, checkInFrom: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase">
            {t("checkInTo")}
          </label>
          <input
            type="date"
            value={filters.checkInTo}
            onChange={(e) => setFilters({ ...filters, checkInTo: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="text-left border-collapse text-sm" style={{ minWidth: "1400px" }}>
            <thead>
              <tr className="bg-muted/50 border-b border-border/70 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                <th className="px-4 py-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort("reservation_number")}>
                  {t("colReservationNumber")} <SortIndicator column="reservation_number" />
                </th>
                <th className="px-4 py-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort("guestName")}>
                  {t("colGuest")} <SortIndicator column="guestName" />
                </th>
                <th className="px-4 py-3.5">{t("colRoomBed")}</th>
                <th className="px-4 py-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort("check_in")}>
                  {t("colCheckIn")} <SortIndicator column="check_in" />
                </th>
                <th className="px-4 py-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort("check_out")}>
                  {t("colCheckOut")} <SortIndicator column="check_out" />
                </th>
                <th className="px-4 py-3.5">{t("colNights")}</th>
                <th className="px-4 py-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort("status")}>
                  {t("colStatus")} <SortIndicator column="status" />
                </th>
                <th className="px-4 py-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort("total_amount")}>
                  {t("colTotal")} <SortIndicator column="total_amount" />
                </th>
                <th className="px-4 py-3.5 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort("paid_amount")}>
                  {t("colPaid")} <SortIndicator column="paid_amount" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-foreground/85">
              {isLoading ? (
                <TableSkeleton rows={5} cols={9} />
              ) : sortedReservations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-0">
                    <EmptyState
                      icon={<BookOpen className="w-8 h-8" />}
                      title={search ? t("noReservationsFound") : t("noReservationsYet")}
                      description={search ? t("noResultsHint") : t("noReservationsHint")}
                    />
                  </td>
                </tr>
              ) : (
                sortedReservations.map((res) => {
                  const firstBed = res.reservation_items?.[0];
                  const roomName = firstBed?.beds?.rooms?.name || "—";
                  // Multi-bed: show the first bed plus how many more (e.g. "101 +3")
                  const distinctBeds = new Set((res.reservation_items ?? []).map((it: any) => it.bed_id)).size;
                  const bedName = firstBed?.beds?.name
                    ? `${firstBed.beds.name}${distinctBeds > 1 ? ` +${distinctBeds - 1}` : ""}`
                    : "—";
                  const daysCount = nights(res);
                  const colors = STATUS_COLORS[res.status] || STATUS_COLORS.pending;

                  return (
                    <tr
                      key={res.id}
                      className="hover:bg-muted/40 cursor-pointer"
                      onClick={() => handleOpenEdit(res.id)}
                    >
                      <td className="px-4 py-3.5 font-mono font-medium text-primary">
                        {res.reservation_number}
                      </td>
                      <td className="px-4 py-3.5">
                        {res.guests
                          ? `${res.guests.first_name} ${res.guests.last_name}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {roomName} / {bedName}
                      </td>
                      <td className="px-4 py-3.5">
                        {new Date(res.check_in).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5">
                        {new Date(res.check_out).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5 text-center">{daysCount}</td>
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={res.status}
                          onChange={(e) => handleStatusChange(res.id, e.target.value)}
                          disabled={updatingStatusId === res.id}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer disabled:opacity-50 ${colors.bg} ${colors.text}`}
                        >
                          <option value="pending">{statusLabels.pending}</option>
                          <option value="confirmed">{statusLabels.confirmed}</option>
                          <option value="checked_in">{statusLabels.checked_in}</option>
                          <option value="checked_out">{statusLabels.checked_out}</option>
                          <option value="cancelled">{statusLabels.cancelled}</option>
                          <option value="no_show">{statusLabels.no_show}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5 font-medium">${res.total_amount.toFixed(2)}</td>
                      <td className={`p-3 text-right font-semibold ${res.total_amount <= 0 || res.paid_amount >= res.total_amount ? "text-[#4A6740]" : res.paid_amount > 0 ? "text-[#8A6A16]" : "text-[#9C4A37]"}`}>
                        ${res.paid_amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("pageOf", { page, totalPages, total })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-border bg-surface hover:bg-muted disabled:opacity-50 transition-colors text-foreground/85"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-border bg-surface hover:bg-muted disabled:opacity-50 transition-colors text-foreground/85"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Reservation Drawer */}
      <EditReservationDrawer
        open={editDrawerOpen}
        onOpenChange={(v) => { setEditDrawerOpen(v); if (!v) setCheckoutWarnings([]); }}
        reservationId={editResId || undefined}
        onReservationUpdated={handleRefetch}
        checkoutWarnings={checkoutWarnings}
      />
    </div>
  );
}
