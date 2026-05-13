"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft } from "lucide-react";
import { clsx } from "clsx";
import { TierBadge, StageBadge } from "@/components/ui/badge";
import { OverviewTab }    from "./tabs/overview-tab";
import { ColdEmailTab }   from "./tabs/cold-email-tab";
import { CallScriptTab }  from "./tabs/call-script-tab";
import { FollowUpsTab }   from "./tabs/follow-ups-tab";
import { ContentPlanTab } from "./tabs/content-plan-tab";
import { PipelineTab }    from "./tabs/pipeline-tab";
import type { Lead } from "@/lib/utils/types";

interface LeadDetailPanelProps {
  lead: Lead | null;
  onClose: () => void;
  onLeadUpdated?: (lead: Lead) => void;
}

const TABS = [
  { id: "overview",      label: "Overview" },
  { id: "pipeline",      label: "Pipeline" },
  { id: "cold_email",    label: "Cold Email" },
  { id: "call_script",   label: "Call Script" },
  { id: "follow_up",     label: "Follow-Ups" },
  { id: "content_plan",  label: "Content Plan" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function LeadDetailPanel({ lead, onClose, onLeadUpdated }: LeadDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [activated, setActivated] = useState<Set<TabId>>(new Set<TabId>(["overview"]));
  // Internal copy so stage/notes changes reflect immediately without waiting for parent re-render
  const [currentLead, setCurrentLead] = useState<Lead | null>(lead);

  const open = lead !== null;

  // Sync when a different lead is selected — intentionally keyed on id only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (lead) {
      setCurrentLead(lead);
      setActiveTab("overview");
      setActivated(new Set<TabId>(["overview"]));
    }
  }, [lead?.id]);

  // Keep currentLead fresh if parent updates lead (e.g., enrichment)
  useEffect(() => {
    if (lead) setCurrentLead(lead);
  }, [lead]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleTabChange(id: TabId) {
    setActiveTab(id);
    setActivated((prev) => new Set<TabId>([...Array.from(prev), id]));
  }

  function handleLeadUpdated(updated: Lead) {
    setCurrentLead(updated);
    onLeadUpdated?.(updated);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={clsx(
          "fixed inset-y-0 right-0 z-50 flex flex-col",
          "w-full sm:w-[600px] lg:w-[680px]",
          "bg-bg-2 border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
      >
        {currentLead && (
          <>
            {/* Header */}
            <div className="shrink-0 flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-border bg-bg-2">
              {/* Mobile back button */}
              <button
                onClick={onClose}
                className="md:hidden flex items-center gap-1 text-sm text-text-3 hover:text-text-1 transition-colors shrink-0"
                aria-label="Go back"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm md:text-base font-semibold text-text-1 truncate">
                    {currentLead.name}
                  </h2>
                  <TierBadge tier={currentLead.tier} />
                  <StageBadge stage={currentLead.stage} />
                </div>
                <p className="text-xs text-text-3 mt-0.5 truncate">
                  {currentLead.niche_label} · {currentLead.city}, {currentLead.state}
                </p>
              </div>

              {/* Desktop close button */}
              <button
                onClick={onClose}
                className="hidden md:flex shrink-0 p-1.5 rounded-lg text-text-3 hover:text-text-1 hover:bg-bg-3 transition-colors"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="shrink-0 flex items-center gap-0.5 px-4 py-2 border-b border-border bg-bg-1 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={clsx(
                    "shrink-0 text-sm font-medium px-3 py-1.5 rounded-md whitespace-nowrap transition-colors",
                    activeTab === tab.id
                      ? "bg-bg-3 text-text-1"
                      : "text-text-3 hover:text-text-2 hover:bg-bg-3/50"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content — mounted once, kept alive */}
            <div className="flex-1 overflow-y-auto">
              <div className={activeTab === "overview" ? "block" : "hidden"}>
                <OverviewTab lead={currentLead} />
              </div>

              {activated.has("pipeline") && (
                <div className={activeTab === "pipeline" ? "block" : "hidden"}>
                  <PipelineTab lead={currentLead} onLeadUpdated={handleLeadUpdated} />
                </div>
              )}

              {activated.has("cold_email") && (
                <div className={activeTab === "cold_email" ? "block" : "hidden"}>
                  <ColdEmailTab lead={currentLead} />
                </div>
              )}

              {activated.has("call_script") && (
                <div className={activeTab === "call_script" ? "block" : "hidden"}>
                  <CallScriptTab lead={currentLead} />
                </div>
              )}

              {activated.has("follow_up") && (
                <div className={activeTab === "follow_up" ? "block" : "hidden"}>
                  <FollowUpsTab lead={currentLead} />
                </div>
              )}

              {activated.has("content_plan") && (
                <div className={activeTab === "content_plan" ? "block" : "hidden"}>
                  <ContentPlanTab lead={currentLead} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
