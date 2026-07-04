"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface DuplicateMergeDialogProps {
  newGuestData: any;
  existingGuest: any;
  orgId: string;
  onMerge: (mergedData: any) => void;
  onCancel: () => void;
}

type SelectionType = "new" | "existing" | "combine";

const GUEST_FIELDS = [
  { key: "first_name", type: "text" },
  { key: "last_name", type: "text" },
  { key: "email", type: "email" },
  { key: "phone", type: "tel" },
  { key: "nationality", type: "text" },
  { key: "date_of_birth", type: "date" },
  { key: "gender", type: "select" },
  { key: "document_type", type: "select" },
  { key: "document_number", type: "text" },
  { key: "document_expiry", type: "date" },
  { key: "document_issued_date", type: "date" },
  { key: "document_issued_place", type: "text" },
  { key: "place_of_birth", type: "text" },
  { key: "country_of_birth", type: "text" },
  { key: "place_of_residence", type: "text" },
  { key: "country_of_residence", type: "text" },
  { key: "jmbg", type: "text" },
  { key: "unique_master_citizen", type: "text" },
  { key: "document_url", type: "documents", combineOnly: true },
  { key: "notes", type: "textarea", combineOnly: true },
];

export default function DuplicateMergeDialog({
  newGuestData,
  existingGuest,
  orgId,
  onMerge,
  onCancel,
}: DuplicateMergeDialogProps) {
  const t = useTranslations("duplicateMergeDialog");
  const [selections, setSelections] = useState<Record<string, SelectionType>>({});
  const [isMerging, setIsMerging] = useState(false);
  const [fullExistingGuest, setFullExistingGuest] = useState<any>(existingGuest);
  const [isLoadingFullGuest, setIsLoadingFullGuest] = useState(true);

  // Fetch full existing guest data on mount
  React.useEffect(() => {
    const fetchFullGuest = async () => {
      try {
        const response = await fetch(`/api/guests/${existingGuest.id}`);
        if (response.ok) {
          const data = await response.json();
          setFullExistingGuest(data);
        }
      } catch (error) {
        console.error("Error fetching full guest data:", error);
      } finally {
        setIsLoadingFullGuest(false);
      }
    };

    if (existingGuest.id) {
      fetchFullGuest();
    }
  }, [existingGuest.id]);

  // Calculate merged preview
  const mergedPreview = useMemo(() => {
    const merged: any = {
      ...fullExistingGuest,
      updated_at: new Date().toISOString(),
    };

    GUEST_FIELDS.forEach((field) => {
      const selection = selections[field.key] || "existing";

      if (field.key === "document_url") {
        // Combine documents
        const newDocs = newGuestData.document_url ? (typeof newGuestData.document_url === 'string' ? JSON.parse(newGuestData.document_url) : newGuestData.document_url) : [];
        const existingDocs = fullExistingGuest.document_url ? (typeof fullExistingGuest.document_url === 'string' ? JSON.parse(fullExistingGuest.document_url) : fullExistingGuest.document_url) : [];
        merged.document_url = JSON.stringify([...existingDocs, ...newDocs]);
      } else if (field.key === "notes") {
        // Combine notes
        const newNotes = newGuestData.notes || "";
        const existingNotes = fullExistingGuest.notes || "";
        if (selection === "combine") {
          const combined = [existingNotes, newNotes].filter(Boolean).join("\n---\n");
          merged.notes = combined + `\n[MERGED FROM: ${newGuestData.first_name} ${newGuestData.last_name}]`;
        } else {
          merged.notes = selection === "new" ? newNotes : existingNotes;
        }
      } else if (selection === "new") {
        merged[field.key] = newGuestData[field.key] || null;
      }
      // If "existing", keep the default (already set from fullExistingGuest)
    });

    return merged;
  }, [selections, newGuestData, fullExistingGuest]);

  const handleMerge = async () => {
    try {
      setIsMerging(true);

      const response = await fetch("/api/guests/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingGuestId: existingGuest.id,
          newGuestData,
          mergeSelections: selections,
          orgId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t("toastMergeFailed"));
      }

      toast.success(t("toastMerged"));
      onMerge(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toastMergeFailed"));
    } finally {
      setIsMerging(false);
    }
  };

  const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (type === "documents") {
      try {
        const docs = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(docs) ? t("documentCount", { count: docs.length }) : "—";
      } catch {
        return "—";
      }
    }
    if (type === "date") {
      return new Date(value).toLocaleDateString();
    }
    return String(value);
  };

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-surface p-6 shadow-lg max-h-[90vh] overflow-y-auto"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-serif text-2xl font-semibold text-foreground">
              {t("title")}
            </Dialog.Title>
            <button
              onClick={onCancel}
              className="rounded p-1 hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            {t("subtitle")}
          </p>

          {/* Fields Grid */}
          <div className="space-y-4 mb-6">
            {GUEST_FIELDS.map((field) => (
              <div
                key={field.key}
                className="rounded-lg border p-4"
                style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--bg))" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-3" style={{ color: "hsl(var(--text))" }}>
                      {t(`fields.${field.key}`)}
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                      {/* New Guest */}
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                        <input
                          type="radio"
                          name={field.key}
                          value="new"
                          checked={selections[field.key] === "new"}
                          onChange={(e) =>
                            setSelections({
                              ...selections,
                              [field.key]: e.target.value as SelectionType,
                            })
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">{t("newGuest")}</p>
                          <p className="text-sm break-words" style={{ color: "hsl(var(--text))" }}>
                            {formatValue(newGuestData[field.key], field.type)}
                          </p>
                        </div>
                      </label>

                      {/* Existing Guest */}
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                        <input
                          type="radio"
                          name={field.key}
                          value="existing"
                          checked={selections[field.key] !== "new" && selections[field.key] !== "combine"}
                          onChange={(e) =>
                            setSelections({
                              ...selections,
                              [field.key]: e.target.value as SelectionType,
                            })
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">{t("existingGuest")}</p>
                          <p className="text-sm break-words" style={{ color: "hsl(var(--text))" }}>
                            {formatValue(fullExistingGuest[field.key], field.type)}
                          </p>
                        </div>
                      </label>

                      {/* Combine (if applicable) */}
                      {(field.combineOnly || field.key === "notes" || field.key === "document_url") && (
                        <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                          <input
                            type="radio"
                            name={field.key}
                            value="combine"
                            checked={selections[field.key] === "combine"}
                            onChange={(e) =>
                              setSelections({
                                ...selections,
                                [field.key]: e.target.value as SelectionType,
                              })
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-muted-foreground">{t("combineBoth")}</p>
                            <p className="text-xs text-emerald-600">{t("bothValuesMerged")}</p>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div
            className="rounded-lg border p-4 mb-6"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--bg))" }}
          >
            <p className="text-sm font-medium mb-3" style={{ color: "hsl(var(--text))" }}>
              {t("mergedResultPreview")}
            </p>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>
                <strong>{t("nameLabel")}</strong> {mergedPreview.first_name} {mergedPreview.last_name}
              </p>
              {mergedPreview.document_type && (
                <p>
                  <strong>{t("documentLabel")}</strong> {mergedPreview.document_type} {mergedPreview.document_number}
                </p>
              )}
              {mergedPreview.document_url && (
                <p>
                  <strong>{t("documentsLabel")}</strong>{" "}
                  {formatValue(mergedPreview.document_url, "documents")}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              onClick={onCancel}
              disabled={isMerging}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-background text-foreground border border-border hover:bg-muted disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleMerge}
              disabled={isMerging}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isMerging ? t("mergingEllipsis") : t("confirmMerge")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
