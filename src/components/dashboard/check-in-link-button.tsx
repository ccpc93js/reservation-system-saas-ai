"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { generateGuestPortalLink, generateQRCodeUrl } from "@/lib/qr-code";

interface CheckInLinkButtonProps {
  checkInToken: string;
  compact?: boolean;
}

export default function CheckInLinkButton({
  checkInToken,
  compact = false,
}: CheckInLinkButtonProps) {
  const t = useTranslations("checkInLinkButton");
  const [showQR, setShowQR] = useState(false);
  const isDemo = typeof window !== "undefined" && window.location.pathname.startsWith("/demo-hostel");
  const link = generateGuestPortalLink(checkInToken);

  if (isDemo) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center space-y-1">
        <p className="text-sm font-medium text-foreground">{t("disabledInDemo")}</p>
        <p className="text-xs text-muted-foreground">
          <a href="/signup" className="text-primary hover:underline font-medium">{t("createFreeAccount")}</a>
          {" "}{t("toSendLinks")}
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    toast.success(t("toastLinkCopied"));
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium"
        title={t("copyCheckInLinkTitle")}
      >
        <Copy className="w-4 h-4" />
        {t("checkInLink")}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={link}
          className="flex-1 px-3 py-2 bg-slate-50 border border-border rounded-lg text-sm font-mono text-muted-foreground"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/70 rounded-lg transition-colors"
          title={t("copyLinkTitle")}
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowQR(!showQR)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-slate-50 transition-colors text-sm"
      >
        <QrCode className="w-4 h-4" />
        {showQR ? t("hideQrCode") : t("showQrCode")}
      </button>

      {showQR && (
        <div className="p-4 bg-slate-50 rounded-lg flex justify-center">
          <img
            src={generateQRCodeUrl(checkInToken)}
            alt={t("qrCodeAlt")}
            className="w-48 h-48"
          />
        </div>
      )}
    </div>
  );
}
