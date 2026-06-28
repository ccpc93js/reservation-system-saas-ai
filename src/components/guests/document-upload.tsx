"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, X, FileText, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DocumentMetadata, UploadDocumentResponse } from "@/lib/types/database";
import OCRExtractionDialog from "./ocr-extraction-dialog";

interface DocumentUploadProps {
  guestId: string;
  existingDocuments?: DocumentMetadata[];
  onUploadComplete?: (fileUrl: string, fileName: string) => void;
  onExtractedData?: (data: Record<string, any>) => void;
  onError?: (error: string) => void;
}

export default function DocumentUpload({
  guestId,
  existingDocuments = [],
  onUploadComplete,
  onExtractedData,
  onError,
}: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  const [documents, setDocuments] = useState<DocumentMetadata[]>(existingDocuments);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionData, setExtractionData] = useState<any>(null);
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [lastExtractedImageUrl, setLastExtractedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDocuments(existingDocuments);
    // Generate signed URLs for existing documents
    generateSignedUrls(existingDocuments);
  }, [existingDocuments]);

  const generateSignedUrls = async (docs: DocumentMetadata[]) => {
    const urls: Record<string, string> = {};
    for (const doc of docs) {
      if (doc.filePath) {
        try {
          const res = await fetch("/api/guests/document-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filePath: doc.filePath,
              guestId: guestId,
            }),
          });
          const result = await res.json();
          if (result.success) {
            urls[doc.filePath] = result.url;
          }
        } catch (e) {
          console.error("Error generating signed URL:", e);
        }
      }
    }
    setDocumentUrls(urls);
  };

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      const error = "Only JPG, PNG, and PDF files are allowed";
      toast.error(error);
      onError?.(error);
      return;
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      const error = "File must be smaller than 10MB";
      toast.error(error);
      onError?.(error);
      return;
    }

    setFileName(file.name);

    // Generate preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    // For existing guests, auto-upload. For new guests, just show preview (they extract first)
    if (guestId) {
      await uploadFile(file);
    } else {
      // For new guests, just get the preview for OCR - don't upload yet
      toast.success("Image ready! Click 'Extract Data' to auto-fill the form");
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("guestId", guestId);

      const response = await fetch("/api/guests/upload-document", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as UploadDocumentResponse & { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setUploadedFile({
        url: result.url,
        name: result.fileName,
      });

      // Add to documents list
      setDocuments(prev => [...prev, {
        url: result.url,
        fileName: result.fileName,
        uploadedAt: new Date().toISOString(),
        type: 'application/octet-stream'
      }]);

      toast.success("Document uploaded successfully!");
      onUploadComplete?.(result.url, result.fileName);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Upload failed";
      toast.error(errorMsg);
      onError?.(errorMsg);
      setPreview(null);
      setFileName(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clearUpload = () => {
    setPreview(null);
    setFileName(null);
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExtractOCR = async () => {
    // For new guests, extract from preview (base64). For existing guests, extract from uploaded URL
    const imageToExtract = preview || (uploadedFile?.url);

    if (!imageToExtract) return;

    setIsExtracting(true);
    try {
      const response = await fetch("/api/guests/extract-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imageToExtract,  // base64 or URL
          documentType: uploadedFile?.name.split(".").pop()?.toLowerCase() || fileName?.split(".").pop()?.toLowerCase(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "OCR extraction failed");
      }

      setExtractionData(result);
      setLastExtractedImageUrl(imageToExtract);
      setShowExtractDialog(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "OCR extraction failed";
      toast.error(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractedDataApply = (correctedData: Record<string, any>) => {
    setShowExtractDialog(false);
    onExtractedData?.(correctedData);
    toast.success("Data extracted and applied!");
  };

  const handleExtractFromDoc = async (imageUrl: string) => {
    setIsExtracting(true);
    try {
      const response = await fetch("/api/guests/extract-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "OCR extraction failed");
      setExtractionData(result);
      setLastExtractedImageUrl(imageUrl);
      setShowExtractDialog(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "OCR extraction failed");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Upload Area */}
      {!uploadedFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
          style={{
            borderColor: "hsl(var(--border))",
            backgroundColor: "hsl(var(--bg))",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <p className="text-sm font-medium" style={{ color: "hsl(var(--text))" }}>
                {isUploading ? "Uploading..." : "Drop file here or click to select"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, or PDF • Max 10MB
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Preview - Image */}
      {preview && (
        <div className="relative rounded-lg overflow-hidden border space-y-2" style={{ borderColor: "hsl(var(--border))" }}>
          <img src={preview} alt="Document preview" className="w-full h-auto max-h-64 object-cover" />
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-sm font-medium">Uploading...</div>
            </div>
          )}
          {/* Extract Data button for preview (before upload) */}
          {!isUploading && (
            <button
              type="button"
              onClick={handleExtractOCR}
              disabled={isExtracting}
              className="w-full mt-2 text-sm px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isExtracting ? "Extracting..." : "Extract Data from Image"}
            </button>
          )}
        </div>
      )}

      {/* Uploaded File Info */}
      {uploadedFile && (
        <div className="rounded-lg border p-3" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--bg))" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {preview ? (
                <img src={preview} alt="thumb" className="w-12 h-12 rounded object-cover flex-shrink-0" />
              ) : (
                <FileText className="w-12 h-12 text-muted-foreground flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: "hsl(var(--text))" }}>
                  {uploadedFile.name}
                </p>
                <p className="text-xs text-emerald-600 mt-1">✓ Uploaded successfully</p>
                {preview && (
                  <button
                    type="button"
                    onClick={handleExtractOCR}
                    disabled={isExtracting}
                    className="mt-2 text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    {isExtracting ? "Extracting..." : "Extract Data"}
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={clearUpload}
              className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Existing Documents List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Uploaded Documents:</p>
          {documents.map((doc, idx) => (
            <div key={idx} className="rounded-lg border p-3" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--bg))" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {doc.type?.startsWith('image/') ? (
                    <img src={doc.url} alt="thumb" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                  ) : (
                    <FileText className="w-12 h-12 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium truncate text-primary hover:underline block"
                    >
                      {doc.fileName}
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                    {doc.type?.startsWith("image/") && (
                      <button
                        type="button"
                        onClick={() => handleExtractFromDoc(doc.url)}
                        disabled={isExtracting}
                        className="mt-2 text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        {isExtracting ? "Extracting..." : "Extract Data"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="flex gap-2 rounded-lg p-3" style={{ background: "hsl(var(--bg))" }}>
        <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Upload a clear photo or scan of the guest's passport, ID, or driver's license. Required for police registration in Serbia.
        </p>
      </div>

      {/* OCR Extraction Dialog */}
      {showExtractDialog && extractionData && (
        <OCRExtractionDialog
          imageUrl={lastExtractedImageUrl || ""}
          documentType={uploadedFile?.name.split(".").pop()?.toLowerCase()}
          extractedData={{
            extractedFields: extractionData.extractedFields,
            confidence: extractionData.confidence,
            warnings: extractionData.warnings || [],
          }}
          onApply={handleExtractedDataApply}
          onCancel={() => {
            setShowExtractDialog(false);
            setExtractionData(null);
            setLastExtractedImageUrl(null);
          }}
          isLoading={isExtracting}
        />
      )}
    </div>
  );
}
