"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createRoomTypeSchema, updateRoomTypeSchema } from "@/lib/validations/room";
import { RoomType } from "@/lib/types/database";

interface RoomTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTypeId?: string | null;
  onRoomTypeCreated?: () => void;
  onRoomTypeUpdated?: () => void;
}

const ROOM_TYPES = [
  { value: "dorm", label: "Dorm" },
  { value: "private", label: "Private" },
];

const GENDERS = [
  { value: "", label: "None" },
  { value: "mixed", label: "Mixed" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export default function RoomTypeDialog({
  open,
  onOpenChange,
  roomTypeId,
  onRoomTypeCreated,
  onRoomTypeUpdated,
}: RoomTypeDialogProps) {
  const isEditing = !!roomTypeId;
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm({
    resolver: yupResolver(isEditing ? updateRoomTypeSchema : createRoomTypeSchema),
    defaultValues: {
      name: "",
      type: "dorm",
      gender: "",
      capacity: 1,
      base_price: 0,
      description: "",
    },
  });

  useEffect(() => {
    if (open && isEditing) {
      fetchRoomType();
    } else if (open) {
      reset();
    }
  }, [open, isEditing]);

  const fetchRoomType = async () => {
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}`);
      const roomType = await res.json();

      if (!res.ok) {
        toast.error("Failed to load room type");
        return;
      }

      reset({
        name: roomType.name,
        type: roomType.type,
        gender: roomType.gender || "",
        capacity: roomType.capacity,
        base_price: roomType.base_price,
        description: roomType.description || "",
      });
    } catch (error) {
      toast.error("Failed to load room type");
      console.error(error);
    }
  };

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing
        ? `/api/room-types/${roomTypeId}`
        : "/api/room-types/create";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        body: JSON.stringify(data),
      });

      const responseData = await res.json();

      if (!res.ok) {
        toast.error(responseData.error || "Failed to save room type");
        return;
      }

      toast.success(
        isEditing ? "Room type updated successfully" : "Room type created successfully"
      );
      onOpenChange(false);
      reset();

      if (isEditing && onRoomTypeUpdated) {
        onRoomTypeUpdated();
      } else if (!isEditing && onRoomTypeCreated) {
        onRoomTypeCreated();
      }
    } catch (error) {
      toast.error("Failed to save room type");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this room type?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to delete room type");
        return;
      }

      toast.success("Room type deleted successfully");
      onOpenChange(false);
      reset();

      if (onRoomTypeUpdated) {
        onRoomTypeUpdated();
      }
    } catch (error) {
      toast.error("Failed to delete room type");
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
              {isEditing ? "Edit Room Type" : "Create Room Type"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-muted rounded transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Room Type Name *</label>
              <input
                type="text"
                placeholder="e.g., Standard Dorm, Private Room"
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

            {/* Type and Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type *</label>
                <select
                  {...register("type")}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.type ? "border-red-500" : "border-border"
                  } disabled:opacity-50`}
                  disabled={isLoading || isDeleting}
                >
                  <option value="">Select type</option>
                  {ROOM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Gender (optional)</label>
                <select
                  {...register("gender")}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
                  disabled={isLoading || isDeleting}
                >
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Capacity and Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Capacity (beds) *</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  {...register("capacity", { valueAsNumber: true })}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.capacity ? "border-red-500" : "border-border"
                  } disabled:opacity-50`}
                  disabled={isLoading || isDeleting}
                />
                {errors.capacity && (
                  <p className="text-red-500 text-sm mt-1">{errors.capacity.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Base Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("base_price", { valueAsNumber: true })}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.base_price ? "border-red-500" : "border-border"
                  } disabled:opacity-50`}
                  disabled={isLoading || isDeleting}
                />
                {errors.base_price && (
                  <p className="text-red-500 text-sm mt-1">{errors.base_price.message}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <textarea
                placeholder="Room type description"
                {...register("description")}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
                disabled={isLoading || isDeleting}
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
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
