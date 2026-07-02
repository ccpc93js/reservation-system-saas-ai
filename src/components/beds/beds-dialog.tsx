"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createBedSchema, updateBedSchema } from "@/lib/validations/room";
import { Room, Bed } from "@/lib/types/database";

interface BedsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bedId?: string | null;
  onBedCreated?: () => void;
  onBedUpdated?: () => void;
}

export default function BedsDialog({
  open,
  onOpenChange,
  bedId,
  onBedCreated,
  onBedUpdated,
}: BedsDialogProps) {
  const t = useTranslations("rooms.beds.dialog");
  const isEditing = !!bedId;
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm({
    resolver: yupResolver(isEditing ? updateBedSchema : createBedSchema),
    defaultValues: {
      room_id: "",
      name: "",
      position: undefined,
      is_active: true,
    },
  });

  useEffect(() => {
    if (open) {
      fetchRooms();
      if (isEditing) {
        fetchBed();
      } else {
        reset();
      }
    }
  }, [open, isEditing]);

  const fetchRooms = async () => {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
      });
      const res = await fetch(`/api/rooms?${params}`);
      const data = await res.json();

      if (res.ok) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    }
  };

  const fetchBed = async () => {
    try {
      const res = await fetch(`/api/beds/${bedId}`);
      const bed = await res.json();

      if (!res.ok) {
        toast.error(t("toastLoadFailed"));
        return;
      }

      reset({
        room_id: bed.room_id,
        name: bed.name,
        position: bed.position ?? undefined,
        is_active: bed.is_active,
      });
    } catch (error) {
      toast.error(t("toastLoadFailed"));
      console.error(error);
    }
  };

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing
        ? `/api/beds/${bedId}`
        : "/api/beds/create";
      const method = isEditing ? "PATCH" : "POST";

      const payload = {
        room_id: data.room_id,
        name: data.name,
        position: Number.isFinite(data.position) ? data.position : null,
        is_active: data.is_active,
      };

      const res = await fetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();

      if (!res.ok) {
        toast.error(responseData.error || t("toastSaveFailed"));
        return;
      }

      toast.success(
        isEditing ? t("toastUpdated") : t("toastCreated")
      );
      onOpenChange(false);
      reset();

      if (isEditing && onBedUpdated) {
        onBedUpdated();
      } else if (!isEditing && onBedCreated) {
        onBedCreated();
      }
    } catch (error) {
      toast.error(t("toastSaveFailed"));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("confirmDelete"))) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/beds/${bedId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("toastDeleteFailed"));
        return;
      }

      toast.success(t("toastDeleted"));
      onOpenChange(false);
      reset();

      if (onBedUpdated) {
        onBedUpdated();
      }
    } catch (error) {
      toast.error(t("toastDeleteFailed"));
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
              {isEditing ? t("editTitle") : t("createTitle")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-muted rounded transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Room */}
            <div>
              <label className="block text-sm font-medium mb-1">{t("roomLabel")}</label>
              <select
                {...register("room_id")}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.room_id ? "border-red-500" : "border-border"
                } disabled:opacity-50`}
                disabled={isLoading || isDeleting}
              >
                <option value="">{t("selectRoom")}</option>
                {rooms.map((room) => {
                  const roomType = (room as any).room_types;
                  return (
                    <option key={room.id} value={room.id}>
                      {room.name} {roomType ? `(${roomType.name})` : ""}
                    </option>
                  );
                })}
              </select>
              {errors.room_id && (
                <p className="text-red-500 text-sm mt-1">{errors.room_id.message}</p>
              )}
            </div>

            {/* Bed Name */}
            <div>
              <label className="block text-sm font-medium mb-1">{t("nameLabel")}</label>
              <input
                type="text"
                placeholder={t("namePlaceholder")}
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

            {/* Position */}
            <div>
              <label className="block text-sm font-medium mb-1">{t("positionLabel")}</label>
              <input
                type="number"
                placeholder={t("positionPlaceholder")}
                {...register("position", { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
                disabled={isLoading || isDeleting}
              />
              {errors.position && (
                <p className="text-red-500 text-sm mt-1">{errors.position.message}</p>
              )}
            </div>

            {/* Is Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={watch("is_active")}
                onChange={(e) => setValue("is_active", e.target.checked)}
                disabled={isLoading || isDeleting}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                {t("isActiveLabel")}
              </label>
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
                  {isDeleting ? t("deleting") : t("delete")}
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={isLoading || isDeleting}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    {t("cancel")}
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={isLoading || isDeleting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? t("saving") : t("save")}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
