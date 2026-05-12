"use client";

import { PipelineColumn } from "./pipeline-column";
import { PIPELINE_STAGES } from "@/lib/utils/constants";
import type { Lead } from "@/lib/utils/types";
import type { PipelineGroups } from "@/hooks/usePipeline";

interface PipelineBoardProps {
  groups: PipelineGroups;
  onCardClick: (lead: Lead) => void;
}

export function PipelineBoard({ groups, onCardClick }: PipelineBoardProps) {
  return (
    <div className="flex gap-3 h-full overflow-x-auto pb-2">
      {PIPELINE_STAGES.map((stage) => (
        <PipelineColumn
          key={stage.id}
          stage={stage}
          leads={groups[stage.id as keyof PipelineGroups]}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}
