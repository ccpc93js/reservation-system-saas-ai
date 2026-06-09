"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight, DoorOpen, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import RoomsDialog from "./rooms-dialog";
import { Room } from "@/lib/types/database";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";

interface RoomsListClientProps {
  initialRooms: Room[];
  initialTotal: number;
}

export default function RoomsListClient({
  initialRooms,
  initialTotal,
}: RoomsListClientProps) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
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
      const res = await fetch(`/api/rooms?${params}`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to fetch rooms");
        return;
      }

      setRooms(data.rooms);
      setTotal(data.total);
      setPage(pageNum);
    } catch (error) {
      toast.error("Failed to fetch rooms");
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
    if (!confirm("Are you sure you want to delete this room?")) return;

    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete room");
        return;
      }

      toast.success("Room deleted successfully");
      handleFetch(search, page);
    } catch (error) {
      toast.error("Failed to delete room");
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

  const sortedRooms = [...rooms].sort((a, b) => {
    if (!sortBy) return 0;

    let aVal: any = a[sortBy as keyof Room];
    let bVal: any = b[sortBy as keyof Room];

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
            placeholder="Search rooms..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white disabled:opacity-50"
          />
        </div>
        <button
          onClick={() => {
            setEditingRoomId(null);
            setOpenDialog(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
                Room Name <SortIndicator column="name" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-sm cursor-pointer hover:bg-gray-100" onClick={() => handleSort("floor")}>
                Floor <SortIndicator column="floor" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-sm">Room Type</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Beds</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : (
              sortedRooms.map((room) => {
              const roomType = (room as any).room_types;
              return (
                <tr key={room.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{room.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {roomType ? `${roomType.name} (${roomType.type})` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">{room.floor || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {(room as any).bed_count || 0}
                  </td>
                  <td className="px-4 py-3 text-sm flex gap-2">
                    <button
                      onClick={() => {
                        setEditingRoomId(room.id);
                        setOpenDialog(true);
                      }}
                      disabled={isLoading}
                      className="p-2 hover:bg-gray-200 rounded disabled:opacity-50"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id)}
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

      {rooms.length === 0 && (
        <EmptyState
          icon={<DoorOpen className="w-8 h-8" />}
          title={search ? "No rooms found" : "No rooms yet"}
          description={
            search
              ? "Try adjusting your search to find the room you're looking for."
              : "Start by creating your first room and assigning it to a room type."
          }
          action={
            !search && (
              <button
                onClick={() => {
                  setEditingRoomId(null);
                  setOpenDialog(true);
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Create a room →
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

      <RoomsDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        roomId={editingRoomId}
        onRoomCreated={handleRefetch}
        onRoomUpdated={handleRefetch}
      />
    </div>
  );
}
