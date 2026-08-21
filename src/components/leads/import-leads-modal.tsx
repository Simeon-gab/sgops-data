"use client";

import { useRef, useState } from "react";
import { Upload, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { NICHES } from "@/lib/utils/constants";
import {
  IMPORT_FIELDS,
  parseCSV,
  autoDetectMapping,
  buildSampleCSV,
  type ColumnMapping,
  type ImportField,
} from "@/lib/utils/csv";
import type { LeadImportRow, LeadImportResponse } from "@/lib/utils/types";

const SELECT_CLS =
  "appearance-none bg-bg-2 border border-border rounded-lg pl-3 pr-7 py-2 text-sm text-text-1 " +
  "focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-colors cursor-pointer w-full";

interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type Step = "upload" | "map" | "done";

export function ImportLeadsModal({ open, onClose, onImported }: ImportLeadsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [nicheId, setNicheId] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<LeadImportResponse | null>(null);

  function reset() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping(null);
    setNicheId("");
    setImporting(false);
    setResult(null);
  }

  function handleClose() {
    if (importing) return;
    const imported = result && result.imported > 0;
    reset();
    onClose();
    if (imported) onImported();
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      toast("Please choose a .csv file", "error");
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast("This file looks empty. It needs a header row plus data rows.", "error");
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoDetectMapping(parsed.headers));
      setStep("map");
    } catch {
      toast("Could not read the file", "error");
    }
  }

  function handleSampleDownload() {
    const blob = new Blob([buildSampleCSV()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sgops-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function mappedValue(row: string[], field: ImportField): string {
    if (!mapping) return "";
    const idx = mapping[field];
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  }

  async function handleImport() {
    if (!mapping || mapping.email === -1) return;

    const importRows: LeadImportRow[] = rows.map((row) => ({
      name: mappedValue(row, "name"),
      email: mappedValue(row, "email"),
      phone: mappedValue(row, "phone") || undefined,
      website: mappedValue(row, "website") || undefined,
      country: mappedValue(row, "country") || undefined,
      state: mappedValue(row, "state") || undefined,
      city: mappedValue(row, "city") || undefined,
      notes: mappedValue(row, "notes") || undefined,
    }));

    setImporting(true);
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRows, niche_id: nicheId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data as LeadImportResponse);
      setStep("done");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setImporting(false);
    }
  }

  const emailMapped = mapping !== null && mapping.email !== -1;
  const previewRows = rows.slice(0, 3);

  return (
    <Modal open={open} onClose={handleClose} title="Import leads from CSV" size="xl">
      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-gold rounded-xl p-10 flex flex-col items-center gap-3 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-bg-3 flex items-center justify-center">
              <Upload className="h-6 w-6 text-text-3" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-1">Choose a CSV file</p>
              <p className="text-xs text-text-3 mt-1">
                Your contact list from Excel, Google Contacts, or another CRM. Email column required, up to 1,000 rows.
              </p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={handleSampleDownload}
            className="flex items-center justify-center gap-2 text-sm text-text-3 hover:text-text-1 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download sample template
          </button>
        </div>
      )}

      {step === "map" && mapping && (
        <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-sm text-text-3">
            <span className="text-text-1 font-medium">{fileName}</span>: {rows.length} row{rows.length !== 1 ? "s" : ""} found.
            Match your CSV columns to lead fields below.
          </p>

          {/* Column mapping */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {IMPORT_FIELDS.map((def) => (
              <div key={def.field}>
                <label className="block text-xs text-text-3 mb-1">
                  {def.label}
                  {def.required && <span className="text-gold ml-0.5">*</span>}
                </label>
                <select
                  value={mapping[def.field]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [def.field]: Number(e.target.value) })
                  }
                  className={SELECT_CLS}
                >
                  <option value={-1}>Skip</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {!emailMapped && (
            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Select which column holds the email address to continue.
            </div>
          )}

          {/* Preview */}
          <div>
            <p className="text-xs text-text-3 mb-2">Preview (first {previewRows.length} rows as they will import)</p>
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-bg-3/50">
                    <th className="text-left px-3 py-2 font-medium text-text-3">Name</th>
                    <th className="text-left px-3 py-2 font-medium text-text-3">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-text-3">Phone</th>
                    <th className="text-left px-3 py-2 font-medium text-text-3">City</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-text-1">{mappedValue(row, "name") || "-"}</td>
                      <td className="px-3 py-2 text-text-2">{mappedValue(row, "email") || "-"}</td>
                      <td className="px-3 py-2 text-text-2">{mappedValue(row, "phone") || "-"}</td>
                      <td className="px-3 py-2 text-text-2">{mappedValue(row, "city") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Niche */}
          <div className="max-w-xs">
            <label className="block text-xs text-text-3 mb-1">
              Niche for these leads (optional)
            </label>
            <select
              value={nicheId}
              onChange={(e) => setNicheId(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">No niche (tag as Imported)</option>
              {NICHES.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={reset}
              disabled={importing}
              className="text-sm text-text-3 hover:text-text-1 transition-colors disabled:opacity-50"
            >
              Choose a different file
            </button>
            <button
              onClick={handleImport}
              disabled={!emailMapped || importing}
              className="px-5 py-2.5 rounded-lg bg-gold text-bg-0 font-medium text-sm hover:bg-gold-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? "Importing..." : `Import ${rows.length} row${rows.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col items-center gap-4 text-center py-2">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-text-1">
              {result.imported} lead{result.imported !== 1 ? "s" : ""} imported
            </p>
            <p className="text-sm text-text-3 mt-1">
              {result.duplicates_skipped > 0 &&
                `${result.duplicates_skipped} skipped as duplicates already in your workspace. `}
              {result.invalid_skipped > 0 &&
                `${result.invalid_skipped} skipped for missing or invalid email.`}
              {result.duplicates_skipped === 0 && result.invalid_skipped === 0 &&
                "All rows in your file were imported."}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="px-5 py-2.5 rounded-lg bg-gold text-bg-0 font-medium text-sm hover:bg-gold-bright transition-colors"
          >
            View leads
          </button>
        </div>
      )}
    </Modal>
  );
}
