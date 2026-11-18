"use client";

import { useState } from "react";
import { Copy, RefreshCw, AlertCircle, Loader2, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabContent } from "@/hooks/useTabContent";
import { toast } from "@/components/ui/toast";
import { SendEmailModal } from "@/components/outreach/send-email-modal";
import type { Lead } from "@/lib/utils/types";

interface ColdEmailTabProps {
  lead: Lead;
}

export function ColdEmailTab({ lead }: ColdEmailTabProps) {
  const { templates, loading, error, regenerate } = useTabContent(lead.id, "cold_email");
  const template = templates[0] ?? null;
  const [showSendModal, setShowSendModal] = useState(false);

  if (loading) return <LoadingState label="Generating cold email" />;
  if (error)   return <ErrorState error={error} onRetry={regenerate} />;
  if (!template) return null;

  // What the email says about this business and where that can be checked.
  // Emails generated before this was recorded have neither field.
  const meta = (template.structured_data ?? {}) as {
    based_on?: {
      text: string;
      source: string;
      source_url: string | null;
      evidence: string | null;
    } | null;
    issues?: string[];
  };
  const basedOn = meta.based_on ?? null;
  const issues = meta.issues ?? [];

  const copyAll = () => {
    const text = `Subject: ${template.subject ?? ""}\n\n${template.body}`;
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "success");
  };

  return (
    <>
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
          <Button size="sm" onClick={() => setShowSendModal(true)} disabled={!lead.email}>
            <Send className="h-3.5 w-3.5" />
            Send
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

      {"based_on" in meta && (
        <div className="rounded-xl border border-border bg-bg-2 px-4 py-3 flex items-start gap-2.5">
          <ShieldCheck
            className={
              "h-4 w-4 mt-0.5 shrink-0 " + (basedOn ? "text-green-400" : "text-text-3")
            }
          />
          {basedOn ? (
            <div className="min-w-0 text-xs leading-relaxed">
              <p className="text-text-2">
                <span className="text-text-3">Opens on a verified fact: </span>
                {basedOn.text}
              </p>
              {basedOn.evidence && (
                <p className="text-text-3 mt-0.5 break-words">Seen: {basedOn.evidence}</p>
              )}
              <p className="text-text-3 mt-0.5">
                {basedOn.source}
                {basedOn.source_url && (
                  <>
                    {". "}
                    <a
                      href={basedOn.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gold transition-colors"
                    >
                      Check it
                    </a>
                  </>
                )}
              </p>
            </div>
          ) : (
            <p className="text-xs text-text-3 leading-relaxed">
              No verified fact about this business was available, so this email makes no
              specific claim about them. Enrich the lead to give it something true to open on.
            </p>
          )}
        </div>
      )}

      {issues.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-medium text-amber-400">Worth a look before sending</p>
          <ul className="mt-1 space-y-0.5">
            {issues.map((issue) => (
              <li key={issue} className="text-xs text-amber-400/80 leading-relaxed">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-text-3">
        Generated on {new Date(template.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
        {!lead.email && (
          <span className="ml-2 text-amber-400">No email on file</span>
        )}
      </p>
    </div>

    {showSendModal && (
      <SendEmailModal
        lead={lead}
        template={template}
        onClose={() => setShowSendModal(false)}
      />
    )}
    </>
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
