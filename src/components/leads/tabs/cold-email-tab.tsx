"use client";

import { Copy, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabContent } from "@/hooks/useTabContent";
import { toast } from "@/components/ui/toast";
import type { Lead } from "@/lib/utils/types";

interface ColdEmailTabProps {
  lead: Lead;
}

export function ColdEmailTab({ lead }: ColdEmailTabProps) {
  const { templates, loading, error, regenerate } = useTabContent(lead.id, "cold_email");
  const template = templates[0] ?? null;

  if (loading) return <LoadingState label="Generating cold email" />;
  if (error)   return <ErrorState error={error} onRetry={regenerate} />;
  if (!template) return null;

  const copyAll = () => {
    const text = `Subject: ${template.subject ?? ""}\n\n${template.body}`;
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "success");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-3">
            Generated with {template.model_used ?? "AI"} · {template.tokens_used ?? 0} tokens
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copyAll}>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={regenerate}>
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-bg-3 overflow-hidden">
        <div className="border-b border-border px-4 py-3 flex items-center gap-2">
          <span className="text-xs text-text-3 shrink-0">Subject:</span>
          <span className="text-sm font-medium text-text-1">{template.subject}</span>
        </div>
        <div className="p-4">
          <pre className="text-sm text-text-2 whitespace-pre-wrap leading-relaxed font-sans">
            {template.body}
          </pre>
        </div>
      </div>

      <p className="text-xs text-text-3">
        Generated on {new Date(template.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
      </p>
    </div>
  );
}

// ── Shared loading / error states ─────────────────────────────────────────────

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="p-12 flex flex-col items-center gap-4 text-center">
      <Loader2 className="h-8 w-8 text-gold animate-spin" />
      <div>
        <p className="text-sm font-medium text-text-1">{label}</p>
        <p className="text-xs text-text-3 mt-1">This may take a few seconds</p>
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="p-6">
      <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
        <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-red-400 font-medium">Generation failed</p>
          <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
          <button
            onClick={onRetry}
            className="text-xs text-red-400 underline mt-2 hover:opacity-80 transition-opacity"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
