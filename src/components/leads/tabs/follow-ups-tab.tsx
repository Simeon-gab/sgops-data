"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { LoadingState, ErrorState } from "./cold-email-tab";
import type { Lead, OutreachTemplate } from "@/lib/utils/types";

interface FollowUpsTabProps {
  lead: Lead;
}

const DAY_LABELS: Record<string, { label: string; desc: string }> = {
  follow_up_3:  { label: "Day 3",  desc: "Short check-in" },
  follow_up_7:  { label: "Day 7",  desc: "Value-add" },
  follow_up_14: { label: "Day 14", desc: "Final touch" },
};
const TYPE_ORDER = ["follow_up_3", "follow_up_7", "follow_up_14"];

export function FollowUpsTab({ lead }: FollowUpsTabProps) {
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (forceGenerate = false) => {
      setLoading(true);
      setError(null);
      try {
        // Step 1: resolve original_subject from cold email cache
        let originalSubject = "Following up from our earlier conversation";
        const coldRes = await fetch(`/api/templates?lead_id=${lead.id}&type=cold_email`);
        if (coldRes.ok) {
          const coldData = await coldRes.json();
          if (coldData.templates?.[0]?.subject) {
            originalSubject = coldData.templates[0].subject as string;
          }
        }

        // Step 2: check cache for follow-up templates
        if (!forceGenerate) {
          const cacheRes = await fetch(`/api/templates?lead_id=${lead.id}&type=follow_up`);
          if (cacheRes.ok) {
            const cacheData = await cacheRes.json();
            if ((cacheData.templates ?? []).length === 3) {
              setTemplates(cacheData.templates as OutreachTemplate[]);
              setLoading(false);
              return;
            }
          }
        }

        // Step 3: generate
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: lead.id,
            type: "follow_up",
            original_subject: originalSubject,
          }),
        });
        const genData = await genRes.json();
        if (!genRes.ok) throw new Error(genData.error ?? "Generation failed");
        setTemplates(genData.templates as OutreachTemplate[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [lead.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState label="Generating follow-up sequence" />;
  if (error)   return <ErrorState error={error} onRetry={() => load(true)} />;

  // Sort by day order
  const sorted = [...templates].sort(
    (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-3">3-email sequence · Haiku model</p>
        <Button variant="ghost" size="sm" onClick={() => load(true)}>
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerate All
        </Button>
      </div>

      <div className="space-y-4">
        {sorted.map((t) => {
          const meta = DAY_LABELS[t.type] ?? { label: t.type, desc: "" };
          const copy = () => {
            const text = `Subject: ${t.subject ?? ""}\n\n${t.body}`;
            navigator.clipboard.writeText(text);
            toast("Copied to clipboard", "success");
          };

          return (
            <div
              key={t.id}
              className="rounded-xl border border-border bg-bg-3 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-gold bg-gold/10 border border-gold/20 rounded-full px-2 py-0.5">
                    {meta.label}
                  </span>
                  <span className="text-xs text-text-3">{meta.desc}</span>
                </div>
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 text-xs text-text-3 hover:text-text-1 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>

              <div className="px-4 py-3 border-b border-border/50">
                <span className="text-xs text-text-3 mr-2">Subject:</span>
                <span className="text-sm text-text-1 font-medium">{t.subject}</span>
              </div>

              <div className="p-4">
                <pre className="text-sm text-text-2 whitespace-pre-wrap leading-relaxed font-sans">
                  {t.body}
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
