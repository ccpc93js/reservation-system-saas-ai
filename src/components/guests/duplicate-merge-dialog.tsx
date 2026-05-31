"use client";

import React, { useState, useMemo } from "react";
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
  { key: "first_name", label: "First Name", type: "text" },
  { key: "last_name", label: "Last Name", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "nationality", label: "Nationality", type: "text" },
  { key: "date_of_birth", label: "Date of Birth", type: "date" },
  { key: "gender", label: "Gender", type: "select" },
  { key: "document_type", label: "Document Type", type: "select" },
  { key: "document_number", label: "Document Number", type: "text" },
  { key: "document_expiry", label: "Document Expiry", type: "date" },
  { key: "document_issued_date", label: "Document Issued Date", type: "date" },
  { key: "document_issued_place", label: "Document Issued Place", type: "text" },
  { key: "place_of_birth", label: "Place of Birth", type: "text" },
  { key: "country_of_birth", label: "Country of Birth", type: "text" },
  { key: "place_of_residence", label: "Place of Residence", type: "text" },
  { key: "country_of_residence", label: "Country of Residence", type: "text" },
  { key: "jmbg", label: "JMBG", type: "text" },
  { key: "unique_master_citizen", label: "Unique Master Citizen", type: "text" },
  { key: "document_url", label: "Documents", type: "documents", combineOnly: true },
  { key: "notes", label: "Notes", type: "textarea", combineOnly: true },
];

export default function DuplicateMergeDialog({
  newGuestData,
  existingGuest,
  orgId,
  onMerge,
  onCancel,
}: DuplicateMergeDialogProps) {
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
        throw new Error(result.error || "Merge failed");
      }

      toast.success("Guests merged successfully!");
      onMerge(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Merge failed");
    } finally {
      setIsMerging(false);
    }
  };

  const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (type === "documents") {
      try {
        const docs = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(docs) ? `${docs.length} document(s)` : "—";
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
            <Dialog.Title className="text-lg font-semibold text-foreground">
              Merge Duplicate Guests
            </Dialog.Title>
            <button
              onClick={onCancel}
              className="rounded p-1 hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Duplicate guest detected. Choose which values to keep for each field.
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
                      {field.label}
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
                          <p className="text-xs font-medium text-muted-foreground">New Guest</p>
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
                          <p className="text-xs font-medium text-muted-foreground">Existing Guest</p>
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
                            <p className="text-xs font-medium text-muted-foreground">Combine Both</p>
                            <p className="text-xs text-emerald-600">Both values merged</p>
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
              Merged Result Preview
            </p>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>
                <strong>Name:</strong> {mergedPreview.first_name} {mergedPreview.last_name}
              </p>
              {mergedPreview.document_type && (
                <p>
                  <strong>Document:</strong> {mergedPreview.document_type} {mergedPreview.document_number}
                </p>
              )}
              {mergedPreview.document_url && (
                <p>
                  <strong>Documents:</strong>{" "}
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
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={isMerging}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isMerging ? "Merging..." : "Confirm Merge"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
