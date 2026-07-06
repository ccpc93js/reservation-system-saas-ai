"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

export type ConfirmOptions = {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

// Imperative, promise-based confirm. Replaces window.confirm() with a styled
// dialog. Resolves true on confirm, false on cancel/dismiss.
let externalOpen: ((o: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
  if (!externalOpen) {
    // Fallback if the host isn't mounted (SSR / edge cases).
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(o.message) : false);
  }
  return externalOpen(o);
}

// Mount once near the app root. Renders the actual dialog.
export function ConfirmDialogHost() {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ message: "" });
  const [resolver, setResolver] = useState<{ fn: (v: boolean) => void } | null>(null);

  useEffect(() => {
    externalOpen = (o) =>
      new Promise<boolean>((resolve) => {
        setOpts(o);
        setResolver({ fn: resolve });
        setOpen(true);
      });
    return () => { externalOpen = null; };
  }, []);

  const close = (value: boolean) => {
    resolver?.fn(value);
    setResolver(null);
    setOpen(false);
  };

  const destructive = opts.destructive !== false; // default to destructive styling

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) close(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[10050] data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[10051] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-2xl"
        >
          <div className="flex items-start gap-3">
            {destructive && (
              <div className="w-10 h-10 rounded-xl bg-[#EEDCD5] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#9C4A37]" />
              </div>
            )}
            <div className="min-w-0">
              <Dialog.Title className="font-serif text-lg font-semibold text-foreground">
                {opts.title || t("confirmTitle")}
              </Dialog.Title>
              <p className="text-sm text-muted-foreground mt-1">{opts.message}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => close(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-surface text-foreground hover:bg-muted transition-colors"
            >
              {opts.cancelText || t("cancel")}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => close(true)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                destructive ? "bg-[#9C4A37] hover:bg-[#853d2e]" : "bg-primary hover:bg-primary/90"
              }`}
            >
              {opts.confirmText || (destructive ? t("delete") : t("confirm"))}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
