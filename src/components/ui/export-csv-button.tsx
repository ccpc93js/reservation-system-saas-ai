"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

interface ExportCsvButtonProps<T> {
  /** Column definitions (header + how to read each cell from a row). */
  columns: CsvColumn<T>[];
  /** Base filename; a -YYYY-MM-DD date and .csv are appended automatically. */
  filename: string;
  /** Button label, e.g. t("exportCsv"). */
  label: string;
  /** Static rows to export… */
  rows?: T[];
  /** …or fetch ALL rows on click (e.g. beyond the current page). */
  fetchRows?: () => Promise<T[]>;
  /** Shown when there is nothing to export. */
  emptyMessage?: string;
  /** Shown when the export throws. */
  errorMessage?: string;
  disabled?: boolean;
  /** Visual style: green gradient (default, matches Guest Book) or outline. */
  variant?: "gradient" | "outline";
  className?: string;
}

function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => esc(c.value(row))).join(","));
  }
  // UTF-8 BOM so Excel/Sheets render accents correctly.
  return "﻿" + lines.join("\r\n");
}

export default function ExportCsvButton<T>({
  columns,
  filename,
  label,
  rows,
  fetchRows,
  emptyMessage = "Nothing to export",
  errorMessage = "Export failed",
  disabled,
  variant = "gradient",
  className = "",
}: ExportCsvButtonProps<T>) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const data = fetchRows ? await fetchRows() : (rows ?? []);
      if (!data || data.length === 0) { toast.error(emptyMessage); return; }

      const blob = new Blob([toCsv(columns, data)], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(errorMessage);
    } finally {
      setBusy(false);
    }
  };

  const base = "flex items-center gap-2 text-sm font-semibold disabled:opacity-40 transition-all shrink-0";
  const styles =
    variant === "outline"
      ? "px-3 py-2 rounded-xl border border-border bg-background text-foreground hover:bg-muted"
      : "px-4 py-2 rounded-xl text-white";
  const gradientStyle =
    variant === "gradient"
      ? { background: "linear-gradient(135deg, #5f7048, #7f8a58)", boxShadow: "0 4px 14px rgba(95,112,72,0.3)" }
      : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || disabled}
      className={`${base} ${styles} ${className}`}
      style={gradientStyle}
    >
      <Download className={`w-4 h-4 ${busy ? "animate-pulse" : ""}`} />
      {label}
    </button>
  );
}
