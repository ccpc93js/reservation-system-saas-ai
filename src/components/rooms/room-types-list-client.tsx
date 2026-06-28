"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight, LayoutGrid, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import RoomTypeDialog from "./room-types-dialog";
import { RoomType } from "@/lib/types/database";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";

interface RoomTypesListClientProps {
  initialRoomTypes: RoomType[];
  initialTotal: number;
}

export default function RoomTypesListClient({
  initialRoomTypes,
  initialTotal,
}: RoomTypesListClientProps) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>(initialRoomTypes);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRoomTypeId, setEditingRoomTypeId] = useState<string | null>(null);
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
      const res = await fetch(`/api/room-types?${params}`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to fetch room types");
        return;
      }

      setRoomTypes(data.room_types);
      setTotal(data.total);
      setPage(pageNum);
    } catch (error) {
      toast.error("Failed to fetch room types");
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
    if (!confirm("Are you sure you want to delete this room type?")) return;

    try {
      const res = await fetch(`/api/room-types/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete room type");
        return;
      }

      toast.success("Room type deleted successfully");
      handleFetch(search, page);
    } catch (error) {
      toast.error("Failed to delete room type");
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

  const sortedRoomTypes = [...roomTypes].sort((a, b) => {
    if (!sortBy) return 0;

    let aVal: any = a[sortBy as keyof RoomType];
    let bVal: any = b[sortBy as keyof RoomType];

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
            placeholder="Search room types..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white disabled:opacity-50"
          />
        </div>
        <button
          onClick={() => {
            setEditingRoomTypeId(null);
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
                Name <SortIndicator column="name" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-sm cursor-pointer hover:bg-gray-100" onClick={() => handleSort("type")}>
                Type <SortIndicator column="type" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-sm cursor-pointer hover:bg-gray-100" onClick={() => handleSort("capacity")}>
                Capacity <SortIndicator column="capacity" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-sm cursor-pointer hover:bg-gray-100" onClick={() => handleSort("base_price")}>
                Base Price <SortIndicator column="base_price" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-sm">Rooms</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : (
              sortedRoomTypes.map((roomType) => (
              <tr key={roomType.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{roomType.name}</td>
                <td className="px-4 py-3 text-sm capitalize">{roomType.type}</td>
                <td className="px-4 py-3 text-sm">{roomType.capacity}</td>
                <td className="px-4 py-3 text-sm">${roomType.base_price.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm">
                  {(roomType as any).room_count || 0}
                </td>
                <td className="px-4 py-3 text-sm flex gap-2">
                  <button
                    onClick={() => {
                      setEditingRoomTypeId(roomType.id);
                      setOpenDialog(true);
                    }}
                    disabled={isLoading}
                    className="p-2 hover:bg-gray-200 rounded disabled:opacity-50"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(roomType.id)}
                    disabled={isLoading}
                    className="p-2 hover:bg-red-100 text-red-600 rounded disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {roomTypes.length === 0 && (
        <EmptyState
          icon={<LayoutGrid className="w-8 h-8" />}
          title={search ? "No room types found" : "No room types yet"}
          description={
            search
              ? "Try adjusting your search to find the room type you're looking for."
              : "Define room types to categorize your rooms (e.g., Dorm, Private, Suite)."
          }
          action={
            !search && (
              <button
                onClick={() => {
                  setEditingRoomTypeId(null);
                  setOpenDialog(true);
                }}
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                Create a room type →
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

      <RoomTypeDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        roomTypeId={editingRoomTypeId}
        onRoomTypeCreated={handleRefetch}
        onRoomTypeUpdated={handleRefetch}
      />
    </div>
  );
}
