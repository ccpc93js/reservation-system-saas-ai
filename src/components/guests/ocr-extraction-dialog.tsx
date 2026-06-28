"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface OCRExtractionDialogProps {
  imageUrl: string;
  documentType?: string;
  extractedData: {
    extractedFields: Record<string, any>;
    confidence: Record<string, number>;
    warnings: string[];
  };
  onApply: (correctedData: Record<string, any>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  onUploadBackSide?: (callback: (data: any) => void) => void;
}

const GUEST_FIELDS = [
  { key: "first_name", label: "First Name", type: "text" },
  { key: "last_name", label: "Last Name", type: "text" },
  { key: "date_of_birth", label: "Date of Birth", type: "date" },
  { key: "gender", label: "Gender", type: "select", options: ["M", "F", "Other"] },
  { key: "nationality", label: "Nationality", type: "text" },
  { key: "document_number", label: "Document Number", type: "text" },
  { key: "document_expiry", label: "Document Expiry", type: "date" },
  { key: "document_type", label: "Document Type", type: "text" },
  { key: "place_of_birth", label: "Place of Birth", type: "text" },
  { key: "country_of_birth", label: "Country of Birth", type: "text" },
];

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.9) return "text-emerald-600";
  if (confidence >= 0.7) return "text-amber-600";
  return "text-red-600";
};

const getConfidenceBgColor = (confidence: number): string => {
  if (confidence >= 0.9) return "bg-emerald-50";
  if (confidence >= 0.7) return "bg-amber-50";
  return "bg-red-50";
};

export default function OCRExtractionDialog({
  imageUrl,
  documentType,
  extractedData,
  onApply,
  onCancel,
  isLoading,
  onUploadBackSide,
}: OCRExtractionDialogProps) {
  const [correctedData, setCorrectedData] = useState<Record<string, any>>(
    extractedData.extractedFields
  );
  const [showBackSideUpload, setShowBackSideUpload] = useState(false);
  const [isExtractingBackSide, setIsExtractingBackSide] = useState(false);

  const handleFieldChange = (fieldKey: string, value: any) => {
    setCorrectedData((prev) => ({
      ...prev,
      [fieldKey]: value || null,
    }));
  };

  const handleBackSideImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtractingBackSide(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Image = e.target?.result as string;

          // Call OCR extraction on back side image
          const response = await fetch("/api/guests/extract-ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: base64Image,
              documentType: documentType,
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || "Failed to extract back side data");
          }

          // Merge back side data with front side
          handleMergeBackSideData(result.extractedFields);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to extract back side";
          toast.error(errorMsg);
        } finally {
          setIsExtractingBackSide(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to extract back side";
      toast.error(errorMsg);
      setIsExtractingBackSide(false);
    }
  };

  const handleMergeBackSideData = (backSideData: Record<string, any>) => {
    // Merge back side data: fill missing fields from front side
    const merged = { ...correctedData };
    Object.entries(backSideData).forEach(([key, value]) => {
      // Only fill fields that are empty or have low confidence on front side
      if (value && !merged[key]) {
        merged[key] = value;
      }
    });
    setCorrectedData(merged);
    setShowBackSideUpload(false);
    toast.success("Back side data merged!");
  };

  const getFilledPercentage = () => {
    const totalFields = GUEST_FIELDS.length;
    const filledFields = GUEST_FIELDS.filter(field => {
      const value = correctedData[field.key];
      return value !== null && value !== undefined && value !== "";
    }).length;
    return Math.round((filledFields / totalFields) * 100);
  };

  const handleApply = () => {
    onApply(correctedData);
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
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">
                Review Extracted Data
              </Dialog.Title>
              <p className="text-xs text-muted-foreground mt-1">
                {getFilledPercentage()}% of fields completed
              </p>
            </div>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="rounded p-1 hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Warnings */}
          {extractedData.warnings && extractedData.warnings.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 mb-1">
                    OCR Warnings
                  </p>
                  <ul className="text-sm text-amber-800 space-y-1">
                    {extractedData.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Image Preview */}
            <div>
              <p className="text-sm font-medium mb-3" style={{ color: "hsl(var(--text))" }}>
                Document Preview
              </p>
              <div
                className="rounded-lg border overflow-hidden bg-muted"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Document preview"
                    className="w-full h-auto max-h-96 object-contain"
                    onError={(e) => {
                      console.error("Image failed to load:", imageUrl);
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-96 flex items-center justify-center text-muted-foreground">
                    No image provided
                  </div>
                )}
              </div>
            </div>

            {/* Extracted Fields */}
            <div>
              <p className="text-sm font-medium mb-3" style={{ color: "hsl(var(--text))" }}>
                Extracted Fields (Confidence Score)
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {GUEST_FIELDS.map((field) => {
                  const value = correctedData[field.key];
                  const confidence = extractedData.confidence[field.key] || 0;
                  const displayConfidence = (confidence * 100).toFixed(0);

                  return (
                    <div
                      key={field.key}
                      className={`p-2 rounded-lg border ${getConfidenceBgColor(confidence)}`}
                      style={{
                        borderColor:
                          confidence >= 0.9
                            ? "hsl(var(--border))"
                            : confidence >= 0.7
                            ? "hsl(var(--border))"
                            : "hsl(var(--border))",
                      }}
                    >
                      <div className="flex items-start gap-2">
                        {confidence >= 0.9 ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        ) : confidence >= 0.7 ? (
                          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-medium" style={{ color: "hsl(var(--text))" }}>
                              {field.label}
                            </label>
                            <span className={`text-xs font-medium ${getConfidenceColor(confidence)}`}>
                              {displayConfidence}%
                            </span>
                          </div>
                          {field.type === "select" ? (
                            <select
                              value={value || ""}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className="w-full rounded px-2 py-1 text-xs mt-1"
                              style={{
                                background: "hsl(var(--bg))",
                                borderColor: "hsl(var(--border))",
                                color: "hsl(var(--text))",
                                border: "1px solid",
                              }}
                            >
                              <option value="">Select...</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type}
                              value={value || ""}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className="w-full rounded px-2 py-1 text-xs mt-1"
                              style={{
                                background: "hsl(var(--bg))",
                                borderColor: "hsl(var(--border))",
                                color: "hsl(var(--text))",
                                border: "1px solid",
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Back Side Upload Section */}
          {showBackSideUpload && (
            <div className="mt-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <p className="text-sm font-medium text-foreground mb-3">
                Upload ID Back Side to Extract Missing Fields
              </p>
              {isExtractingBackSide ? (
                <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary"></div>
                    <p className="text-sm text-primary font-medium">Extracting back side data...</p>
                  </div>
                </div>
              ) : (
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 text-center hover:bg-primary/10 transition-colors">
                    <p className="text-sm text-primary/80">
                      Click to upload back side image
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleBackSideImageSelect}
                    disabled={isExtractingBackSide}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-between pt-4 border-t border-border">
            <button
              onClick={() => setShowBackSideUpload(!showBackSideUpload)}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showBackSideUpload ? "Cancel Back Side Upload" : "📄 Upload Back Side (Optional)"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-background text-foreground border border-border hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? "Processing..." : "Apply Extracted Data"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
