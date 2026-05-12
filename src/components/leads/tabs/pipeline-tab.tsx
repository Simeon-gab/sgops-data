"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight, StickyNote, Clock, GitBranch,
  CheckCircle2, Loader2, AlertCircle, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import { PIPELINE_STAGES } from "@/lib/utils/constants";
import { patchLead } from "@/hooks/usePipeline";
import { toast } from "@/components/ui/toast";
import type { Lead, PipelineActivity, PipelineStage } from "@/lib/utils/types";

interface PipelineTabProps {
  lead: Lead;
  onLeadUpdated: (lead: Lead) => void;
}

// ── Activity feed ─────────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  stage_change: GitBranch,
  note:         StickyNote,
  email_sent:   ArrowRight,
  call_logged:  Clock,
  meeting_scheduled: CheckCircle2,
};

function ActivityFeed({ leadId }: { leadId: string }) {
  const [activities, setActivities] = useState<PipelineActivity[]>([]);
  const [loading, setLoading]       = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/activities?lead_id=${leadId}`);
      const data = await res.json();
      setActivities(data.activities ?? []);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  // Exposed so parent can trigger refresh after stage/note saves
  (ActivityFeed as { refresh?: () => void }).refresh = fetch_;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center">
        <Loader2 className="h-4 w-4 text-text-3 animate-spin" />
        <span className="text-xs text-text-3">Loading activity...</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-xs text-text-3 italic text-center py-4">
        No activity yet. Move the stage or save a note to get started.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-border ml-2 space-y-4">
      {activities.map((a) => {
        const Icon = ACTIVITY_ICONS[a.type] ?? Clock;
        return (
          <li key={a.id} className="ml-4">
            <div className="absolute -left-1.5 mt-0.5 w-3 h-3 rounded-full bg-bg-4 border border-border flex items-center justify-center">
              <Icon className="h-1.5 w-1.5 text-text-3" />
            </div>
            <div className="flex items-start gap-1 flex-wrap">
              {a.type === "stage_change" && (
                <p className="text-xs text-text-2">
                  Moved{" "}
                  <span className="font-medium text-text-1">
                    {formatStage(a.from_stage)}
                  </span>{" "}
                  <ArrowRight className="h-2.5 w-2.5 inline text-text-3" />{" "}
                  <span className="font-medium text-text-1">
                    {formatStage(a.to_stage)}
                  </span>
                </p>
              )}
              {a.type === "note" && (
                <p className="text-xs text-text-2 italic">&ldquo;{a.content}&rdquo;</p>
              )}
              {a.type !== "stage_change" && a.type !== "note" && (
                <p className="text-xs text-text-2 capitalize">
                  {a.type.replace(/_/g, " ")}
                </p>
              )}
            </div>
            <time className="text-[10px] text-text-3 mt-0.5 block">
              {formatRelativeTime(a.created_at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

function formatStage(s: string | null): string {
  if (!s) return "Unknown";
  return PIPELINE_STAGES.find((p) => p.id === s)?.label ?? s;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PipelineTab({ lead, onLeadUpdated }: PipelineTabProps) {
  const [movingTo, setMovingTo]   = useState<PipelineStage | null>(null);
  const [notes, setNotes]         = useState(lead.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [feedKey, setFeedKey]     = useState(0); // bump to force feed refresh

  // Sync notes when lead prop changes
  useEffect(() => { setNotes(lead.notes ?? ""); }, [lead.id, lead.notes]);

  async function handleStageChange(stage: PipelineStage) {
    if (stage === lead.stage || movingTo) return;
    setMovingTo(stage);
    try {
      const updated = await patchLead(lead.id, { stage });
      onLeadUpdated(updated);
      setFeedKey((k) => k + 1);
      toast(`Moved to ${formatStage(stage)}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update stage", "error");
    } finally {
      setMovingTo(null);
    }
  }

  async function handleSaveNotes() {
    if (notes === (lead.notes ?? "")) return;
    setSavingNotes(true);
    try {
      const updated = await patchLead(lead.id, { notes });
      onLeadUpdated(updated);
      setFeedKey((k) => k + 1);
      toast("Note saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save note", "error");
    } finally {
      setSavingNotes(false);
    }
  }

  const notesDirty = notes !== (lead.notes ?? "");

  return (
    <div className="p-6 space-y-6">
      {/* Stage mover */}
      <Section title="Pipeline Stage">
        <div className="grid grid-cols-2 gap-1.5">
          {PIPELINE_STAGES.map((s) => {
            const isCurrent = lead.stage === s.id;
            const isMoving  = movingTo === s.id;

            return (
              <button
                key={s.id}
                onClick={() => handleStageChange(s.id as PipelineStage)}
                disabled={isCurrent || movingTo !== null}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                  "disabled:cursor-not-allowed",
                  isCurrent
                    ? "border-2 text-text-1"
                    : "border-border text-text-3 hover:border-border-hover hover:text-text-2 hover:bg-bg-3",
                  movingTo !== null && !isCurrent && "opacity-40"
                )}
                style={
                  isCurrent
                    ? { borderColor: s.color, backgroundColor: `${s.color}12`, color: s.color }
                    : {}
                }
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="flex-1 text-left">{s.label}</span>
                {isMoving && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                {isCurrent && !isMoving && <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: s.color }} />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this lead..."
            rows={4}
            className={clsx(
              "w-full bg-bg-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-3 resize-none",
              "focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-colors"
            )}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-3">
              {notesDirty ? "Unsaved changes" : "Saved"}
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSaveNotes}
              disabled={!notesDirty}
              loading={savingNotes}
            >
              <Save className="h-3.5 w-3.5" />
              Save note
            </Button>
          </div>
        </div>
      </Section>

      {/* Activity feed */}
      <Section title="Activity">
        <ActivityFeed key={feedKey} leadId={lead.id} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}
