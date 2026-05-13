"use client";

import { PipelineCard } from "./pipeline-card";
import type { Lead, PipelineStage } from "@/lib/utils/types";

interface StageConfig {
  id: PipelineStage;
  label: string;
  color: string;
}

interface PipelineColumnProps {
  stage: StageConfig;
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
}

export function PipelineColumn({ stage, leads, onCardClick }: PipelineColumnProps) {
  return (
    <div className="w-full md:w-56 md:shrink-0 flex flex-col rounded-xl border border-border bg-bg-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-bg-3 shrink-0">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <span className="text-xs font-semibold text-text-2 flex-1 truncate">
          {stage.label}
        </span>
        <span
          className="text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center"
          style={{
            backgroundColor: `${stage.color}20`,
            color: stage.color,
          }}
        >
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="p-2 space-y-2 md:flex-1 md:overflow-y-auto md:min-h-0">
        {leads.length === 0 ? (
          <div className="h-16 flex items-center justify-center">
            <p className="text-xs text-text-3 italic">Empty</p>
          </div>
        ) : (
          leads.map((lead) => (
            <PipelineCard key={lead.id} lead={lead} onClick={onCardClick} />
          ))
        )}
      </div>
    </div>
  );
}
