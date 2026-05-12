"use client";

import { useState } from "react";
import { Send, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { Lead, OutreachTemplate } from "@/lib/utils/types";

interface BatchSendBarProps {
  selectedLeads: Lead[];
  onClear: () => void;
  onSent?: () => void;
}

interface SendCandidate {
  lead: Lead;
  template: OutreachTemplate | null;
  reason?: string;
}

export function BatchSendBar({ selectedLeads, onClear, onSent }: BatchSendBarProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [candidates, setCandidates] = useState<SendCandidate[]>([]);

  async function openModal() {
    setOpen(true);
    setChecking(true);
    setCandidates([]);

    const results = await Promise.all(
      selectedLeads.map(async (lead): Promise<SendCandidate> => {
        if (!lead.email) return { lead, template: null, reason: "No email address" };
        try {
          const res = await fetch(`/api/templates?lead_id=${lead.id}&type=cold_email`);
          const data = await res.json();
          const tpl: OutreachTemplate | undefined = data.templates?.[0];
          if (!tpl) return { lead, template: null, reason: "No cold email generated yet" };
          return { lead, template: tpl };
        } catch {
          return { lead, template: null, reason: "Failed to load template" };
        }
      })
    );

    setCandidates(results);
    setChecking(false);
  }

  function closeModal() {
    if (sending) return;
    setOpen(false);
  }

  async function handleSend() {
    const valid = candidates.filter((c) => c.template && c.lead.email);
    if (!valid.length) return;
    setSending(true);
    try {
      const sends = valid.map((c) => ({
        lead_id:     c.lead.id,
        to_email:    c.lead.email!,
        subject:     c.template!.subject ?? "(No subject)",
        body:        c.template!.body,
        template_id: c.template!.id,
      }));

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sends }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Batch send failed");

      const msg = `Sent ${data.sent} email${data.sent !== 1 ? "s" : ""}${data.failed ? `, ${data.failed} failed` : ""}`;
      toast(msg, "success");
      onSent?.();
      setOpen(false);
      onClear();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Send failed", "error");
    } finally {
      setSending(false);
    }
  }

  const validCount = candidates.filter((c) => c.template && c.lead.email).length;

  return (
    <>
      {/* Floating bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3 bg-bg-1 border border-border rounded-2xl shadow-xl">
        <span className="text-sm text-text-2">
          <span className="font-semibold text-text-1">{selectedLeads.length}</span>{" "}
          lead{selectedLeads.length !== 1 ? "s" : ""} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <Button size="sm" onClick={openModal}>
          <Send className="h-3.5 w-3.5" />
          Send Emails
        </Button>
        <button
          onClick={onClear}
          className="p-1.5 rounded-lg text-text-3 hover:text-text-1 hover:bg-bg-3 transition-colors"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Confirmation modal */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-lg bg-bg-2 border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-text-1">Confirm Batch Send</h3>
              <button
                onClick={closeModal}
                disabled={sending}
                className="p-1.5 rounded-lg text-text-3 hover:text-text-1 hover:bg-bg-3 transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Candidate list */}
            <div className="p-6">
              {checking ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="h-6 w-6 rounded-full border-2 border-gold border-t-transparent animate-spin" />
                  <p className="text-sm text-text-3">Checking cold email templates...</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {candidates.map(({ lead, template, reason }) => {
                    const canSend = !!(template && lead.email);
                    return (
                      <div
                        key={lead.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-bg-3"
                      >
                        {canSend ? (
                          <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-1 truncate">{lead.name}</p>
                          <p className="text-xs text-text-3 truncate">
                            {canSend ? lead.email : reason}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <p className="text-xs text-text-3">
                {checking
                  ? "Checking..."
                  : `${validCount} of ${candidates.length} will be sent`}
              </p>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={closeModal} disabled={sending}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={checking || sending || validCount === 0}
                  loading={sending}
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending
                    ? "Sending..."
                    : `Send ${validCount} Email${validCount !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
