"use client";

import { useState, useEffect } from "react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useForm, Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createRoomTypeSchema, updateRoomTypeSchema } from "@/lib/validations/room";

interface RoomTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTypeId?: string | null;
  onRoomTypeCreated?: () => void;
  onRoomTypeUpdated?: () => void;
}

interface RatePlan {
  id: string;
  name: string;
  base_price: number;
  stop_sell: boolean;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  min_stay_arrival: number | null;
  min_stay_through: number | null;
  max_stay: number | null;
  is_default: boolean;
}

const ROOM_TYPE_VALUES = ["dorm", "private"] as const;
const GENDER_VALUES = ["", "mixed", "male", "female"] as const;

// Covers both the editing form (physical attrs only, from updateRoomTypeSchema)
// and the create form (physical attrs + the default rate plan's pricing/
// restrictions, from createRoomTypeSchema) — the two schemas disagree on which
// fields exist/are required, so a single flat, mostly-optional type keeps
// useForm/register typed without fighting yup's per-branch inference.
interface RoomTypeFormValues {
  name: string;
  type: string;
  gender: string;
  capacity: number;
  description?: string | null;
  base_price?: number;
  stop_sell?: boolean;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  min_stay_arrival?: number | null;
  min_stay_through?: number | null;
  max_stay?: number | null;
}

