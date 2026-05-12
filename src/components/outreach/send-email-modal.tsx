"use client";

import { useState } from "react";
import { X, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { Lead, OutreachTemplate } from "@/lib/utils/types";

interface SendEmailModalProps {
  lead: Lead;
  template: OutreachTemplate;
  onClose: () => void;
  onSent?: () => void;
}

export function SendEmailModal({ lead, template, onClose, onSent }: SendEmailModalProps) {
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!lead.email) return;
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id:     lead.id,
          to_email:    lead.email,
          subject:     template.subject ?? "(No subject)",
          body:        template.body,
          template_id: template.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      toast(`Email sent to ${lead.email}`, "success");
      onSent?.();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Send failed", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !sending && onClose()}
      />
      <div className="relative z-10 w-full max-w-lg bg-bg-2 border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gold" />
            <h3 className="font-semibold text-text-1">Send Email</h3>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="p-1.5 rounded-lg text-text-3 hover:text-text-1 hover:bg-bg-3 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-text-3 w-14 shrink-0">To:</span>
              <span className="text-text-1">{lead.email ?? "No email on file"}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-text-3 w-14 shrink-0">Subject:</span>
              <span className="text-text-1 font-medium">{template.subject}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg-3 p-4 max-h-48 overflow-y-auto">
            <pre className="text-xs text-text-2 whitespace-pre-wrap leading-relaxed font-sans">
              {template.body.length > 600
                ? template.body.slice(0, 600) + "..."
                : template.body}
            </pre>
          </div>

          {!lead.email && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              This lead has no email address. Add one from the Overview tab before sending.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!lead.email || sending} loading={sending}>
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending..." : "Send Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}
