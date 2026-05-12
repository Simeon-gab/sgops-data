"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { TierBadge } from "@/components/ui/badge";
import { OverviewTab }    from "./tabs/overview-tab";
import { ColdEmailTab }   from "./tabs/cold-email-tab";
import { CallScriptTab }  from "./tabs/call-script-tab";
import { FollowUpsTab }   from "./tabs/follow-ups-tab";
import { ContentPlanTab } from "./tabs/content-plan-tab";
import type { Lead } from "@/lib/utils/types";

interface LeadDetailPanelProps {
  lead: Lead | null;
  onClose: () => void;
}

const TABS = [
  { id: "overview",      label: "Overview" },
  { id: "cold_email",    label: "Cold Email" },
  { id: "call_script",   label: "Call Script" },
  { id: "follow_up",     label: "Follow-Ups" },
  { id: "content_plan",  label: "Content Plan" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function LeadDetailPanel({ lead, onClose }: LeadDetailPanelProps) {
  const [activeTab, setActiveTab]         = useState<TabId>("overview");
  // Track which tabs have ever been activated so we mount them once and keep them
  const [activated, setActivated]         = useState<Set<TabId>>(new Set<TabId>(["overview"]));
  const open = lead !== null;

  // Reset tab state when a different lead opens
  useEffect(() => {
    if (lead) {
      setActiveTab("overview");
      setActivated(new Set<TabId>(["overview"]));
    }
  }, [lead?.id]);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll when panel is open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleTabChange(id: TabId) {
    setActiveTab(id);
    setActivated((prev) => new Set<TabId>([...Array.from(prev), id]));
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
        {lead && (
          <>
            {/* Header */}
            <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-4 border-b border-border bg-bg-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-text-1 truncate">{lead.name}</h2>
                  <TierBadge tier={lead.tier} />
                </div>
                <p className="text-xs text-text-3 mt-0.5 truncate">
                  {lead.niche_label} · {lead.city}, {lead.state}, {lead.country}
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 p-1.5 rounded-lg text-text-3 hover:text-text-1 hover:bg-bg-3 transition-colors"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="shrink-0 flex items-center gap-0.5 px-4 py-2 border-b border-border bg-bg-1 overflow-x-auto scrollbar-none">
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

            {/* Tab content — each panel is mounted once and kept */}
            <div className="flex-1 overflow-y-auto">
              <div className={activeTab === "overview"    ? "block" : "hidden"}>
                <OverviewTab lead={lead} />
              </div>

              {activated.has("cold_email") && (
                <div className={activeTab === "cold_email" ? "block" : "hidden"}>
                  <ColdEmailTab lead={lead} />
                </div>
              )}

              {activated.has("call_script") && (
                <div className={activeTab === "call_script" ? "block" : "hidden"}>
                  <CallScriptTab lead={lead} />
                </div>
              )}

              {activated.has("follow_up") && (
                <div className={activeTab === "follow_up" ? "block" : "hidden"}>
                  <FollowUpsTab lead={lead} />
                </div>
              )}

              {activated.has("content_plan") && (
                <div className={activeTab === "content_plan" ? "block" : "hidden"}>
                  <ContentPlanTab lead={lead} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
