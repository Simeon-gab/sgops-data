"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import { useProspect } from "@/hooks/useProspect";
import { ProspectForm } from "@/components/prospect/prospect-form";
import { LeadTable } from "@/components/leads/lead-table";
import type { ProspectRequest } from "@/lib/utils/types";

export default function ProspectPage() {
  const { run, loading, error, result } = useProspect();

  const handleSubmit = (req: ProspectRequest) => {
    run(req);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text-1">Find leads</h2>
        <p className="text-text-3 mt-1">
          Search any niche in any city worldwide. Get up to 200 structured, cleaned leads instantly.
        </p>
      </div>

      <div className="bg-bg-2 border border-border rounded-2xl p-6 mb-6">
        <ProspectForm onSubmit={handleSubmit} loading={loading} />
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.demo_mode && (
            <div className="flex items-start gap-3 bg-gold-dim border border-gold/20 rounded-xl p-4">
              <AlertTriangle className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gold">Demo mode</p>
                <p className="text-xs text-text-3 mt-0.5">
                  No Google Places API key detected. Showing generated sample data so you can explore the full pipeline.
                  Add <code className="font-mono text-gold-bright">GOOGLE_PLACES_API_KEY</code> to your .env.local to switch to live data.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-text-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span>
                  <span className="font-semibold text-text-1">{result.total_extracted}</span> leads extracted
                </span>
              </div>
              {result.duplicates_skipped > 0 && (
                <span className="text-text-3">
                  {result.duplicates_skipped} duplicates skipped
                </span>
              )}
            </div>
            <Link
              href="/leads"
              className="flex items-center gap-1 text-sm text-gold hover:text-gold-bright transition-colors"
            >
              View all leads
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <LeadTable leads={result.leads} />
        </div>
      )}
    </div>
  );
}
