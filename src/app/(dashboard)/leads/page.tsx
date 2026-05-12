"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import type { Lead } from "@/lib/utils/types";

export default function LeadsPage() {
  const { leads, loading, error, refetch } = useLeads(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

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
        <Link
          href="/prospect"
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gold text-bg-0 font-medium hover:bg-gold-bright transition-colors"
        >
          <Search className="h-4 w-4" />
          New search
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={refetch}
            className="text-xs text-red-400 underline mt-1"
          >
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
        />
      )}

      <LeadDetailPanel
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
}
