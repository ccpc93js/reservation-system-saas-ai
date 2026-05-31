"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import RoomTypeDialog from "./room-types-dialog";
import { RoomType } from "@/lib/types/database";

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
              <th className="px-4 py-3 text-left font-medium text-sm">Name</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Type</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Capacity</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Base Price</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Rooms</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((roomType) => (
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
            ))}
          </tbody>
        </table>
      </div>

      {roomTypes.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No room types found
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
