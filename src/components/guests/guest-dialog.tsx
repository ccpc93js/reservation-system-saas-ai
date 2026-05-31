"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createGuestSchema, updateGuestSchema, type CreateGuestInput } from "@/lib/validations/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import DocumentUpload from "./document-upload";
import DuplicateMergeDialog from "./duplicate-merge-dialog";

interface GuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId?: string;
  orgId: string;
  onGuestCreated?: () => void;
  onGuestUpdated?: () => void;
}

const DOCUMENT_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's License" },
];

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export default function GuestDialog({
  open,
  onOpenChange,
  guestId,
  orgId,
  onGuestCreated,
  onGuestUpdated,
}: GuestDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [guest, setGuest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandDocumentInfo, setExpandDocumentInfo] = useState(false);
  const [duplicateGuest, setDuplicateGuest] = useState<any>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [forceCreateDuplicate, setForceCreateDuplicate] = useState(false);
  const [existingDocuments, setExistingDocuments] = useState<any[]>([]);
  const [newlyCreatedGuestId, setNewlyCreatedGuestId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const submitFormRef = useRef<HTMLFormElement>(null);

  // Auto-scroll to top when duplicate alert appears
  useEffect(() => {
    if (duplicateGuest && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [duplicateGuest]);

  const schema = guestId ? updateGuestSchema : createGuestSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<any>({
    resolver: yupResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      nationality: "",
      document_type: "",
      document_number: "",
      date_of_birth: "",
      gender: "",
      notes: "",
      place_of_birth: "",
      country_of_birth: "",
      place_of_residence: "",
      country_of_residence: "",
      document_expiry: "",
      document_issued_place: "",
      document_issued_date: "",
      jmbg: "",
      unique_master_citizen: "",
    },
  });

  // Fetch guest data if editing
  useEffect(() => {
    if (!open || !guestId) return;

    const fetchGuest = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/guests/${guestId}`);
        const data = await res.json();
        setGuest(data);

        // Parse existing documents
        if (data.document_url) {
          try {
            const docs = typeof data.document_url === 'string'
              ? JSON.parse(data.document_url)
              : data.document_url;
            setExistingDocuments(Array.isArray(docs) ? docs : []);
          } catch (e) {
            console.error('Error parsing documents:', e);
            setExistingDocuments([]);
          }
        }

        reset({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          phone: data.phone || "",
          nationality: data.nationality || "",
          document_type: data.document_type || "",
          document_number: data.document_number || "",
          date_of_birth: data.date_of_birth ? data.date_of_birth.split("T")[0] : "",
          gender: data.gender || "",
          notes: data.notes || "",
          place_of_birth: data.place_of_birth || "",
          country_of_birth: data.country_of_birth || "",
          place_of_residence: data.place_of_residence || "",
          country_of_residence: data.country_of_residence || "",
          document_expiry: data.document_expiry ? data.document_expiry.split("T")[0] : "",
          document_issued_place: data.document_issued_place || "",
          document_issued_date: data.document_issued_date ? data.document_issued_date.split("T")[0] : "",
          jmbg: data.jmbg || "",
          unique_master_citizen: data.unique_master_citizen || "",
        });
      } catch (error) {
        toast.error("Failed to load guest");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuest();
  }, [open, guestId, reset]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setDuplicateGuest(null);
    try {
      const url = guestId ? `/api/guests/${guestId}` : "/api/guests/create";
      const method = guestId ? "PATCH" : "POST";

      // If force creating a duplicate, add a note
      if (forceCreateDuplicate && !guestId) {
        const timestamp = new Date().toLocaleString();
        const note = data.notes ? `${data.notes}\n[DUPLICATE CREATED - ${timestamp}]` : `[DUPLICATE CREATED - ${timestamp}]`;
        data.notes = note;
      }

      const requestBody = {
        ...data,
        ...(forceCreateDuplicate && { force_create: true }),
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle duplicate guest (409 Conflict)
        if (response.status === 409 && result.duplicate && !forceCreateDuplicate) {
          setDuplicateGuest(result.existingGuest);
          setShowMergeDialog(true);
          return;
        }

        toast.error(result.error || "Failed to save guest");
        return;
      }

      toast.success(guestId ? "Guest updated!" : "Guest created!");

      // For new guests, show document upload screen instead of closing
      if (!guestId && result.id) {
        setNewlyCreatedGuestId(result.id);
        reset();
      } else {
        // For updates, close the dialog
        onOpenChange(false);
        reset();
      }
      setForceCreateDuplicate(false);
      guestId ? onGuestUpdated?.() : null;
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error saving guest");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!guestId || !confirm("Are you sure you want to delete this guest?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/guests/${guestId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to delete guest");
        return;
      }

      toast.success("Guest deleted!");
      onOpenChange(false);
      onGuestUpdated?.();
    } catch (error) {
      toast.error("Error deleting guest");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMerge = async (mergeSelections: any) => {
    try {
      const response = await fetch("/api/guests/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingGuestId: duplicateGuest.id,
          newGuestData: watch(),
          mergeSelections,
          orgId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Merge failed");
      }

      toast.success("Guests merged successfully!");
      onOpenChange(false);
      reset();
      setShowMergeDialog(false);
      setDuplicateGuest(null);
      onGuestCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Merge failed");
    }
  };

  if (isLoading) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-surface p-6 shadow-lg max-h-[80vh] overflow-y-auto"
          >
            <p className="text-muted-foreground">Loading...</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  // Show merge dialog if needed
  if (showMergeDialog && duplicateGuest) {
    return (
      <DuplicateMergeDialog
        newGuestData={watch()}
        existingGuest={duplicateGuest}
        orgId={orgId}
        onMerge={handleMerge}
        onCancel={() => {
          setShowMergeDialog(false);
          setDuplicateGuest(null);
        }}
      />
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          ref={scrollContainerRef}
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-surface p-6 shadow-lg max-h-[80vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              {guestId ? "Edit Guest" : "New Guest"}
            </Dialog.Title>
            <Dialog.Close className="rounded p-1 hover:bg-muted transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </Dialog.Close>
          </div>

          {duplicateGuest && (
            <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 mb-2">
                    Guest already exists
                  </p>
                  <div className="text-sm text-amber-800 space-y-1 mb-3">
                    <p><strong>Name:</strong> {duplicateGuest.name}</p>
                    <p><strong>Document:</strong> {duplicateGuest.document_type} {duplicateGuest.document_number}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDuplicateGuest(null);
                        onOpenChange(false);
                      }}
                      className="text-xs px-2 py-1 rounded bg-amber-200 text-amber-900 hover:bg-amber-300 transition-colors"
                    >
                      Use Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Merge dialog will be shown by showMergeDialog state
                      }}
                      className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
                    >
                      Merge Records
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form
            ref={submitFormRef}
            onSubmit={handleSubmit((data) => {
              return onSubmit(data);
            })}
            className="space-y-4"
          >
            {/* Post-creation upload mode */}
            {newlyCreatedGuestId && (
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                <p className="text-sm font-semibold text-emerald-900 mb-2">✓ Guest created successfully!</p>
                <p className="text-xs text-emerald-800">Now you can upload documents. (Optional)</p>
              </div>
            )}

            {/* Form fields (hidden in upload mode) */}
            {!newlyCreatedGuestId && (
              <>
            {/* First & Last Name */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                  First Name *
                </label>
                <input
                  {...register("first_name")}
                  placeholder="First name"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: errors.first_name ? "#ef4444" : "hsl(var(--border))",
                    background: "hsl(var(--bg))",
                    color: "hsl(var(--text))",
                  }}
                />
                {errors.first_name && (
                  <p className="text-xs text-red-500 mt-1">{String(errors.first_name?.message ?? "")}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                  Last Name *
                </label>
                <input
                  {...register("last_name")}
                  placeholder="Last name"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: errors.last_name ? "#ef4444" : "hsl(var(--border))",
                    background: "hsl(var(--bg))",
                    color: "hsl(var(--text))",
                  }}
                />
                {errors.last_name && (
                  <p className="text-xs text-red-500 mt-1">{String(errors.last_name?.message ?? "")}</p>
                )}
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                  Email
                </label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="Email"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: errors.email ? "#ef4444" : "hsl(var(--border))",
                    background: "hsl(var(--bg))",
                    color: "hsl(var(--text))",
                  }}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{String(errors.email?.message ?? "")}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                  Phone
                </label>
                <input
                  {...register("phone")}
                  placeholder="Phone"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: errors.phone ? "#ef4444" : "hsl(var(--border))",
                    background: "hsl(var(--bg))",
                    color: "hsl(var(--text))",
                  }}
                />
                {errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{String(errors.phone?.message ?? "")}</p>
                )}
              </div>
            </div>

            {/* Gender & Nationality */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                  Gender
                </label>
                <select
                  {...register("gender")}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: errors.gender ? "#ef4444" : "hsl(var(--border))",
                    background: "hsl(var(--bg))",
                    color: "hsl(var(--text))",
                  }}
                >
                  <option value="">Select gender</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
                {errors.gender && (
                  <p className="text-xs text-red-500 mt-1">{String(errors.gender?.message ?? "")}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                  Nationality
                </label>
                <input
                  {...register("nationality")}
                  placeholder="e.g., ESP, COL"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: errors.nationality ? "#ef4444" : "hsl(var(--border))",
                    background: "hsl(var(--bg))",
                    color: "hsl(var(--text))",
                  }}
                />
                {errors.nationality && (
                  <p className="text-xs text-red-500 mt-1">{String(errors.nationality?.message ?? "")}</p>
                )}
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                Date of Birth
              </label>
              <input
                {...register("date_of_birth")}
                type="date"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: errors.date_of_birth ? "#ef4444" : "hsl(var(--border))",
                  background: "hsl(var(--bg))",
                  color: "hsl(var(--text))",
                }}
              />
              {errors.date_of_birth && (
                <p className="text-xs text-red-500 mt-1">{String(errors.date_of_birth?.message ?? "")}</p>
              )}
            </div>

            {/* Place & Country of Birth */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                  Place of Birth
                </label>
                <input
                  {...register("place_of_birth")}
                  placeholder="e.g., Madrid"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: errors.place_of_birth ? "#ef4444" : "hsl(var(--border))",
                    background: "hsl(var(--bg))",
                    color: "hsl(var(--text))",
                  }}
                />
                {errors.place_of_birth && (
                  <p className="text-xs text-red-500 mt-1">{String(errors.place_of_birth?.message ?? "")}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                  Country of Birth
                </label>
                <input
                  {...register("country_of_birth")}
                  placeholder="e.g., Spain"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: errors.country_of_birth ? "#ef4444" : "hsl(var(--border))",
                    background: "hsl(var(--bg))",
                    color: "hsl(var(--text))",
                  }}
                />
                {errors.country_of_birth && (
                  <p className="text-xs text-red-500 mt-1">{String(errors.country_of_birth?.message ?? "")}</p>
                )}
              </div>
            </div>

            {/* Document Info (collapsible) */}
            <div
              className="p-3 rounded-lg border"
              style={{
                background: "hsl(var(--bg))",
                borderColor: "hsl(var(--border))",
              }}
            >
              <button
                type="button"
                onClick={() => setExpandDocumentInfo(!expandDocumentInfo)}
                className="w-full text-left text-sm font-medium transition-colors"
                style={{ color: "hsl(var(--text))" }}
              >
                {expandDocumentInfo ? "▼" : "▶"} Document Information
              </button>
              {expandDocumentInfo && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      Document Type
                    </label>
                    <select
                      {...register("document_type")}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: errors.document_type ? "#ef4444" : "hsl(var(--border))",
                        background: "hsl(var(--bg))",
                        color: "hsl(var(--text))",
                      }}
                    >
                      <option value="">Select type</option>
                      {DOCUMENT_TYPES.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    {errors.document_type && (
                      <p className="text-xs text-red-500 mt-1">{String(errors.document_type?.message ?? "")}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      Document Number
                    </label>
                    <input
                      {...register("document_number")}
                      placeholder="Document number"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: errors.document_number ? "#ef4444" : "hsl(var(--border))",
                        background: "hsl(var(--bg))",
                        color: "hsl(var(--text))",
                      }}
                    />
                    {errors.document_number && (
                      <p className="text-xs text-red-500 mt-1">{String(errors.document_number?.message ?? "")}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      Document Expiry
                    </label>
                    <input
                      {...register("document_expiry")}
                      type="date"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: errors.document_expiry ? "#ef4444" : "hsl(var(--border))",
                        background: "hsl(var(--bg))",
                        color: "hsl(var(--text))",
                      }}
                    />
                    {errors.document_expiry && (
                      <p className="text-xs text-red-500 mt-1">{String(errors.document_expiry?.message ?? "")}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      Document Issued Date
                    </label>
                    <input
                      {...register("document_issued_date")}
                      type="date"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: errors.document_issued_date ? "#ef4444" : "hsl(var(--border))",
                        background: "hsl(var(--bg))",
                        color: "hsl(var(--text))",
                      }}
                    />
                    {errors.document_issued_date && (
                      <p className="text-xs text-red-500 mt-1">{String(errors.document_issued_date?.message ?? "")}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      Document Issued Place
                    </label>
                    <input
                      {...register("document_issued_place")}
                      placeholder="Issued place"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: errors.document_issued_place ? "#ef4444" : "hsl(var(--border))",
                        background: "hsl(var(--bg))",
                        color: "hsl(var(--text))",
                      }}
                    />
                    {errors.document_issued_place && (
                      <p className="text-xs text-red-500 mt-1">{String(errors.document_issued_place?.message ?? "")}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      Place of Residence
                    </label>
                    <input
                      {...register("place_of_residence")}
                      placeholder="Place of residence"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: errors.place_of_residence ? "#ef4444" : "hsl(var(--border))",
                        background: "hsl(var(--bg))",
                        color: "hsl(var(--text))",
                      }}
                    />
                    {errors.place_of_residence && (
                      <p className="text-xs text-red-500 mt-1">{String(errors.place_of_residence?.message ?? "")}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      Country of Residence
                    </label>
                    <input
                      {...register("country_of_residence")}
                      placeholder="Country of residence"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: errors.country_of_residence ? "#ef4444" : "hsl(var(--border))",
                        background: "hsl(var(--bg))",
                        color: "hsl(var(--text))",
                      }}
                    />
                    {errors.country_of_residence && (
                      <p className="text-xs text-red-500 mt-1">{String(errors.country_of_residence?.message ?? "")}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      JMBG (Serbian ID)
                    </label>
                    <input
                      {...register("jmbg")}
                      placeholder="JMBG"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: errors.jmbg ? "#ef4444" : "hsl(var(--border))",
                        background: "hsl(var(--bg))",
                        color: "hsl(var(--text))",
                      }}
                    />
                    {errors.jmbg && (
                      <p className="text-xs text-red-500 mt-1">{String(errors.jmbg?.message ?? "")}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            </>
            )}

            {/* Document Upload */}
            {(guestId || newlyCreatedGuestId) && (
              <div className="rounded-lg border p-4" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--bg))" }}>
                <h3 className="text-sm font-medium mb-3" style={{ color: "hsl(var(--text))" }}>
                  Upload Document
                </h3>
                <DocumentUpload
                  guestId={guestId || newlyCreatedGuestId || ""}
                  existingDocuments={existingDocuments}
                  onUploadComplete={(url, fileName) => {
                    toast.success(`Document uploaded: ${fileName}`);
                  }}
                  onError={(error) => {
                    console.error("Upload error:", error);
                  }}
                />
              </div>
            )}

            {/* Notes */}
            {!newlyCreatedGuestId && (
              <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                Notes (optional)
              </label>
              <textarea
                {...register("notes")}
                placeholder="Any additional notes..."
                className="w-full rounded-lg border px-3 py-2 text-sm h-16 resize-none"
                style={{
                  borderColor: errors.notes ? "#ef4444" : "hsl(var(--border))",
                  background: "hsl(var(--bg))",
                  color: "hsl(var(--text))",
                }}
              />
              {errors.notes && (
                <p className="text-xs text-red-500 mt-1">{String(errors.notes?.message ?? "")}</p>
              )}
            </div>
            )}

            {/* Delete button — danger zone */}
            {guestId && (
              <div
                className="p-3 rounded-lg border"
                style={{
                  background: "hsl(var(--bg))",
                  borderColor: "hsl(var(--border))",
                }}
              >
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete this guest"}
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              {newlyCreatedGuestId ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      setNewlyCreatedGuestId(null);
                      onGuestCreated?.();
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-background text-foreground border border-border hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSubmitting ? "Saving..." : guestId ? "Save Changes" : "Create Guest"}
                  </button>
                </>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
