"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

interface RoomTypeOption {
  id: string;
  name: string;
}

interface OverrideRow {
  id: string;
  room_type_id: string;
  date: string;
  rate: number | null;
  min_stay_arrival: number | null;
  min_stay_through: number | null;
  max_stay: number | null;
  stop_sell: boolean | null;
  closed_to_arrival: boolean | null;
  closed_to_departure: boolean | null;
}

const FIELD_KEYS = [
  "rate",
  "min_stay_arrival",
  "min_stay_through",
  "max_stay",
  "stop_sell",
  "closed_to_arrival",
  "closed_to_departure",
] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

const NUMBER_FIELDS: FieldKey[] = ["rate", "min_stay_arrival", "min_stay_through", "max_stay"];
const BOOLEAN_FIELDS: FieldKey[] = ["stop_sell", "closed_to_arrival", "closed_to_departure"];

const FIELD_LABEL_KEYS: Record<FieldKey, string> = {
  rate: "rateLabel",
  min_stay_arrival: "minStayArrivalLabel",
  min_stay_through: "minStayThroughLabel",
  max_stay: "maxStayLabel",
  stop_sell: "stopSellLabel",
  closed_to_arrival: "closedToArrivalLabel",
  closed_to_departure: "closedToDepartureLabel",
};

interface RateOverridesClientProps {
  roomTypes: RoomTypeOption[];
}

export default function RateOverridesClient({ roomTypes }: RateOverridesClientProps) {
  const t = useTranslations("rates");

  const [selectedRoomTypeIds, setSelectedRoomTypeIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [enabledFields, setEnabledFields] = useState<Record<FieldKey, boolean>>({
    rate: false, min_stay_arrival: false, min_stay_through: false, max_stay: false,
    stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
  });
  const [fieldValues, setFieldValues] = useState<Record<FieldKey, string | boolean>>({
    rate: "", min_stay_arrival: "", min_stay_through: "", max_stay: "",
    stop_sell: false, closed_to_arrival: false, closed_to_departure: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listFrom, setListFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [listTo, setListTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  });

  const fetchOverrides = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const params = new URLSearchParams({ from: listFrom, to: listTo });
      const res = await fetch(`/api/room-types/rate-overrides?${params}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("toastListFailed"));
        return;
      }
      setOverrides(data.overrides);
    } catch (error) {
      toast.error(t("toastListFailed"));
      console.error(error);
    } finally {
      setIsLoadingList(false);
    }
  }, [listFrom, listTo, t]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const toggleRoomType = (id: string) => {
    setSelectedRoomTypeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleField = (key: FieldKey) => {
    setEnabledFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (selectedRoomTypeIds.length === 0) {
      toast.error(t("errorNoRoomTypes"));
      return;
    }
    if (!dateFrom || !dateTo || dateTo < dateFrom) {
      toast.error(t("errorInvalidDates"));
      return;
    }
    const touchedKeys = FIELD_KEYS.filter((k) => enabledFields[k]);
    if (touchedKeys.length === 0) {
      toast.error(t("errorNoFields"));
      return;
    }

    const body: Record<string, unknown> = {
      room_type_ids: selectedRoomTypeIds,
      date_from: dateFrom,
      date_to: dateTo,
    };
    for (const key of touchedKeys) {
      body[key] = NUMBER_FIELDS.includes(key) ? Number(fieldValues[key]) : !!fieldValues[key];
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/room-types/rate-overrides", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("toastSaveFailed"));
        return;
      }
      toast.success(t("toastSaved", { count: data.rows_written }));
      fetchOverrides();
    } catch (error) {
      toast.error(t("toastSaveFailed"));
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearField = async (overrideId: string, field: FieldKey) => {
    try {
      const res = await fetch(`/api/room-types/rate-overrides/${overrideId}`, {
        method: "PATCH",
        body: JSON.stringify({ field }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("toastClearFailed"));
        return;
      }
      fetchOverrides();
    } catch (error) {
      toast.error(t("toastClearFailed"));
      console.error(error);
    }
  };

  const roomTypeName = (id: string) => roomTypes.find((rt) => rt.id === id)?.name ?? id;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">{t("formHeading")}</h2>

        <div>
          <label className="block text-sm font-medium mb-1">{t("roomTypesLabel")}</label>
          <div className="flex flex-wrap gap-3">
            {roomTypes.map((rt) => (
              <label key={rt.id} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2">
                <input type="checkbox" checked={selectedRoomTypeIds.includes(rt.id)} onChange={() => toggleRoomType(rt.id)} />
                {rt.name}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("dateFromLabel")}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("dateToLabel")}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            />
          </div>
        </div>

        <div className="space-y-3">
          {NUMBER_FIELDS.map((key) => (
            <div key={key} className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm w-44">
                <input type="checkbox" checked={enabledFields[key]} onChange={() => toggleField(key)} />
                {t(FIELD_LABEL_KEYS[key])}
              </label>
              <input
                type="number"
                step={key === "rate" ? "0.01" : "1"}
                min={key === "rate" ? "0" : "1"}
                disabled={!enabledFields[key]}
                value={fieldValues[key] as string}
                onChange={(e) => setFieldValues((p) => ({ ...p, [key]: e.target.value }))}
                className="px-3 py-2 border border-border rounded-lg bg-background disabled:opacity-50 w-40"
              />
            </div>
          ))}

          {BOOLEAN_FIELDS.map((key) => (
            <div key={key} className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm w-44">
                <input type="checkbox" checked={enabledFields[key]} onChange={() => toggleField(key)} />
                {t(FIELD_LABEL_KEYS[key])}
              </label>
              <input
                type="checkbox"
                disabled={!enabledFields[key]}
                checked={fieldValues[key] as boolean}
                onChange={(e) => setFieldValues((p) => ({ ...p, [key]: e.target.checked }))}
                className="disabled:opacity-50"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("saveButton")}
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">{t("listHeading")}</h2>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={listFrom}
              onChange={(e) => setListFrom(e.target.value)}
              className="px-2 py-1 border border-border rounded-lg bg-background text-sm"
            />
            <span className="text-sm text-muted-foreground">{t("toLabel")}</span>
            <input
              type="date"
              value={listTo}
              onChange={(e) => setListTo(e.target.value)}
              className="px-2 py-1 border border-border rounded-lg bg-background text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colDate")}</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colRoomType")}</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colField")}</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colValue")}</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingList ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  </td>
                </tr>
              ) : (
                overrides.flatMap((row) =>
                  FIELD_KEYS.filter((key) => row[key] !== null).map((key) => (
                    <tr key={`${row.id}-${key}`} className="border-b hover:bg-background">
                      <td className="px-4 py-2 text-sm">{row.date}</td>
                      <td className="px-4 py-2 text-sm">{roomTypeName(row.room_type_id)}</td>
                      <td className="px-4 py-2 text-sm">{t(FIELD_LABEL_KEYS[key])}</td>
                      <td className="px-4 py-2 text-sm">{String(row[key])}</td>
                      <td className="px-4 py-2 text-sm">
                        <button onClick={() => handleClearField(row.id, key)} className="p-1 hover:bg-red-100 text-red-600 rounded">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              )}
              {!isLoadingList && overrides.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {t("noneYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
