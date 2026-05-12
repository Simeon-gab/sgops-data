"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Search, Download } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import { BatchSendBar } from "@/components/outreach/batch-send-bar";
import { toast } from "@/components/ui/toast";
import type { Lead } from "@/lib/utils/types";

export default function LeadsPage() {
  const { leads, loading, error, refetch } = useLeads(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedLeads = leads.filter((l) => selectedIds.has(l.id));

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  }, [leads, selectedIds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  async function handleExport() {
    try {
      const res = await fetch("/api/leads/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sgops-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("Export failed", "error");
    }
  }

  return (
    <div className="max-w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-1">Leads</h2>
          <p className="text-text-3 mt-1">
            {loading
              ? "Loading leads..."
              : `${leads.length} lead${leads.length !== 1 ? "s" : ""} in your workspace`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {leads.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border text-text-3 hover:text-text-1 hover:border-border-hover transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          )}
          <Link
            href="/prospect"
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gold text-bg-0 font-medium hover:bg-gold-bright transition-colors"
          >
            <Search className="h-4 w-4" />
            New search
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={refetch} className="text-xs text-red-400 underline mt-1">
            Retry
          </button>
        </div>
      )}

      {!loading && leads.length === 0 && !error ? (
        <div className="bg-bg-2 border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-bg-3 flex items-center justify-center">
            <Search className="h-8 w-8 text-text-3" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-1">No leads yet</h3>
            <p className="text-sm text-text-3 mt-1 max-w-md">
              Run a prospect search to start building your leads database.
            </p>
          </div>
          <Link
            href="/prospect"
            className="px-5 py-2.5 rounded-lg bg-gold text-bg-0 font-medium text-sm hover:bg-gold-bright transition-colors"
          >
            Start prospecting
          </Link>
        </div>
      ) : (
        <LeadTable
          leads={leads}
          loading={loading}
          onSelect={setSelectedLead}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          onToggleAll={handleToggleAll}
        />
      )}

      <LeadDetailPanel
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={(updated) => {
          setSelectedLead(updated);
        }}
      />

      {selectedIds.size > 0 && (
        <BatchSendBar
          selectedLeads={selectedLeads}
          onClear={clearSelection}
          onSent={refetch}
        />
      )}
    </div>
  );
}
