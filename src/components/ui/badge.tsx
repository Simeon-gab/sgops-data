import { clsx } from "clsx";
import type { LeadTier, PipelineStage, DataQuality } from "@/lib/utils/types";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "hot" | "warm" | "cold" | "verified" | "partial" | "unverified";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
        {
          "bg-bg-3 text-text-2 border border-border": variant === "default",
          "bg-red-500/10 text-red-400 border border-red-500/20": variant === "hot",
          "bg-amber-500/10 text-amber-400 border border-amber-500/20": variant === "warm",
          "bg-slate-500/10 text-slate-400 border border-slate-500/20": variant === "cold",
          "bg-green-500/10 text-green-400 border border-green-500/20": variant === "verified",
          "bg-blue-500/10 text-blue-400 border border-blue-500/20": variant === "partial",
          "bg-gray-500/10 text-gray-400 border border-gray-500/20": variant === "unverified",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

export function TierBadge({ tier }: { tier: LeadTier }) {
  const labels: Record<LeadTier, string> = {
    hot: "Hot",
    warm: "Warm",
    cold: "Cold",
  };
  return <Badge variant={tier}>{labels[tier]}</Badge>;
}

export function QualityBadge({ quality }: { quality: DataQuality }) {
  const labels: Record<DataQuality, string> = {
    verified: "Verified",
    partial: "Partial",
    unverified: "Unverified",
  };
  return <Badge variant={quality}>{labels[quality]}</Badge>;
}

export function StageBadge({ stage }: { stage: PipelineStage }) {
  const stageColors: Record<PipelineStage, string> = {
    new: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    contacted: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
    responded: "bg-green-500/10 text-green-400 border border-green-500/20",
    meeting: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    proposal: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
    closed: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    lost: "bg-red-500/10 text-red-400 border border-red-500/20",
  };
  const labels: Record<PipelineStage, string> = {
    new: "New",
    contacted: "Contacted",
    responded: "Responded",
    meeting: "Meeting",
    proposal: "Proposal",
    closed: "Closed Won",
    lost: "Lost",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full",
        stageColors[stage]
      )}
    >
      {labels[stage]}
    </span>
  );
}
