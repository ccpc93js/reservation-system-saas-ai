"use client";

import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import EditReservationDrawer from "@/components/calendar/edit-reservation-drawer";

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string }
> = {
  pending: { bg: "bg-amber-100", text: "text-amber-700" },
  confirmed: { bg: "bg-emerald-100", text: "text-emerald-700" },
  checked_in: { bg: "bg-indigo-100", text: "text-indigo-700" },
  checked_out: { bg: "bg-slate-100", text: "text-slate-600" },
  cancelled: { bg: "bg-red-100", text: "text-red-700" },
  no_show: { bg: "bg-gray-100", text: "text-gray-600" },
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [total, setTotal] = useState(totalReservations);
  const [isLoading, setIsLoading] = useState(false);
  const [editResId, setEditResId] = useState<string | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  const [filters, setFilters] = useState({
    status: "",
    checkInFrom: "",
    checkInTo: "",
  });

  const pageSize = 25;
  const totalPages = Math.ceil(total / pageSize);

  const handleFetch = async (
    searchQuery: string,
    pageNum: number,
    appliedFilters: typeof filters
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search: searchQuery.trim(),
        page: String(pageNum),
        limit: String(pageSize),
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
      setReservations(data.reservations || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch reservations:", error);
      toast.error("Failed to load reservations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleFetch(search, 1, filters);
    setPage(1);
  }, [search, filters]);

  useEffect(() => {
    handleFetch(search, page, filters);
  }, [page]);

  const handleOpenEdit = (resId: string) => {
    setEditResId(resId);
    setEditDrawerOpen(true);
  };

  const handleRefetch = () => {
    handleFetch(search, page, filters);
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reservations</h1>
          <p className="text-sm mt-0.5 text-muted-foreground">
            Search and filter all reservations
          </p>
        </div>
      </div>

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by reservation #, guest name, room, bed..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-border text-sm bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-surface text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="checked_out">Checked Out</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase">
            Check-in From
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
            Check-in To
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
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border/70 text-muted-foreground font-medium">
                <th className="p-3">Reservation #</th>
                <th className="p-3">Guest</th>
                <th className="p-3">Room / Bed</th>
                <th className="p-3">Check-in</th>
                <th className="p-3">Check-out</th>
                <th className="p-3">Nights</th>
                <th className="p-3">Status</th>
                <th className="p-3">Total</th>
                <th className="p-3 text-right">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-foreground/85">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center">
                    <p className="text-muted-foreground">Loading...</p>
                  </td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center">
                    <p className="text-muted-foreground">
                      {search ? "No reservations found" : "No reservations"}
                    </p>
                  </td>
                </tr>
              ) : (
                reservations.map((res) => {
                  const firstBed = res.reservation_items?.[0];
                  const roomName = firstBed?.beds?.rooms?.name || "—";
                  const bedName = firstBed?.beds?.name || "—";
                  const daysCount = nights(res);
                  const colors = STATUS_COLORS[res.status] || STATUS_COLORS.pending;

                  return (
                    <tr
                      key={res.id}
                      className="hover:bg-muted/40 cursor-pointer"
                      onClick={() => handleOpenEdit(res.id)}
                    >
                      <td className="p-3 font-mono font-medium text-indigo-600">
                        {res.reservation_number}
                      </td>
                      <td className="p-3">
                        {res.guests
                          ? `${res.guests.first_name} ${res.guests.last_name}`
                          : "—"}
                      </td>
                      <td className="p-3">
                        {roomName} / {bedName}
                      </td>
                      <td className="p-3">
                        {new Date(res.check_in).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        {new Date(res.check_out).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-center">{daysCount}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {res.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3 font-medium">${res.total_amount.toFixed(2)}</td>
                      <td className="p-3 text-right">${res.paid_amount.toFixed(2)}</td>
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
            Page {page} of {totalPages} ({total} reservations)
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
        onOpenChange={setEditDrawerOpen}
        reservationId={editResId || undefined}
        onReservationUpdated={handleRefetch}
      />
    </div>
  );
}
