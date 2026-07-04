"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createRoomTypeSchema, updateRoomTypeSchema } from "@/lib/validations/room";
import { RoomType } from "@/lib/types/database";

interface RoomTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTypeId?: string | null;
  onRoomTypeCreated?: () => void;
  onRoomTypeUpdated?: () => void;
}

const ROOM_TYPE_VALUES = ["dorm", "private"] as const;
const GENDER_VALUES = ["", "mixed", "male", "female"] as const;

export default function RoomTypeDialog({
  open,
  onOpenChange,
  roomTypeId,
  onRoomTypeCreated,
  onRoomTypeUpdated,
}: RoomTypeDialogProps) {
  const t = useTranslations("rooms.types.dialog");
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
        toast.error(t("toastLoadFailed"));
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
      toast.error(t("toastLoadFailed"));
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
        toast.error(responseData.error || t("toastSaveFailed"));
        return;
      }

      toast.success(
        isEditing ? t("toastUpdated") : t("toastCreated")
      );
      onOpenChange(false);
      reset();

      if (isEditing && onRoomTypeUpdated) {
        onRoomTypeUpdated();
      } else if (!isEditing && onRoomTypeCreated) {
        onRoomTypeCreated();
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
      const res = await fetch(`/api/room-types/${roomTypeId}`, {
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

      if (onRoomTypeUpdated) {
        onRoomTypeUpdated();
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
            {/* Name */}
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

            {/* Type and Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("typeLabel")}</label>
                <select
                  {...register("type")}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.type ? "border-red-500" : "border-border"
                  } disabled:opacity-50`}
                  disabled={isLoading || isDeleting}
                >
                  <option value="">{t("selectType")}</option>
                  {ROOM_TYPE_VALUES.map((rt) => (
                    <option key={rt} value={rt}>
                      {t(`type_${rt}`)}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t("genderLabel")}</label>
                <select
                  {...register("gender")}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
                  disabled={isLoading || isDeleting}
                >
                  {GENDER_VALUES.map((g) => (
                    <option key={g} value={g}>
                      {t(`gender_${g || "none"}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Capacity and Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("capacityLabel")}</label>
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
                <label className="block text-sm font-medium mb-1">{t("basePriceLabel")}</label>
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
              <label className="block text-sm font-medium mb-1">{t("descriptionLabel")}</label>
              <textarea
                placeholder={t("descriptionPlaceholder")}
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
