"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { usePipeline } from "@/hooks/usePipeline";
import { PipelineStats } from "@/components/pipeline/pipeline-stats";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import type { Lead } from "@/lib/utils/types";

export default function PipelinePage() {
  const { groups, loading, error, refetch, updateLead, stats } = usePipeline();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  return (
    // -m-6 + p-6 gives us full-bleed control; flex-col + h-full fills the viewport
    <div className="flex flex-col gap-4 h-full -m-6 p-6 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-1">Pipeline</h2>
          <p className="text-text-3 mt-0.5 text-sm">
            {loading
              ? "Loading..."
              : `${stats.total} lead${stats.total !== 1 ? "s" : ""} · ${stats.active} active`}
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-border text-text-3 hover:text-text-1 hover:border-border-hover transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="shrink-0 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={refetch} className="text-xs text-red-400 underline mt-1">
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      {!loading && (
        <div className="shrink-0">
          <PipelineStats groups={groups} stats={stats} />
        </div>
      )}

      {/* Kanban board — fills remaining height */}
      {loading ? (
        <div className="flex-1 flex gap-3 overflow-x-auto">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-56 rounded-xl border border-border bg-bg-2 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <PipelineBoard groups={groups} onCardClick={setSelectedLead} />
        </div>
      )}

      {/* Lead detail panel — shared with leads page */}
      <LeadDetailPanel
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={(updated) => {
          updateLead(updated);
          setSelectedLead(updated);
        }}
      />
    </div>
  );
}
