"use client";

import { TrendingUp, Users, CheckCircle, XCircle, Activity } from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/utils/constants";
import type { PipelineGroups } from "@/hooks/usePipeline";

interface PipelineStatsProps {
  groups: PipelineGroups;
  stats: {
    total: number;
    active: number;
    closed: number;
    lost: number;
    conversionRate: number;
  };
}

export function PipelineStats({ groups, stats }: PipelineStatsProps) {
  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Total Leads"
          value={stats.total}
          color="text-text-2"
        />
        <StatCard
          icon={Activity}
          label="Active"
          value={stats.active}
          color="text-gold"
        />
        <StatCard
          icon={CheckCircle}
          label="Closed Won"
          value={stats.closed}
          color="text-green-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Conversion"
          value={`${stats.conversionRate}%`}
          color="text-blue-400"
        />
      </div>

      {/* Stage funnel */}
      <div className="flex items-stretch gap-px rounded-xl overflow-hidden border border-border">
        {PIPELINE_STAGES.map((stage, i) => {
          const count = groups[stage.id as keyof PipelineGroups].length;
          const pct =
            stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;

          return (
            <div
              key={stage.id}
              className="flex-1 min-w-0 flex flex-col items-center py-2.5 px-1 bg-bg-2 relative group"
            >
              {/* Fill bar at bottom */}
              <div
                className="absolute bottom-0 left-0 right-0 transition-all duration-500"
                style={{
                  height: `${pct}%`,
                  backgroundColor: stage.color,
                  opacity: 0.12,
                }}
              />
              <span
                className="text-xs font-bold relative"
                style={{ color: stage.color }}
              >
                {count}
              </span>
              <span className="text-[10px] text-text-3 mt-0.5 truncate w-full text-center relative">
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-bg-2 border border-border rounded-xl px-4 py-3">
      <div className={`shrink-0 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
        <p className="text-xs text-text-3 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}
