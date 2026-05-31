"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createRoomSchema, updateRoomSchema } from "@/lib/validations/room";
import { RoomType, Room } from "@/lib/types/database";

interface RoomsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId?: string | null;
  onRoomCreated?: () => void;
  onRoomUpdated?: () => void;
}

export default function RoomsDialog({
  open,
  onOpenChange,
  roomId,
  onRoomCreated,
  onRoomUpdated,
}: RoomsDialogProps) {
  const isEditing = !!roomId;
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm({
    resolver: yupResolver(isEditing ? updateRoomSchema : createRoomSchema),
    defaultValues: {
      room_type_id: "",
      name: "",
      floor: undefined,
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      fetchRoomTypes();
      if (isEditing) {
        fetchRoom();
      } else {
        reset();
      }
    }
  }, [open, isEditing]);

  const fetchRoomTypes = async () => {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
      });
      const res = await fetch(`/api/room-types?${params}`);
      const data = await res.json();

      if (res.ok) {
        setRoomTypes(data.room_types);
      }
    } catch (error) {
      console.error("Failed to fetch room types:", error);
    }
  };

  const fetchRoom = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      const room = await res.json();

      if (!res.ok) {
        toast.error("Failed to load room");
        return;
      }

      reset({
        room_type_id: room.room_type_id,
        name: room.name,
        floor: room.floor ?? undefined,
        notes: room.notes || "",
      });
    } catch (error) {
      toast.error("Failed to load room");
      console.error(error);
    }
  };

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing
        ? `/api/rooms/${roomId}`
        : "/api/rooms/create";
      const method = isEditing ? "PATCH" : "POST";

      const payload = {
        room_type_id: data.room_type_id,
        name: data.name,
        floor: Number.isFinite(data.floor) ? data.floor : null,
        notes: data.notes || null,
      };

      const res = await fetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();

      if (!res.ok) {
        toast.error(responseData.error || "Failed to save room");
        return;
      }

      toast.success(
        isEditing ? "Room updated successfully" : "Room created successfully"
      );
      onOpenChange(false);
      reset();

      if (isEditing && onRoomUpdated) {
        onRoomUpdated();
      } else if (!isEditing && onRoomCreated) {
        onRoomCreated();
      }
    } catch (error) {
      toast.error("Failed to save room");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this room?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to delete room");
        return;
      }

      toast.success("Room deleted successfully");
      onOpenChange(false);
      reset();

      if (onRoomUpdated) {
        onRoomUpdated();
      }
    } catch (error) {
      toast.error("Failed to delete room");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-surface border border-border rounded-lg shadow-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto z-50">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-xl font-bold">
              {isEditing ? "Edit Room" : "Create Room"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-muted rounded transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Room Type */}
            <div>
              <label className="block text-sm font-medium mb-1">Room Type *</label>
              <select
                {...register("room_type_id")}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.room_type_id ? "border-red-500" : "border-border"
                } disabled:opacity-50`}
                disabled={isLoading || isDeleting}
              >
                <option value="">Select room type</option>
                {roomTypes.map((roomType) => (
                  <option key={roomType.id} value={roomType.id}>
                    {roomType.name} ({roomType.type})
                  </option>
                ))}
              </select>
              {errors.room_type_id && (
                <p className="text-red-500 text-sm mt-1">{errors.room_type_id.message}</p>
              )}
            </div>

            {/* Room Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Room Name *</label>
              <input
                type="text"
                placeholder="e.g., Room 101"
                {...register("name")}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.name ? "border-red-500" : "border-border"
                } disabled:opacity-50`}
                disabled={isLoading || isDeleting}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Floor */}
            <div>
              <label className="block text-sm font-medium mb-1">Floor (optional)</label>
              <input
                type="number"
                placeholder="e.g., 1"
                {...register("floor", { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
                disabled={isLoading || isDeleting}
              />
              {errors.floor && (
                <p className="text-red-500 text-sm mt-1">{errors.floor.message}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <textarea
                placeholder="Room notes"
                {...register("notes")}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
                disabled={isLoading || isDeleting}
              />
              {errors.notes && (
                <p className="text-red-500 text-sm mt-1">{errors.notes.message}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between pt-4 border-t border-border">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isLoading || isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={isLoading || isDeleting}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={isLoading || isDeleting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
