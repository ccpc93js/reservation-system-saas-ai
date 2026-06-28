"use client";

import { useState } from "react";
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
  const [showQR, setShowQR] = useState(false);
  const isDemo = typeof window !== "undefined" && window.location.pathname.startsWith("/demo-hostel");
  const link = generateGuestPortalLink(checkInToken);

  if (isDemo) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center space-y-1">
        <p className="text-sm font-medium text-foreground">Guest check-in links disabled in demo</p>
        <p className="text-xs text-muted-foreground">
          <a href="/signup" className="text-primary hover:underline font-medium">Create a free account</a>
          {" "}to send check-in links to guests.
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied!");
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium"
        title="Copy check-in link"
      >
        <Copy className="w-4 h-4" />
        Check-In Link
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
          title="Copy link"
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
        {showQR ? "Hide" : "Show"} QR Code
      </button>

      {showQR && (
        <div className="p-4 bg-slate-50 rounded-lg flex justify-center">
          <img
            src={generateQRCodeUrl(checkInToken)}
            alt="Check-in QR code"
            className="w-48 h-48"
          />
        </div>
      )}
    </div>
  );
}
