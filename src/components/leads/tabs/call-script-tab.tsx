"use client";

import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabContent } from "@/hooks/useTabContent";
import { toast } from "@/components/ui/toast";
import { LoadingState, ErrorState } from "./cold-email-tab";
import type { Lead } from "@/lib/utils/types";

interface CallScriptTabProps {
  lead: Lead;
}

export function CallScriptTab({ lead }: CallScriptTabProps) {
  const { templates, loading, error, regenerate } = useTabContent(lead.id, "call_script");
  const template = templates[0] ?? null;

  if (loading) return <LoadingState label="Generating call script" />;
  if (error)   return <ErrorState error={error} onRetry={regenerate} />;
  if (!template) return null;

  const copy = () => {
    navigator.clipboard.writeText(template.body);
    toast("Script copied to clipboard", "success");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-3">
          Generated with {template.model_used ?? "AI"} · {template.tokens_used ?? 0} tokens
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={regenerate}>
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-bg-3 p-5">
        <pre className="text-sm text-text-2 whitespace-pre-wrap leading-relaxed font-sans">
          {template.body}
        </pre>
      </div>

      <p className="text-xs text-text-3">
        Generated on {new Date(template.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
      </p>
    </div>
  );
}
