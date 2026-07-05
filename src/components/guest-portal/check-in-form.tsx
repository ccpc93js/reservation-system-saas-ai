"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Upload,
  AlertCircle,
  CheckCircle,
  Loader,
  ChevronDown,
  X,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import CheckInSuccess from "./check-in-success";

interface ReservationData {
  reservation: {
    id: string;
    reservation_number: string;
    check_in: string;
    check_out: string;
    room: { name: string; floor?: number } | null;
    total_amount: number;
  };
  guest: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    nationality: string;
    document_type: string;
    document_number: string;
    emergency_contact: string;
  };
  check_in_status: "pending" | "submitted" | "verified";
  rejection_reason: string | null;
}

interface CheckInFormProps {
  token: string;
}

type FormStep = "form" | "photos" | "review" | "submit";

const FORM_STEP_IDS: FormStep[] = ["form", "photos", "review", "submit"];
const DOCUMENT_TYPE_VALUES = ["passport", "national_id", "drivers_license"] as const;

export default function CheckInForm({ token }: CheckInFormProps) {
  const t = useTranslations("guestPortal.checkInForm");
  const FORM_STEPS = FORM_STEP_IDS.map((id) => ({
    id,
    label: t(`steps.${id}.label`),
    description: t(`steps.${id}.description`),
  }));
  const [currentStep, setCurrentStep] = useState<FormStep>("form");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<ReservationData | null>(null);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const fileInputFrontRef = useRef<HTMLInputElement>(null);
  const fileInputBackRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    nationality: "",
    document_type: "",
    document_number: "",
    emergency_contact: "",
  });

  const [files, setFiles] = useState<{ front: File | null; back: File | null }>({
    front: null,
    back: null,
  });

  const [previews, setPreviews] = useState<{ front: string | null; back: string | null }>({
    front: null,
    back: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredCountries = COUNTRIES.filter((country) =>
    country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const nationalityValue = formData.nationality || "";

  // Fetch reservation data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/guest-portal/${token}`);
        if (!res.ok) {
          throw new Error(
            res.status === 410
              ? t("errorWindowClosed")
              : t("errorInvalidLink")
          );
        }
        const result = await res.json();
        console.log("Guest portal data:", result);
        setData(result);

        // Pre-fill form
        setFormData({
          first_name: result.guest.first_name || "",
          last_name: result.guest.last_name || "",
          email: result.guest.email || "",
          phone: result.guest.phone || "",
          nationality: result.guest.nationality || "",
          document_type: result.guest.document_type || "",
          document_number: result.guest.document_number || "",
          emergency_contact: result.guest.emergency_contact || "",
        });

        // Show rejection info if applicable
        console.log("Check-in status:", result.check_in_status, "Rejection reason:", result.rejection_reason);
        if (result.check_in_status === "submitted" && result.rejection_reason) {
          console.log("Showing rejection error");
          setError(t("rejectionMessage", { reason: result.rejection_reason }));
        }
      } catch (err: any) {
        setError(err.message || t("errorLoadFailed"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Validate form fields in real-time
  const validateField = (name: string, value: string) => {
    const newErrors = { ...errors };

    switch (name) {
      case "first_name":
      case "last_name":
        if (!value.trim()) {
          newErrors[name] = t("validation.required");
        } else if (value.trim().length < 2) {
          newErrors[name] = t("validation.minChars", { count: 2 });
        } else {
          delete newErrors[name];
        }
        break;
      case "email":
        if (!value.trim()) {
          newErrors[name] = t("validation.required");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors[name] = t("validation.invalidEmail");
        } else {
          delete newErrors[name];
        }
        break;
      case "phone":
        if (!value.trim()) {
          newErrors[name] = t("validation.required");
        } else if (value.replace(/\D/g, "").length < 10) {
          newErrors[name] = t("validation.minDigits", { count: 10 });
        } else {
          delete newErrors[name];
        }
        break;
      case "document_number":
        if (!value.trim()) {
          newErrors[name] = t("validation.required");
        } else if (value.trim().length < 3) {
          newErrors[name] = t("validation.minChars", { count: 3 });
        } else {
          delete newErrors[name];
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    validateField(field, value);
  };


  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    side: "front" | "back"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors({
        ...errors,
        [`${side}_file`]: t("fileErrorInvalidType"),
      });
      e.target.value = ""; // allow re-selecting the same file after fixing
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors({
        ...errors,
        [`${side}_file`]: t("fileErrorTooLarge"),
      });
      e.target.value = "";
      return;
    }

    setFiles({ ...files, [side]: file });
    const reader = new FileReader();
    reader.onload = (evt) => {
      setPreviews({
        ...previews,
        [side]: evt.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
    delete errors[`${side}_file`];
    setErrors(errors);
  };

  const canProceedToPhotos = () => {
    return (
      formData.first_name.trim() &&
      formData.last_name.trim() &&
      formData.email.trim() &&
      formData.phone.trim() &&
      formData.nationality &&
      formData.document_type &&
      formData.document_number.trim() &&
      Object.keys(errors).length === 0
    );
  };

  const canProceedToReview = () => files.front !== null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formDataToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value);
      });
      if (files.front) formDataToSend.append("id_photo_front", files.front);
      if (files.back) formDataToSend.append("id_photo_back", files.back);

      const res = await fetch(`/api/guest-portal/${token}/submit-check-in`, {
        method: "POST",
        body: formDataToSend,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || t("errorSubmitFailed"));
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t("errorSubmissionFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-md w-full p-6 bg-surface rounded-lg shadow-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
          <div>
            <h2 className="font-semibold text-foreground">{t("errorTitle")}</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return <CheckInSuccess reservation={data.reservation} />;
  }

  return (
    <div className="max-w-2xl w-full">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex justify-between mb-4">
          {FORM_STEPS.map((step, idx) => {
            const isActive = step.id === currentStep;
            const isCompleted =
              FORM_STEPS.findIndex((s) => s.id === currentStep) > idx;
            return (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm mb-2 ${
                    isCompleted
                      ? "bg-emerald-500 text-white"
                      : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                </div>
                <p className="text-xs font-medium text-foreground">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            );
          })}
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${((FORM_STEPS.findIndex((s) => s.id === currentStep) + 1) / FORM_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-lg shadow-lg p-6">
        {/* Step 1: Form */}
        {currentStep === "form" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">{t("steps.form.label")}</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("firstName")}
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) =>
                    handleInputChange("first_name", e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    errors.first_name ? "border-red-500" : "border-border"
                  }`}
                  placeholder="John"
                />
                {errors.first_name && (
                  <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("lastName")}
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange("last_name", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    errors.last_name ? "border-red-500" : "border-border"
                  }`}
                  placeholder="Doe"
                />
                {errors.last_name && (
                  <p className="text-xs text-red-500 mt-1">{errors.last_name}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("email")}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.email ? "border-red-500" : "border-border"
                }`}
                placeholder="john@example.com"
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("phone")}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.phone ? "border-red-500" : "border-border"
                }`}
                placeholder="+1 (555) 123-4567"
              />
              {errors.phone && (
                <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("nationality")}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowCountryDropdown(!showCountryDropdown);
                    setCountrySearch("");
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-left flex items-center justify-between bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <span
                    className={
                      nationalityValue
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {nationalityValue || t("selectCountry")}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {showCountryDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50">
                    <input
                      type="text"
                      placeholder={t("searchEllipsis")}
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full px-3 py-2 border-b border-border focus:outline-none"
                      autoFocus
                    />
                    <div className="max-h-48 overflow-y-auto">
                      {filteredCountries.length > 0 ? (
                        filteredCountries.map((country) => (
                          <button
                            key={country}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, nationality: country });
                              setShowCountryDropdown(false);
                              setCountrySearch("");
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                              nationalityValue === country
                                ? "bg-primary text-primary-foreground font-semibold"
                                : "text-foreground"
                            }`}
                          >
                            {country}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-center text-sm text-muted-foreground">
                          {t("noResults")}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("documentType")}
                </label>
                <select
                  value={formData.document_type}
                  onChange={(e) =>
                    handleInputChange("document_type", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">{t("selectEllipsis")}</option>
                  {DOCUMENT_TYPE_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {t(`docType_${v}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("documentNumber")}
                </label>
                <input
                  type="text"
                  value={formData.document_number}
                  onChange={(e) =>
                    handleInputChange("document_number", e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    errors.document_number ? "border-red-500" : "border-border"
                  }`}
                  placeholder="123456789"
                />
                {errors.document_number && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.document_number}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("emergencyContact")}
              </label>
              <input
                type="tel"
                value={formData.emergency_contact}
                onChange={(e) =>
                  setFormData({ ...formData, emergency_contact: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="+1 (555) 987-6543"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() =>
                  setCurrentStep(canProceedToPhotos() ? "photos" : "form")
                }
                disabled={!canProceedToPhotos()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("next")} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Photos */}
        {currentStep === "photos" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">{t("steps.photos.label")}</h2>

            {/* Front ID */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("frontOfId")} <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                {t("frontIdExamples")}
              </p>

              {previews.front ? (
                <div className="space-y-3">
                  <img
                    src={previews.front}
                    alt={t("frontIdAlt")}
                    className="w-full rounded-lg max-h-64 object-cover"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputFrontRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-muted"
                    >
                      <Upload className="w-4 h-4" /> {t("change")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFiles({ ...files, front: null });
                        setPreviews({ ...previews, front: null });
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <X className="w-4 h-4" /> {t("remove")}
                    </button>
                  </div>
                  <input
                    ref={fileInputFrontRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileUpload(e, "front")}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-foreground font-medium mb-3">
                    {t("uploadPhoto")}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputFrontRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                  >
                    <Upload className="w-4 h-4" /> {t("choosePhoto")}
                  </button>
                  <input
                    ref={fileInputFrontRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileUpload(e, "front")}
                    className="hidden"
                  />
                  {errors.front_file && (
                    <p className="text-xs text-red-500 mt-2">{errors.front_file}</p>
                  )}
                </div>
              )}
            </div>

            {/* Back ID */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("backOfId")} <span className="text-muted-foreground">{t("optionalLabel")}</span>
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                {t("backIdHint")}
              </p>

              {previews.back ? (
                <div className="space-y-3">
                  <img
                    src={previews.back}
                    alt={t("backIdAlt")}
                    className="w-full rounded-lg max-h-64 object-cover"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputBackRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-muted"
                    >
                      <Upload className="w-4 h-4" /> {t("change")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFiles({ ...files, back: null });
                        setPreviews({ ...previews, back: null });
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <X className="w-4 h-4" /> {t("remove")}
                    </button>
                  </div>
                  <input
                    ref={fileInputBackRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileUpload(e, "back")}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-foreground font-medium mb-3">
                    {t("uploadPhotoOptional")}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputBackRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                  >
                    <Upload className="w-4 h-4" /> {t("choosePhoto")}
                  </button>
                  <input
                    ref={fileInputBackRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileUpload(e, "back")}
                    className="hidden"
                  />
                </div>
              )}
            </div>
            {errors.back_file && (
              <p className="text-xs text-red-500 mt-2">{errors.back_file}</p>
            )}

            <div className="flex justify-between gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setCurrentStep("form")}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4" /> {t("back")}
              </button>
              <button
                onClick={() => setCurrentStep("review")}
                disabled={!canProceedToReview()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("next")} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === "review" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">{t("reviewTitle")}</h2>

            <div className="bg-background rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{t("nameCaps")}</p>
                <p className="text-sm text-foreground">
                  {formData.first_name} {formData.last_name}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{t("emailCaps")}</p>
                <p className="text-sm text-foreground">{formData.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("nationalityCaps")}
                </p>
                <p className="text-sm text-foreground">{formData.nationality}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{t("documentCaps")}</p>
                <p className="text-sm text-foreground">
                  {formData.document_type ? t(`docType_${formData.document_type}`) : formData.document_type}{" "}
                  - {formData.document_number}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {previews.front && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {t("frontIdCaps")}
                  </p>
                  <img
                    src={previews.front}
                    alt={t("front")}
                    className="w-full rounded-lg max-h-48 object-cover"
                  />
                </div>
              )}
              {previews.back && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {t("backIdCaps")}
                  </p>
                  <img
                    src={previews.back}
                    alt={t("backLabel")}
                    className="w-full rounded-lg max-h-48 object-cover"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setCurrentStep("photos")}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4" /> {t("back")}
              </button>
              <button
                onClick={() => setCurrentStep("submit")}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                {t("looksGood")} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Submit */}
        {currentStep === "submit" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">{t("readyToSubmit")}</h2>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-foreground">
                {t("submitNotice")}
              </p>
            </div>

            <div className="flex justify-between gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setCurrentStep("review")}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4" /> {t("back")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" /> {t("submitting")}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> {t("submitCheckIn")}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
