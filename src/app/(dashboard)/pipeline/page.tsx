import { Kanban } from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/utils/constants";

export default function PipelinePage() {
  return (
    <div className="max-w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-1">Pipeline</h2>
        <p className="text-text-3 mt-1">Track your leads through the sales funnel</p>
      </div>

      {/* Stage columns preview */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <div
            key={stage.id}
            className="shrink-0 w-60 bg-bg-2 border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-sm font-medium text-text-2">{stage.label}</span>
              <span className="ml-auto text-xs text-text-3 bg-bg-3 rounded-full px-2 py-0.5">
                0
              </span>
            </div>
            <div className="h-24 flex items-center justify-center border border-dashed border-border rounded-lg">
              <Kanban className="h-5 w-5 text-text-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
