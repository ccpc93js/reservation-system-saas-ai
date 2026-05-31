"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import RoomsDialog from "./rooms-dialog";
import { Room } from "@/lib/types/database";

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
              <th className="px-4 py-3 text-left font-medium text-sm">Room Name</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Room Type</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Floor</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Beds</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
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
            })}
          </tbody>
        </table>
      </div>

      {rooms.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No rooms found
        </div>
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
