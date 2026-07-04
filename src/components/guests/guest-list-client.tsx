"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight, Users, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import GuestDialog from "@/components/guests/guest-dialog";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  created_at: string;
}

interface GuestListClientProps {
  initialGuests: Guest[];
  totalGuests: number;
  orgId: string;
}

export default function GuestListClient({
  initialGuests,
  totalGuests,
  orgId,
}: GuestListClientProps) {
  const t = useTranslations("guests");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [total, setTotal] = useState(totalGuests);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const pageSize = 25;
  const totalPages = Math.ceil(total / pageSize);

  const handleFetch = async (searchQuery: string, pageNum: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search: searchQuery.trim(),
        page: String(pageNum),
        limit: String(pageSize),
      });
      const res = await fetch(`/api/guests?${params}`);
      const data = await res.json();
      setGuests(data.guests || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch guests:", error);
      toast.error(t("toastLoadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleFetch(search, 1);
    setPage(1);
  }, [search]);

  useEffect(() => {
    handleFetch(search, page);
  }, [page]);

  const handleOpenCreate = () => {
    setEditingGuestId(null);
    setOpenDialog(true);
  };

  const handleOpenEdit = (guestId: string) => {
    setEditingGuestId(guestId);
    setOpenDialog(true);
  };

  const handleDelete = async (guestId: string) => {
    if (!confirm(t("confirmDelete"))) return;

    try {
      const res = await fetch(`/api/guests/${guestId}`, {
        method: "DELETE",
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || t("toastDeleteFailed"));
        return;
      }

      toast.success(t("toastDeleted"));
      handleFetch(search, page);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(t("toastDeleteError"));
    }
  };

  const handleRefetch = () => {
    handleFetch(search, page);
    setOpenDialog(false);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("asc");
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

  const sortedGuests = [...guests].sort((a, b) => {
    if (!sortBy) return 0;

    let aVal: any = a[sortBy as keyof Guest];
    let bVal: any = b[sortBy as keyof Guest];

    if (sortBy === "full_name") {
      aVal = `${a.first_name} ${a.last_name}`;
      bVal = `${b.first_name} ${b.last_name}`;
    }

    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-sm mt-0.5 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => { setRefreshing(true); await handleFetch(search, page); setRefreshing(false); }}
            disabled={refreshing || isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {t("refresh")}
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("newGuest")}
          </button>
        </div>
      </div>

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-border text-sm bg-surface text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border/70 text-muted-foreground font-medium">
                <th className="p-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("full_name")}>
                  {t("colName")} <SortIndicator column="full_name" />
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("email")}>
                  {t("colEmail")} <SortIndicator column="email" />
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("phone")}>
                  {t("colPhone")} <SortIndicator column="phone" />
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("nationality")}>
                  {t("colNationality")} <SortIndicator column="nationality" />
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("created_at")}>
                  {t("colCreated")} <SortIndicator column="created_at" />
                </th>
                <th className="p-3 text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-foreground/85">
              {isLoading ? (
                <TableSkeleton rows={5} cols={6} />
              ) : guests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-0">
                    <EmptyState
                      icon={<Users className="w-8 h-8" />}
                      title={search ? t("noGuestsFound") : t("noGuestsYet")}
                      description={
                        search
                          ? t("noGuestsFoundHint")
                          : t("noGuestsYetHint")
                      }
                      action={
                        !search && (
                          <button
                            onClick={() => {
                              setEditingGuestId(null);
                              setOpenDialog(true);
                            }}
                            className="text-sm font-medium text-primary hover:text-primary/80"
                          >
                            {t("createGuestCta")}
                          </button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                sortedGuests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-muted/40">
                    <td className="p-3 font-medium text-foreground">
                      {guest.first_name} {guest.last_name}
                    </td>
                    <td className="p-3 text-foreground/85">{guest.email || "—"}</td>
                    <td className="p-3 text-foreground/85">{guest.phone || "—"}</td>
                    <td className="p-3 text-foreground/85">{guest.nationality || "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(guest.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(guest.id)}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                          title={t("editGuestTitle")}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(guest.id)}
                          className="p-1.5 rounded hover:bg-red-100 transition-colors text-muted-foreground hover:text-red-600"
                          title={t("deleteGuestTitle")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

      {/* Guest Dialog */}
      <GuestDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        guestId={editingGuestId || undefined}
        orgId={orgId}
        onGuestCreated={handleRefetch}
        onGuestUpdated={handleRefetch}
      />
    </div>
  );
}
