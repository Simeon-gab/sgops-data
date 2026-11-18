"use client";

import { useCallback, useState } from "react";
import { toast } from "@/components/ui/toast";

// Downloads the leads CSV, and says what is happening while it does.
//
// The export used to give no sign that it had started, so a slow one looked
// like a dead button and got clicked again, starting a second export behind
// the first. `exporting` is for disabling the button; a failure reports the
// server's own reason instead of a bare "Export failed".

export function useLeadsExport() {
  const [exporting, setExporting] = useState(false);

  const exportLeads = useCallback(async (params?: string) => {
    setExporting(true);
    try {
      const res = await fetch(`/api/leads/export${params ? `?${params}` : ""}`);

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const reason =
          res.status === 504
            ? "The export took too long. Narrow it with a filter and try again."
            : body?.error ?? `The server answered ${res.status}.`;
        throw new Error(reason);
      }

      const rows = Number(res.headers.get("X-Export-Rows") ?? "0");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `sgops-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking straight away cancels the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);

      toast(
        rows > 0
          ? `Exported ${rows.toLocaleString()} ${rows === 1 ? "lead" : "leads"}`
          : "No leads matched, so the file has only its header row",
        rows > 0 ? "success" : "info"
      );
    } catch (err) {
      const reason = err instanceof Error && err.message ? err.message : "Please try again.";
      toast(`Export failed. ${reason}`, "error");
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, exportLeads };
}