const emptyNewRatePlanForm = {
  name: "", base_price: "", stop_sell: false, closed_to_arrival: false,
  closed_to_departure: false, min_stay_arrival: "", min_stay_through: "", max_stay: "",
};

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
  const [loadingData, setLoadingData] = useState(false);

  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [editingRatePlanId, setEditingRatePlanId] = useState<string | null>(null);
  const [ratePlanDrafts, setRatePlanDrafts] = useState<Record<string, any>>({});
  const [savingRatePlanId, setSavingRatePlanId] = useState<string | null>(null);
  const [deletingRatePlanId, setDeletingRatePlanId] = useState<string | null>(null);
  const [addingRatePlan, setAddingRatePlan] = useState(false);
  const [newRatePlan, setNewRatePlan] = useState<typeof emptyNewRatePlanForm>(emptyNewRatePlanForm);
  const [savingNewRatePlan, setSavingNewRatePlan] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RoomTypeFormValues>({
    resolver: yupResolver(isEditing ? updateRoomTypeSchema : createRoomTypeSchema) as Resolver<RoomTypeFormValues>,
    defaultValues: isEditing
      ? { name: "", type: "dorm", gender: "", capacity: 1, description: "" }
      : {
          name: "", type: "dorm", gender: "", capacity: 1, base_price: 0, description: "",
          stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
          min_stay_arrival: null, min_stay_through: null, max_stay: null,
        },
  });

  useEffect(() => {
    if (open && isEditing) {
      fetchRoomType();
    } else if (open) {
      reset({
        name: "", type: "dorm", gender: "", capacity: 1, base_price: 0, description: "",
        stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
        min_stay_arrival: null, min_stay_through: null, max_stay: null,
      });
      setRatePlans([]);
    } else {
      // Dialog closed (X / Escape / click-outside, not just the explicit
      // Cancel buttons) — clear rate-plan-list-local state so a leftover
      // in-progress edit or "add new" draft from THIS room type doesn't
      // reappear pre-filled the next time the dialog opens for a
      // different one.
      setEditingRatePlanId(null);
      setRatePlanDrafts({});
      setAddingRatePlan(false);
      setNewRatePlan(emptyNewRatePlanForm);
    }
  }, [open, isEditing]);

  const fetchRoomType = async () => {
    setLoadingData(true);
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
        description: roomType.description || "",
      });
      setRatePlans(roomType.rate_plans ?? []);
    } catch (error) {
      toast.error(t("toastLoadFailed"));
      console.error(error);
    } finally {
      setLoadingData(false);
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

      toast.success(isEditing ? t("toastUpdated") : t("toastCreated"));
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
    if (!(await confirmDialog(t("confirmDelete")))) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("toastDeleteFailed"));
        return;
      }

      toast.success(t("toastDeleted"));
      onOpenChange(false);
      reset();
      if (onRoomTypeUpdated) onRoomTypeUpdated();
    } catch (error) {
      toast.error(t("toastDeleteFailed"));
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditRatePlan = (rp: RatePlan) => {
    setEditingRatePlanId(rp.id);
    setRatePlanDrafts((prev) => ({
      ...prev,
      [rp.id]: {
        name: rp.name,
        base_price: String(rp.base_price),
        stop_sell: rp.stop_sell,
        closed_to_arrival: rp.closed_to_arrival,
        closed_to_departure: rp.closed_to_departure,
        min_stay_arrival: rp.min_stay_arrival ?? "",
        min_stay_through: rp.min_stay_through ?? "",
        max_stay: rp.max_stay ?? "",
      },
    }));
  };

  const saveRatePlan = async (rateplanId: string) => {
    const draft = ratePlanDrafts[rateplanId];
    setSavingRatePlanId(rateplanId);
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}/rate-plans/${rateplanId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          base_price: Number(draft.base_price),
          stop_sell: draft.stop_sell,
          closed_to_arrival: draft.closed_to_arrival,
          closed_to_departure: draft.closed_to_departure,
          min_stay_arrival: draft.min_stay_arrival === "" ? null : Number(draft.min_stay_arrival),
          min_stay_through: draft.min_stay_through === "" ? null : Number(draft.min_stay_through),
          max_stay: draft.max_stay === "" ? null : Number(draft.max_stay),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("ratePlans.toastSaveFailed"));
        return;
      }
      toast.success(t("ratePlans.toastSaved"));
      setEditingRatePlanId(null);
      fetchRoomType();
    } catch (error) {
      toast.error(t("ratePlans.toastSaveFailed"));
      console.error(error);
    } finally {
      setSavingRatePlanId(null);
    }
  };

  const deleteRatePlan = async (rateplanId: string) => {
    if (!(await confirmDialog(t("ratePlans.confirmDelete")))) return;
    setDeletingRatePlanId(rateplanId);
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}/rate-plans/${rateplanId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("ratePlans.toastDeleteFailed"));
        return;
      }
      toast.success(t("ratePlans.toastDeleted"));
      fetchRoomType();
    } catch (error) {
      toast.error(t("ratePlans.toastDeleteFailed"));
      console.error(error);
    } finally {
      setDeletingRatePlanId(null);
    }
  };

  const addRatePlan = async () => {
    if (!newRatePlan.name || !newRatePlan.base_price) {
      toast.error(t("ratePlans.errorNameAndPriceRequired"));
      return;
    }
    setSavingNewRatePlan(true);
    try {
      const res = await fetch(`/api/room-types/${roomTypeId}/rate-plans`, {
        method: "POST",
        body: JSON.stringify({
          name: newRatePlan.name,
          base_price: Number(newRatePlan.base_price),
          stop_sell: newRatePlan.stop_sell,
          closed_to_arrival: newRatePlan.closed_to_arrival,
          closed_to_departure: newRatePlan.closed_to_departure,
          min_stay_arrival: newRatePlan.min_stay_arrival === "" ? null : Number(newRatePlan.min_stay_arrival),
          min_stay_through: newRatePlan.min_stay_through === "" ? null : Number(newRatePlan.min_stay_through),
          max_stay: newRatePlan.max_stay === "" ? null : Number(newRatePlan.max_stay),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("ratePlans.toastAddFailed"));
        return;
      }
      toast.success(t("ratePlans.toastAdded"));
      setNewRatePlan(emptyNewRatePlanForm);
      setAddingRatePlan(false);
      fetchRoomType();
    } catch (error) {
      toast.error(t("ratePlans.toastAddFailed"));
      console.error(error);
    } finally {
      setSavingNewRatePlan(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-surface border border-border rounded-lg shadow-lg p-6 max-w-lg w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto z-50">
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
            <div>
              <label className="block text-sm font-medium mb-1">{t("nameLabel")}</label>
              <input
                type="text"
                placeholder={t("namePlaceholder")}
                {...register("name")}
                className={`w-full px-3 py-2 border rounded-lg ${errors.name ? "border-red-500" : "border-border"} disabled:opacity-50`}
                disabled={isLoading || isDeleting}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("typeLabel")}</label>
                <select
                  {...register("type")}
                  className={`w-full px-3 py-2 border rounded-lg ${errors.type ? "border-red-500" : "border-border"} disabled:opacity-50`}
                  disabled={isLoading || isDeleting}
                >
                  <option value="">{t("selectType")}</option>
                  {ROOM_TYPE_VALUES.map((rt) => (
                    <option key={rt} value={rt}>{t(`type_${rt}`)}</option>
                  ))}
                </select>
                {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t("genderLabel")}</label>
                <select
                  {...register("gender")}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
                  disabled={isLoading || isDeleting}
                >
                  {GENDER_VALUES.map((g) => (
                    <option key={g} value={g}>{t(`gender_${g || "none"}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("capacityLabel")}</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  {...register("capacity", { valueAsNumber: true })}
                  className={`w-full px-3 py-2 border rounded-lg ${errors.capacity ? "border-red-500" : "border-border"} disabled:opacity-50`}
                  disabled={isLoading || isDeleting}
                />
                {errors.capacity && <p className="text-red-500 text-sm mt-1">{errors.capacity.message}</p>}
              </div>

              {!isEditing && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t("basePriceLabel")}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("base_price", { valueAsNumber: true })}
                    className={`w-full px-3 py-2 border rounded-lg ${errors.base_price ? "border-red-500" : "border-border"} disabled:opacity-50`}
                    disabled={isLoading || isDeleting}
                  />
                  {errors.base_price && <p className="text-red-500 text-sm mt-1">{errors.base_price.message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{t("basePriceHintCreatesDefaultPlan")}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t("descriptionLabel")}</label>
              <textarea
                placeholder={t("descriptionPlaceholder")}
                {...register("description")}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
                disabled={isLoading || isDeleting}
              />
              {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
            </div>

            {!isEditing && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium mb-3">{t("channelRestrictionsHeading")}</p>
                <div className="space-y-2 mb-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register("stop_sell")} disabled={isLoading} />
                    {t("stopSellLabel")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register("closed_to_arrival")} disabled={isLoading} />
                    {t("closedToArrivalLabel")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register("closed_to_departure")} disabled={isLoading} />
                    {t("closedToDepartureLabel")}
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t("minStayArrivalLabel")}</label>
                    <input type="number" min="1" {...register("min_stay_arrival", { valueAsNumber: true })} className={`w-full px-2 py-1.5 border rounded-lg text-sm ${errors.min_stay_arrival ? "border-red-500" : "border-border"}`} disabled={isLoading} />
                    {errors.min_stay_arrival && <p className="text-red-500 text-sm mt-1">{errors.min_stay_arrival.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t("minStayThroughLabel")}</label>
                    <input type="number" min="1" {...register("min_stay_through", { valueAsNumber: true })} className={`w-full px-2 py-1.5 border rounded-lg text-sm ${errors.min_stay_through ? "border-red-500" : "border-border"}`} disabled={isLoading} />
                    {errors.min_stay_through && <p className="text-red-500 text-sm mt-1">{errors.min_stay_through.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t("maxStayLabel")}</label>
                    <input type="number" min="1" {...register("max_stay", { valueAsNumber: true })} className={`w-full px-2 py-1.5 border rounded-lg text-sm ${errors.max_stay ? "border-red-500" : "border-border"}`} disabled={isLoading} />
                    {errors.max_stay && <p className="text-red-500 text-sm mt-1">{errors.max_stay.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">{t("ratePlans.heading")}</p>
                  <button
                    type="button"
                    onClick={() => setAddingRatePlan((v) => !v)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t("ratePlans.addNew")}
                  </button>
                </div>

                <div className="space-y-3">
                  {ratePlans.map((rp) => {
                    const isRowEditing = editingRatePlanId === rp.id;
                    const draft = ratePlanDrafts[rp.id] ?? {};
                    return (
                      <div key={rp.id} className="border border-border rounded-lg p-3">
                        {!isRowEditing ? (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{rp.name} {rp.is_default && <span className="text-xs text-muted-foreground">({t("ratePlans.defaultBadge")})</span>}</p>
                              <p className="text-xs text-muted-foreground">${rp.base_price}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => startEditRatePlan(rp)} className="text-xs text-primary hover:underline">{t("ratePlans.edit")}</button>
                              {!rp.is_default && (
                                <button
                                  type="button"
                                  onClick={() => deleteRatePlan(rp.id)}
                                  disabled={deletingRatePlanId === rp.id}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={draft.name}
                                onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], name: e.target.value } }))}
                                placeholder={t("ratePlans.namePlaceholder")}
                                className="px-2 py-1.5 border border-border rounded-lg text-sm"
                              />
                              <input
                                type="number"
                                step="0.01"
                                value={draft.base_price}
                                onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], base_price: e.target.value } }))}
                                placeholder={t("basePriceLabel")}
                                className="px-2 py-1.5 border border-border rounded-lg text-sm"
                              />
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs">
                              <label className="flex items-center gap-1"><input type="checkbox" checked={draft.stop_sell} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], stop_sell: e.target.checked } }))} />{t("stopSellLabel")}</label>
                              <label className="flex items-center gap-1"><input type="checkbox" checked={draft.closed_to_arrival} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], closed_to_arrival: e.target.checked } }))} />{t("closedToArrivalLabel")}</label>
                              <label className="flex items-center gap-1"><input type="checkbox" checked={draft.closed_to_departure} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], closed_to_departure: e.target.checked } }))} />{t("closedToDepartureLabel")}</label>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <input type="number" min="1" value={draft.min_stay_arrival} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], min_stay_arrival: e.target.value } }))} placeholder={t("minStayArrivalLabel")} className="px-2 py-1.5 border border-border rounded-lg text-xs" />
                              <input type="number" min="1" value={draft.min_stay_through} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], min_stay_through: e.target.value } }))} placeholder={t("minStayThroughLabel")} className="px-2 py-1.5 border border-border rounded-lg text-xs" />
                              <input type="number" min="1" value={draft.max_stay} onChange={(e) => setRatePlanDrafts((p) => ({ ...p, [rp.id]: { ...p[rp.id], max_stay: e.target.value } }))} placeholder={t("maxStayLabel")} className="px-2 py-1.5 border border-border rounded-lg text-xs" />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingRatePlanId(null)} className="px-3 py-1 text-xs border border-border rounded-lg">{t("cancel")}</button>
                              <button
                                type="button"
                                onClick={() => saveRatePlan(rp.id)}
                                disabled={savingRatePlanId === rp.id}
                                className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                              >
                                {savingRatePlanId === rp.id ? t("saving") : t("save")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {addingRatePlan && (
                    <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newRatePlan.name}
                          onChange={(e) => setNewRatePlan((p) => ({ ...p, name: e.target.value }))}
                          placeholder={t("ratePlans.namePlaceholder")}
                          className="px-2 py-1.5 border border-border rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={newRatePlan.base_price}
                          onChange={(e) => setNewRatePlan((p) => ({ ...p, base_price: e.target.value }))}
                          placeholder={t("basePriceLabel")}
                          className="px-2 py-1.5 border border-border rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setAddingRatePlan(false); setNewRatePlan(emptyNewRatePlanForm); }} className="px-3 py-1 text-xs border border-border rounded-lg">{t("cancel")}</button>
                        <button
                          type="button"
                          onClick={addRatePlan}
                          disabled={savingNewRatePlan}
                          className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                        >
                          {savingNewRatePlan ? t("saving") : t("ratePlans.addNew")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
