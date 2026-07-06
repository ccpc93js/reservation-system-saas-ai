"use client";

import { useState, useEffect } from "react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("rooms.rooms.dialog");
  const isEditing = !!roomId;
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
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
    if (!open) return;
    // Load the room-type options BEFORE resetting the form, otherwise the
    // native <select> has no matching <option> yet and drops the value —
    // which then fails the "valid ID" validation on save.
    (async () => {
      setLoadingData(true);
      try {
        await fetchRoomTypes();
        if (isEditing) {
          await fetchRoom();
        } else {
          reset();
        }
      } finally {
        setLoadingData(false);
      }
    })();
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
        toast.error(t("toastLoadFailed"));
        return;
      }

      reset({
        room_type_id: room.room_type_id,
        name: room.name,
        floor: room.floor ?? undefined,
        notes: room.notes || "",
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
        toast.error(responseData.error || t("toastSaveFailed"));
        return;
      }

      toast.success(
        isEditing ? t("toastUpdated") : t("toastCreated")
      );
      onOpenChange(false);
      reset();

      if (isEditing && onRoomUpdated) {
        onRoomUpdated();
      } else if (!isEditing && onRoomCreated) {
        onRoomCreated();
      }
    } catch (error) {
      toast.error(t("toastSaveFailed"));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirmDialog(t("confirmDelete")))) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
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

      if (onRoomUpdated) {
        onRoomUpdated();
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
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-surface border border-border rounded-lg shadow-lg p-6 max-w-md w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto z-50">
          {loadingData && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/80 rounded-lg">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-serif text-2xl font-semibold">
              {isEditing ? t("editTitle") : t("createTitle")}
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
              <label className="block text-sm font-medium mb-1">{t("roomTypeLabel")}</label>
              <select
                value={watch("room_type_id") || ""}
                onChange={(e) => setValue("room_type_id", e.target.value, { shouldValidate: true })}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.room_type_id ? "border-red-500" : "border-border"
                } disabled:opacity-50`}
                disabled={isLoading || isDeleting}
              >
                <option value="">{t("selectRoomType")}</option>
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

            {/* Floor */}
            <div>
              <label className="block text-sm font-medium mb-1">{t("floorLabel")}</label>
              <input
                type="number"
                placeholder={t("floorPlaceholder")}
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
              <label className="block text-sm font-medium mb-1">{t("notesLabel")}</label>
              <textarea
                placeholder={t("notesPlaceholder")}
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
