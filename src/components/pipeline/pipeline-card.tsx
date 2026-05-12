"use client";

import { Star, Globe, Phone, Mail } from "lucide-react";
import { TierBadge } from "@/components/ui/badge";
import { clsx } from "clsx";
import type { Lead } from "@/lib/utils/types";

interface PipelineCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
}

export function PipelineCard({ lead, onClick }: PipelineCardProps) {
  return (
    <button
      onClick={() => onClick(lead)}
      className={clsx(
        "w-full text-left rounded-lg border border-border bg-bg-3",
        "hover:border-border-hover hover:bg-bg-4 transition-all",
        "p-3 space-y-2.5 group"
      )}
    >
      {/* Name + tier */}
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm font-medium text-text-1 leading-snug flex-1 min-w-0 truncate">
          {lead.name}
        </p>
        <TierBadge tier={lead.tier} />
      </div>

      {/* Niche + location */}
      <p className="text-xs text-text-3 leading-snug truncate">
        {lead.niche_label} · {lead.city}
      </p>

      {/* Score bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-bg-1 rounded-full overflow-hidden">
          <div
            className={clsx("h-full rounded-full", {
              "bg-red-500":    lead.tier === "hot",
              "bg-gold":       lead.tier === "warm",
              "bg-slate-500":  lead.tier === "cold",
            })}
            style={{ width: `${lead.score}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-text-3 shrink-0">{lead.score}</span>
      </div>

      {/* Contact row */}
      <div className="flex items-center gap-2 text-[10px] text-text-3">
        {lead.website  && <Globe  className="h-2.5 w-2.5" />}
        {lead.phone    && <Phone  className="h-2.5 w-2.5" />}
        {lead.email    && <Mail   className="h-2.5 w-2.5" />}
        {lead.rating != null && (
          <span className="flex items-center gap-0.5 ml-auto">
            <Star className="h-2.5 w-2.5 text-gold fill-gold" />
            {lead.rating}
          </span>
        )}
      </div>

      {/* Last contacted */}
      {lead.last_contacted_at && (
        <p className="text-[10px] text-text-3">
          Last contact:{" "}
          {new Date(lead.last_contacted_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>
      )}
    </button>
  );
}
