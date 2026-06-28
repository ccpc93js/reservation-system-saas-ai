"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight, Bed as BedIcon, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import BedsDialog from "./beds-dialog";
import { Bed } from "@/lib/types/database";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";

interface BedsListClientProps {
  initialBeds: Bed[];
  initialTotal: number;
}

export default function BedsListClient({
  initialBeds,
  initialTotal,
}: BedsListClientProps) {
  const [beds, setBeds] = useState<Bed[]>(initialBeds);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBedId, setEditingBedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const pageSize = 25;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    handleFetch(search, 1);
  }, []);

  const handleFetch = async (searchQuery: string, pageNum: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search: searchQuery.trim(),
        page: String(pageNum),
        limit: String(pageSize),
      });
      const res = await fetch(`/api/beds?${params}`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to fetch beds");
        return;
      }

      setBeds(data.beds);
      setTotal(data.total);
      setPage(pageNum);
    } catch (error) {
      toast.error("Failed to fetch beds");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    handleFetch(value, 1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bed?")) return;

    try {
      const res = await fetch(`/api/beds/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete bed");
        return;
      }

      toast.success("Bed deleted successfully");
      handleFetch(search, page);
    } catch (error) {
      toast.error("Failed to delete bed");
      console.error(error);
    }
  };

  const handleRefetch = () => {
    handleFetch(search, page);
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

  const sortedBeds = [...beds].sort((a, b) => {
    if (!sortBy) return 0;

    let aVal: any = a[sortBy as keyof Bed];
    let bVal: any = b[sortBy as keyof Bed];

    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search beds..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white disabled:opacity-50"
          />
        </div>
        <button
          onClick={() => {
            setEditingBedId(null);
            setOpenDialog(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          disabled={isLoading}
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-sm cursor-pointer hover:bg-gray-100" onClick={() => handleSort("name")}>
                Bed Name <SortIndicator column="name" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-sm cursor-pointer hover:bg-gray-100" onClick={() => handleSort("room_id")}>
                Room <SortIndicator column="room_id" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-sm">Type</th>
              <th className="px-4 py-3 text-left font-medium text-sm cursor-pointer hover:bg-gray-100" onClick={() => handleSort("is_active")}>
                Status <SortIndicator column="is_active" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : (
              sortedBeds.map((bed) => {
              const room = (bed as any).rooms;
              const roomType = room?.room_types;
              return (
                <tr key={bed.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{bed.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {room ? `${room.name}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {roomType ? roomType.type : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        bed.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {bed.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm flex gap-2">
                    <button
                      onClick={() => {
                        setEditingBedId(bed.id);
                        setOpenDialog(true);
                      }}
                      disabled={isLoading}
                      className="p-2 hover:bg-gray-200 rounded disabled:opacity-50"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(bed.id)}
                      disabled={isLoading}
                      className="p-2 hover:bg-red-100 text-red-600 rounded disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>

      {beds.length === 0 && (
        <EmptyState
          icon={<BedIcon className="w-8 h-8" />}
          title={search ? "No beds found" : "No beds yet"}
          description={
            search
              ? "Try adjusting your search to find the bed you're looking for."
              : "Create a room first, then add beds to it."
          }
          action={
            !search && (
              <button
                onClick={() => {
                  setEditingBedId(null);
                  setOpenDialog(true);
                }}
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                Create a bed →
              </button>
            )
          }
        />
      )}

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleFetch(search, page - 1)}
            disabled={page === 1 || isLoading}
            className="p-2 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleFetch(search, page + 1)}
            disabled={page >= totalPages || isLoading}
            className="p-2 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <BedsDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        bedId={editingBedId}
        onBedCreated={handleRefetch}
        onBedUpdated={handleRefetch}
      />
    </div>
  );
}
