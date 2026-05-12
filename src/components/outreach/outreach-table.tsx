"use client";

import {
  CheckCircle,
  Clock,
  Mail,
  XCircle,
  MousePointerClick,
  Eye,
  AlertTriangle,
} from "lucide-react";
import type { OutreachSend } from "@/lib/utils/types";
import type { OutreachSendWithLead } from "@/hooks/useOutreach";

const STATUS_CONFIG: Record<
  OutreachSend["status"],
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  queued:    { label: "Queued",    icon: Clock,             color: "text-text-3",      bg: "bg-bg-3" },
  sent:      { label: "Sent",      icon: Mail,              color: "text-blue-400",    bg: "bg-blue-500/10" },
  delivered: { label: "Delivered", icon: CheckCircle,       color: "text-green-400",   bg: "bg-green-500/10" },
  opened:    { label: "Opened",    icon: Eye,               color: "text-gold",        bg: "bg-gold/10" },
  clicked:   { label: "Clicked",   icon: MousePointerClick, color: "text-gold-bright", bg: "bg-gold/10" },
  bounced:   { label: "Bounced",   icon: XCircle,           color: "text-red-400",     bg: "bg-red-500/10" },
  failed:    { label: "Failed",    icon: AlertTriangle,     color: "text-red-400",     bg: "bg-red-500/10" },
};

function StatusBadge({ status }: { status: OutreachSend["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

interface OutreachTableProps {
  sends: OutreachSendWithLead[];
  loading?: boolean;
}

export function OutreachTable({ sends, loading }: OutreachTableProps) {
  const COLS = ["Lead", "Subject", "To", "Status", "Sent"];

  if (loading) {
    return (
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-3">
              {COLS.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border/50">
                {COLS.map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-bg-3 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-3">
            {COLS.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-medium text-text-3 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sends.map((send) => {
            const dateStr = send.sent_at ?? send.created_at;
            return (
              <tr
                key={send.id}
                className="border-b border-border/50 last:border-0 hover:bg-bg-3/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-text-1">{send.leads?.name ?? "Unknown"}</p>
                  <p className="text-xs text-text-3">
                    {send.leads?.niche_label}
                    {send.leads?.city ? ` · ${send.leads.city}` : ""}
                  </p>
                </td>

                <td className="px-4 py-3">
                  <p className="text-text-2 max-w-[220px] truncate">{send.subject}</p>
                </td>

                <td className="px-4 py-3">
                  <p className="text-xs text-text-3">{send.to_email}</p>
                </td>

                <td className="px-4 py-3">
                  <StatusBadge status={send.status} />
                </td>

                <td className="px-4 py-3">
                  <p className="text-xs text-text-3">
                    {dateStr
                      ? new Date(dateStr).toLocaleDateString(undefined, { dateStyle: "medium" })
                      : "—"}
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
