"use client";

import { useRef, useState, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useTranslations } from "next-intl";
import { X, ZoomIn, ZoomOut, RotateCcw, Check } from "lucide-react";

interface Props {
  src: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
}

function centerAspectCrop(w: number, h: number, aspect: number): Crop {
  return centerCrop(makeAspectCrop({ unit: "%", width: 80 }, aspect, w, h), w, h);
}

async function getCroppedBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const size = Math.min(crop.width, crop.height) * Math.max(scaleX, scaleY);

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0, 0, size, size
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed"));
    }, "image/png", 0.95);
  });
}

export default function LogoCropModal({ src, onCrop, onCancel }: Props) {
  const t = useTranslations("settings.property.cropModal");
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number>(1); // 1:1 default
  const [processing, setProcessing] = useState(false);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  const handleApply = async () => {
    if (!imgRef.current || !completedCrop) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop);
      onCrop(blob);
    } catch {
      alert(t("cropFailed"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
      <div className="rounded-2xl shadow-2xl w-full max-w-lg flex flex-col border border-border bg-surface"
        style={{ maxHeight: "calc(100vh - 24px)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t("dragHint")}</p>
          </div>
          <button onClick={onCancel} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Guidelines */}
        <div className="px-4 py-2 bg-muted/40 border-b border-border shrink-0">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-foreground">
            <span className="font-bold uppercase tracking-wider mr-1 text-foreground">{t("guidelines")}</span>
            <span>{t("guideline1")}</span>
            <span>{t("guideline2")}</span>
            <span>{t("guideline3")}</span>
          </div>
        </div>

        {/* Aspect ratio switcher */}
        <div className="flex gap-2 px-4 py-2 border-b border-border shrink-0">
          <span className="text-[11px] font-medium text-muted-foreground self-center mr-1">{t("shape")}</span>
          {[
            { key: "square", label: t("shapeSquare"), value: 1 },
            { key: "4x3", label: t("shape4x3"), value: 4 / 3 },
            { key: "free", label: t("shapeFree"), value: 0 },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                setAspect(opt.value);
                if (imgRef.current && opt.value) {
                  const { width, height } = imgRef.current;
                  setCrop(centerAspectCrop(width, height, opt.value));
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                aspect === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Crop area */}
        <div className="flex items-center justify-center overflow-auto flex-1 p-3"
          style={{ minHeight: 0, background: "#111" }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect || undefined}
            minWidth={40}
            minHeight={40}
            keepSelection
          >
            <img
              ref={imgRef}
              src={src}
              alt={t("cropPreviewAlt")}
              onLoad={onImageLoad}
              style={{ maxHeight: "220px", maxWidth: "100%", display: "block" }}
            />
          </ReactCrop>
        </div>

        {/* Preview strip */}
        {completedCrop && (
          <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium">{t("preview")}</span>
            <CropPreview image={imgRef.current} crop={completedCrop} size={36} label={t("previewSidebar")} />
            <CropPreview image={imgRef.current} crop={completedCrop} size={56} label={t("previewSettings")} />
            <CropPreview image={imgRef.current} crop={completedCrop} size={80} label={t("previewFull")} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-4 py-3 border-t border-border shrink-0">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors">
            {t("cancel")}
          </button>
          <button
            onClick={handleApply}
            disabled={!completedCrop || processing}
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <Check className="w-4 h-4" />
            {processing ? t("processing") : t("applyAndUpload")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CropPreview({ image, crop, size, label }: {
  image: HTMLImageElement | null;
  crop: PixelCrop;
  size: number;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (image && canvasRef.current && crop.width && crop.height) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(image, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, size, size);
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <canvas ref={canvasRef} width={size} height={size}
        className="rounded-sm border border-border bg-surface" style={{ width: size, height: size }} />
      <span className="text-[9px] text-muted-foreground">{label} ({size}px)</span>
    </div>
  );
}
