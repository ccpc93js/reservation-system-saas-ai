"use client";

import { useState, useEffect, useRef } from "react";
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

const FORM_STEPS: { id: FormStep; label: string; description: string }[] = [
  { id: "form", label: "Your Details", description: "Fill in your information" },
  { id: "photos", label: "ID Photos", description: "Upload front and back" },
  { id: "review", label: "Review", description: "Verify everything" },
  { id: "submit", label: "Complete", description: "Submit for verification" },
];

const DOCUMENT_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's License" },
];

export default function CheckInForm({ token }: CheckInFormProps) {
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
              ? "Check-in window has closed"
              : "Invalid or expired link"
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
          setError(
            `Your previous submission was rejected: ${result.rejection_reason}\n\nPlease review and resubmit.`
          );
        }
      } catch (err: any) {
        setError(err.message || "Failed to load reservation");
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
          newErrors[name] = "Required";
        } else if (value.trim().length < 2) {
          newErrors[name] = "At least 2 characters";
        } else {
          delete newErrors[name];
        }
        break;
      case "email":
        if (!value.trim()) {
          newErrors[name] = "Required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors[name] = "Invalid email";
        } else {
          delete newErrors[name];
        }
        break;
      case "phone":
        if (!value.trim()) {
          newErrors[name] = "Required";
        } else if (value.replace(/\D/g, "").length < 10) {
          newErrors[name] = "At least 10 digits";
        } else {
          delete newErrors[name];
        }
        break;
      case "document_number":
        if (!value.trim()) {
          newErrors[name] = "Required";
        } else if (value.trim().length < 3) {
          newErrors[name] = "At least 3 characters";
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
        [`${side}_file`]: "Only JPG, PNG, or WebP files allowed",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors({
        ...errors,
        [`${side}_file`]: "File size must be under 5MB",
      });
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
        throw new Error(errorData.error || "Failed to submit check-in");
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Submission failed");
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
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
          <div>
            <h2 className="font-semibold text-foreground">Error</h2>
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

      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Step 1: Form */}
        {currentStep === "form" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">Your Details</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  First Name
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
                  Last Name
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
                Email
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
                Phone
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
                Nationality
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
                    {nationalityValue || "Select country..."}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {showCountryDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50">
                    <input
                      type="text"
                      placeholder="Search..."
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
                          No results
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
                  Document Type
                </label>
                <select
                  value={formData.document_type}
                  onChange={(e) =>
                    handleInputChange("document_type", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select...</option>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Document Number
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
                Emergency Contact Number
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
                  setCurrentStep(canProceedToPhotos ? "photos" : "form")
                }
                disabled={!canProceedToPhotos()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Photos */}
        {currentStep === "photos" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">ID Photos</h2>

            {/* Front ID */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Front of ID <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Examples: Passport, National ID, Driver's License
              </p>

              {previews.front ? (
                <div className="space-y-3">
                  <img
                    src={previews.front}
                    alt="Front ID"
                    className="w-full rounded-lg max-h-64 object-cover"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputFrontRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-muted"
                    >
                      <Upload className="w-4 h-4" /> Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFiles({ ...files, front: null });
                        setPreviews({ ...previews, front: null });
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <X className="w-4 h-4" /> Remove
                    </button>
                  </div>
                  <input
                    ref={fileInputFrontRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "front")}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-foreground font-medium mb-3">
                    Upload photo
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputFrontRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                  >
                    <Upload className="w-4 h-4" /> Choose Photo
                  </button>
                  <input
                    ref={fileInputFrontRef}
                    type="file"
                    accept="image/*"
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
                Back of ID <span className="text-muted-foreground">(Optional)</span>
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Upload the back side if available
              </p>

              {previews.back ? (
                <div className="space-y-3">
                  <img
                    src={previews.back}
                    alt="Back ID"
                    className="w-full rounded-lg max-h-64 object-cover"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputBackRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-muted"
                    >
                      <Upload className="w-4 h-4" /> Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFiles({ ...files, back: null });
                        setPreviews({ ...previews, back: null });
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <X className="w-4 h-4" /> Remove
                    </button>
                  </div>
                  <input
                    ref={fileInputBackRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "back")}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-foreground font-medium mb-3">
                    Upload photo (optional)
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputBackRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                  >
                    <Upload className="w-4 h-4" /> Choose Photo
                  </button>
                  <input
                    ref={fileInputBackRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "back")}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setCurrentStep("form")}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setCurrentStep("review")}
                disabled={!canProceedToReview()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === "review" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">Review Your Information</h2>

            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">NAME</p>
                <p className="text-sm text-foreground">
                  {formData.first_name} {formData.last_name}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">EMAIL</p>
                <p className="text-sm text-foreground">{formData.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  NATIONALITY
                </p>
                <p className="text-sm text-foreground">{formData.nationality}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">DOCUMENT</p>
                <p className="text-sm text-foreground">
                  {DOCUMENT_TYPES.find((d) => d.value === formData.document_type)
                    ?.label || formData.document_type}{" "}
                  - {formData.document_number}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {previews.front && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    FRONT ID
                  </p>
                  <img
                    src={previews.front}
                    alt="Front"
                    className="w-full rounded-lg max-h-48 object-cover"
                  />
                </div>
              )}
              {previews.back && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    BACK ID
                  </p>
                  <img
                    src={previews.back}
                    alt="Back"
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
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setCurrentStep("submit")}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Looks Good <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Submit */}
        {currentStep === "submit" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">Ready to Submit?</h2>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-foreground">
                Your information will be reviewed by our staff within 24 hours. You'll
                receive an email confirmation once your ID has been verified.
              </p>
            </div>

            <div className="flex justify-between gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setCurrentStep("review")}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Submit Check-In
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
