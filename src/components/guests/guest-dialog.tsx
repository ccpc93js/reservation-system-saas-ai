"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { COUNTRIES } from "@/lib/countries";
import { createGuestSchema, updateGuestSchema, type CreateGuestInput } from "@/lib/validations/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import { useOrgCountry, isSerbia } from "@/lib/hooks/use-org-country";
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

const DOCUMENT_TYPES = ["passport", "national_id", "drivers_license"] as const;
const GENDERS = ["male", "female", "other"] as const;

export default function GuestDialog({
  open,
  onOpenChange,
  guestId,
  orgId,
  onGuestCreated,
  onGuestUpdated,
}: GuestDialogProps) {
  const t = useTranslations("guests.dialog");
  const isSerbian = isSerbia(useOrgCountry(orgId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [guest, setGuest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandDocumentInfo, setExpandDocumentInfo] = useState(false);
  const [duplicateGuest, setDuplicateGuest] = useState<any>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [forceCreateDuplicate, setForceCreateDuplicate] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryOfBirthDropdown, setShowCountryOfBirthDropdown] = useState(false);
  const [countryOfBirthSearch, setCountryOfBirthSearch] = useState("");
  const [showCountryOfResidenceDropdown, setShowCountryOfResidenceDropdown] = useState(false);
  const [countryOfResidenceSearch, setCountryOfResidenceSearch] = useState("");
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

  const handleExtractedData = (extractedFields: Record<string, any>) => {
    // Pre-fill form fields with extracted data
    Object.entries(extractedFields).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        setValue(key, value);
      }
    });
    toast.success(t("toastExtracted"));
  };

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

  const nationalityValue = watch("nationality") || "";
  const filteredCountries = COUNTRIES.filter((country) =>
    country.toLowerCase().includes(countrySearch.toLowerCase())
  );
  const countryOfBirthValue = watch("country_of_birth") || "";
  const filteredCountriesOfBirth = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countryOfBirthSearch.toLowerCase())
  );
  const countryOfResidenceValue = watch("country_of_residence") || "";
  const filteredCountriesOfResidence = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countryOfResidenceSearch.toLowerCase())
  );

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
        toast.error(t("toastLoadFailed"));
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

        toast.error(result.error || t("toastSaveFailed"));
        return;
      }

      toast.success(guestId ? t("toastUpdated") : t("toastCreated"));

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
      toast.error(t("toastSaveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!guestId || !confirm(t("confirmDelete"))) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/guests/${guestId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || t("toastDeleteFailed"));
        return;
      }

      toast.success(t("toastDeleted"));
      onOpenChange(false);
      onGuestUpdated?.();
    } catch (error) {
      toast.error(t("toastDeleteError"));
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
        throw new Error(result.error || t("toastMergeFailed"));
      }

      toast.success(t("toastMerged"));
      onOpenChange(false);
      reset();
      setShowMergeDialog(false);
      setDuplicateGuest(null);
      onGuestCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toastMergeFailed"));
    }
  };

  if (isLoading) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[10001]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-[50%] top-[50%] z-[10002] w-[calc(100vw-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-surface p-6 shadow-lg max-h-[85dvh] overflow-y-auto"
          >
            <Dialog.Title className="sr-only">{guestId ? t("editTitle") : t("newTitle")}</Dialog.Title>
            <p className="text-muted-foreground">{t("loading")}</p>
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
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[10001]" />
        <Dialog.Content
          ref={scrollContainerRef}
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-[10002] w-[calc(100vw-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-surface p-6 shadow-lg max-h-[85dvh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-serif text-2xl font-semibold text-foreground">
              {guestId ? t("editTitle") : t("newTitle")}
            </Dialog.Title>
            <Dialog.Close
              onClick={() => {
                if (newlyCreatedGuestId) {
                  onGuestCreated?.();
                  setNewlyCreatedGuestId(null);
                }
              }}
              className="rounded p-1 hover:bg-muted transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </Dialog.Close>
          </div>

          {duplicateGuest && (
            <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 mb-2">
                    {t("duplicateFound")}
                  </p>
                  <div className="text-sm text-amber-800 space-y-1 mb-3">
                    <p><strong>{t("duplicateName")}</strong> {duplicateGuest.name}</p>
                    <p><strong>{t("duplicateDocument")}</strong> {duplicateGuest.document_type} {duplicateGuest.document_number}</p>
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
                      {t("useExisting")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Merge dialog will be shown by showMergeDialog state
                      }}
                      className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
                    >
                      {t("mergeRecords")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form
            ref={submitFormRef}
            onSubmit={handleSubmit(
              (data) => onSubmit(data),
              (formErrors) => {
                // If a validation error is inside the collapsed Document
                // Information section, expand it so the user can see it.
                const docFields = [
                  "document_type", "document_number", "document_expiry",
                  "document_issued_date", "document_issued_place",
                  "place_of_residence", "country_of_residence",
                  "jmbg", "unique_master_citizen",
                ];
                if (docFields.some((f) => (formErrors as any)[f])) {
                  setExpandDocumentInfo(true);
                }
              }
            )}
            className="space-y-4"
          >
            {/* OCR Upload Section - Show at TOP for new guests */}
            {!guestId && (
              <div className="rounded-lg border p-4 bg-primary/5 border-primary/20">
                <h3 className="text-sm font-medium mb-3 text-foreground">
                  {t("ocrTitle")}
                </h3>
                <p className="text-xs text-primary/80 mb-3">
                  {t("ocrSubtitle")}
                </p>
                <DocumentUpload
                  guestId=""
                  existingDocuments={[]}
                  onUploadComplete={(url, fileName) => {
                    toast.success(t("uploadSuccess", { fileName }));
                  }}
                  onExtractedData={handleExtractedData}
                  onError={(error) => {
                    console.error("Upload error:", error);
                  }}
                />
              </div>
            )}

            {/* Post-creation upload mode */}
            {newlyCreatedGuestId && (
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                <p className="text-sm font-semibold text-emerald-900 mb-2">{t("createdSuccess")}</p>
                <p className="text-xs text-emerald-800">{t("createdSuccessHint")}</p>
              </div>
            )}

            {/* Form fields (hidden in upload mode) */}
            {!newlyCreatedGuestId && (
              <>
            {/* First & Last Name */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                  {t("firstName")}
                </label>
                <input
                  {...register("first_name")}
                  placeholder={t("firstNamePlaceholder")}
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
                  {t("lastName")}
                </label>
                <input
                  {...register("last_name")}
                  placeholder={t("lastNamePlaceholder")}
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
                  {t("email")}
                </label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder={t("email")}
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
                  {t("phone")}
                </label>
                <input
                  {...register("phone")}
                  placeholder={t("phone")}
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
                  {t("gender")}
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
                  <option value="">{t("selectGender")}</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {t(`gender_${g}`)}
                    </option>
                  ))}
                </select>
                {errors.gender && (
                  <p className="text-xs text-red-500 mt-1">{String(errors.gender?.message ?? "")}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                  {t("nationality")}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCountryDropdown(!showCountryDropdown);
                      setCountrySearch("");
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-left flex items-center justify-between"
                    style={{
                      borderColor: errors.nationality ? "#ef4444" : "hsl(var(--border))",
                      background: "hsl(var(--bg))",
                      color: nationalityValue ? "hsl(var(--text))" : "hsl(var(--muted))",
                    }}
                  >
                    <span>{nationalityValue || t("selectCountry")}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {showCountryDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-50 border" style={{ background: "hsl(var(--bg))", borderColor: "hsl(var(--border))" }}>
                      <input
                        type="text"
                        placeholder={t("searchCountry")}
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="w-full rounded-t-lg border-b px-3 py-2 text-sm focus:outline-none"
                        style={{
                          borderColor: "hsl(var(--border))",
                          background: "hsl(var(--bg))",
                          color: "hsl(var(--text))",
                        }}
                        autoFocus
                      />
                      <div className="max-h-48 overflow-y-auto">
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((country) => (
                            <button
                              key={country}
                              type="button"
                              onClick={() => {
                                setValue("nationality", country);
                                setShowCountryDropdown(false);
                                setCountrySearch("");
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity"
                              style={{
                                background:
                                  nationalityValue === country
                                    ? "hsl(var(--primary))"
                                    : "transparent",
                                color:
                                  nationalityValue === country
                                    ? "hsl(var(--primary-foreground))"
                                    : "hsl(var(--text))",
                                fontWeight:
                                  nationalityValue === country
                                    ? "600"
                                    : "normal",
                              }}
                            >
                              {country}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-3 text-center text-sm" style={{ color: "hsl(var(--muted))" }}>
                            {t("noCountriesFound")}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {errors.nationality && (
                  <p className="text-xs text-red-500 mt-1">{String(errors.nationality?.message ?? "")}</p>
                )}
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                {t("dateOfBirth")}
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
                  {t("placeOfBirth")}
                </label>
                <input
                  {...register("place_of_birth")}
                  placeholder={t("placeOfBirthPlaceholder")}
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
                  {t("countryOfBirth")}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowCountryOfBirthDropdown(!showCountryOfBirthDropdown); setCountryOfBirthSearch(""); }}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-left flex items-center justify-between"
                    style={{
                      borderColor: errors.country_of_birth ? "#ef4444" : "hsl(var(--border))",
                      background: "hsl(var(--bg))",
                      color: countryOfBirthValue ? "hsl(var(--text))" : "hsl(var(--muted))",
                    }}
                  >
                    <span>{countryOfBirthValue || t("selectCountry")}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showCountryOfBirthDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-50 border" style={{ background: "hsl(var(--bg))", borderColor: "hsl(var(--border))" }}>
                      <input
                        type="text"
                        placeholder={t("searchCountry")}
                        value={countryOfBirthSearch}
                        onChange={(e) => setCountryOfBirthSearch(e.target.value)}
                        className="w-full rounded-t-lg border-b px-3 py-2 text-sm focus:outline-none"
                        style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--bg))", color: "hsl(var(--text))" }}
                        autoFocus
                      />
                      <div className="max-h-48 overflow-y-auto">
                        {filteredCountriesOfBirth.length > 0 ? (
                          filteredCountriesOfBirth.map((country) => (
                            <button
                              key={country}
                              type="button"
                              onClick={() => { setValue("country_of_birth", country); setShowCountryOfBirthDropdown(false); setCountryOfBirthSearch(""); }}
                              className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity"
                              style={{
                                background: countryOfBirthValue === country ? "hsl(var(--primary))" : "transparent",
                                color: countryOfBirthValue === country ? "hsl(var(--primary-foreground))" : "hsl(var(--text))",
                                fontWeight: countryOfBirthValue === country ? "600" : "normal",
                              }}
                            >
                              {country}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-3 text-center text-sm" style={{ color: "hsl(var(--muted))" }}>{t("noCountriesFound")}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
                {expandDocumentInfo ? "▼" : "▶"} {t("documentInfo")}
              </button>
              {expandDocumentInfo && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      {t("documentType")}
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
                      <option value="">{t("selectType")}</option>
                      {DOCUMENT_TYPES.map((d) => (
                        <option key={d} value={d}>
                          {t(`docType_${d}`)}
                        </option>
                      ))}
                    </select>
                    {errors.document_type && (
                      <p className="text-xs text-red-500 mt-1">{String(errors.document_type?.message ?? "")}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      {t("documentNumber")}
                    </label>
                    <input
                      {...register("document_number")}
                      placeholder={t("documentNumberPlaceholder")}
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
                      {t("documentExpiry")}
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
                      {t("documentIssuedDate")}
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
                      {t("documentIssuedPlace")}
                    </label>
                    <input
                      {...register("document_issued_place")}
                      placeholder={t("documentIssuedPlacePlaceholder")}
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
                      {t("placeOfResidence")}
                    </label>
                    <input
                      {...register("place_of_residence")}
                      placeholder={t("placeOfResidence")}
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
                      {t("countryOfResidence")}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setShowCountryOfResidenceDropdown(!showCountryOfResidenceDropdown); setCountryOfResidenceSearch(""); }}
                        className="w-full rounded-lg border px-3 py-2 text-sm text-left flex items-center justify-between"
                        style={{
                          borderColor: errors.country_of_residence ? "#ef4444" : "hsl(var(--border))",
                          background: "hsl(var(--bg))",
                          color: countryOfResidenceValue ? "hsl(var(--text))" : "hsl(var(--muted))",
                        }}
                      >
                        <span>{countryOfResidenceValue || t("selectCountry")}</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {showCountryOfResidenceDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-50 border" style={{ background: "hsl(var(--bg))", borderColor: "hsl(var(--border))" }}>
                          <input
                            type="text"
                            placeholder={t("searchCountry")}
                            value={countryOfResidenceSearch}
                            onChange={(e) => setCountryOfResidenceSearch(e.target.value)}
                            className="w-full rounded-t-lg border-b px-3 py-2 text-sm focus:outline-none"
                            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--bg))", color: "hsl(var(--text))" }}
                            autoFocus
                          />
                          <div className="max-h-48 overflow-y-auto">
                            {filteredCountriesOfResidence.length > 0 ? (
                              filteredCountriesOfResidence.map((country) => (
                                <button
                                  key={country}
                                  type="button"
                                  onClick={() => { setValue("country_of_residence", country); setShowCountryOfResidenceDropdown(false); setCountryOfResidenceSearch(""); }}
                                  className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity"
                                  style={{
                                    background: countryOfResidenceValue === country ? "hsl(var(--primary))" : "transparent",
                                    color: countryOfResidenceValue === country ? "hsl(var(--primary-foreground))" : "hsl(var(--text))",
                                    fontWeight: countryOfResidenceValue === country ? "600" : "normal",
                                  }}
                                >
                                  {country}
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-3 text-center text-sm" style={{ color: "hsl(var(--muted))" }}>{t("noCountriesFound")}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {errors.country_of_residence && (
                      <p className="text-xs text-red-500 mt-1">{String(errors.country_of_residence?.message ?? "")}</p>
                    )}
                  </div>
                  {isSerbian && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "hsl(var(--text))" }}>
                      {t("jmbg")}
                    </label>
                    <input
                      {...register("jmbg")}
                      placeholder={t("jmbgPlaceholder")}
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
                  )}
                </div>
              )}
            </div>
            </>
            )}

            {/* Document Upload */}
            {(guestId || newlyCreatedGuestId) && (
              <div className="rounded-lg border p-4" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--bg))" }}>
                <h3 className="text-sm font-medium mb-3" style={{ color: "hsl(var(--text))" }}>
                  {t("uploadDocument")}
                </h3>
                <DocumentUpload
                  guestId={guestId || newlyCreatedGuestId || ""}
                  existingDocuments={existingDocuments}
                  onUploadComplete={(url, fileName) => {
                    toast.success(t("uploadSuccess", { fileName }));
                  }}
                  onExtractedData={handleExtractedData}
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
                {t("notes")}
              </label>
              <textarea
                {...register("notes")}
                placeholder={t("notesPlaceholder")}
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
                  {isDeleting ? t("deleting") : t("deleteThisGuest")}
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
                    {t("done")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-background text-foreground border border-border hover:bg-muted"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSubmitting ? t("saving") : guestId ? t("saveChanges") : t("createGuest")}
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
