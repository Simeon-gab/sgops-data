"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useRecipients, type RecipientRow } from "@/hooks/useCampaigns";
import { SKIP_REASON_LABELS, type SkipReason } from "@/lib/campaigns/eligibility";
import type { RecipientCounts } from "@/lib/campaigns/recipients";

interface RecipientTableProps {
  campaignId: string;
  counts: RecipientCounts | null;
}

const TABS = [
  { key: "",        label: "All" },
  { key: "pending", label: "Pending" },
  { key: "sent",    label: "Sent" },
  { key: "skipped", label: "Skipped" },
  { key: "failed",  label: "Failed" },
] as const;

const STATUS_VARIANT: Record<string, "verified" | "partial" | "unverified" | "hot" | "default"> = {
  sent:    "verified",
  sending: "partial",
  pending: "default",
  skipped: "unverified",
  failed:  "hot",
};

export function RecipientTable({ campaignId, counts }: RecipientTableProps) {
  const [status, setStatus] = useState<string>("");
  const { recipients, total, loading } = useRecipients(campaignId, status || undefined);

  const tabCount = (key: string) => {
    if (!counts) return null;
    if (!key) return counts.total;
    return counts[key as keyof RecipientCounts] ?? 0;
  };

  return (
    <div>
      <div className="flex items-center gap-1 mb-3 overflow-x-auto">
        {TABS.map((tab) => {
          const count = tabCount(tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                status === tab.key
                  ? "bg-bg-3 text-text-1"
                  : "text-text-3 hover:text-text-2"
              }`}
            >
              {tab.label}
              {count != null && <span className="ml-1.5 text-text-3">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
        {loading && recipients.length === 0 ? (
          <p className="text-sm text-text-3 p-8 text-center">Loading recipients...</p>
        ) : recipients.length === 0 ? (
          <p className="text-sm text-text-3 p-8 text-center">
            {status ? `No ${status} recipients.` : "No recipients yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Lead</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((recipient) => (
                  <tr key={recipient.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-text-1">
                      {recipient.lead?.name ?? <span className="text-text-3">Lead removed</span>}
                    </td>
                    <td className="px-4 py-2.5 text-text-3 font-mono text-xs">
                      {recipient.to_email}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[recipient.status] ?? "default"}>
                        {recipient.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-text-3 text-xs max-w-xs truncate">
                      {detailFor(recipient)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recipients.length < total && (
        <p className="text-xs text-text-3 mt-2">
          Showing {recipients.length} of {total}.
        </p>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-medium text-text-3 uppercase tracking-wide">
      {children}
    </th>
  );
}

// A skip reason is stored as either a bare reason or "reason: detail", so the
// label lookup has to survive both without losing the detail half.
function detailFor(recipient: RecipientRow): string {
  if (recipient.status === "failed") return recipient.last_error ?? "";
  if (recipient.status === "sent") {
    return recipient.sent_at ? new Date(recipient.sent_at).toLocaleString() : "";
  }
  if (!recipient.skip_reason) return "";

  const [reason, ...rest] = recipient.skip_reason.split(":");
  const label = SKIP_REASON_LABELS[reason.trim() as SkipReason];

  if (!label) return recipient.skip_reason;
  return rest.length > 0 ? `${label} (${rest.join(":").trim()})` : label;
}
