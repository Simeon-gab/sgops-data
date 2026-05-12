"use client";

import { Mail, Send, CheckCircle, Eye, XCircle, RefreshCw } from "lucide-react";
import { useOutreach } from "@/hooks/useOutreach";
import { OutreachTable } from "@/components/outreach/outreach-table";

export default function OutreachPage() {
  const { sends, loading, error, refetch, stats } = useOutreach();

  const STAT_CARDS = [
    { label: "Total Sent",  value: stats.sent,      icon: Send,        color: "text-blue-400",  bg: "bg-blue-500/10" },
    { label: "Delivered",   value: stats.delivered, icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Opened",      value: stats.opened,    icon: Eye,         color: "text-gold",       bg: "bg-gold/10" },
    { label: "Bounced",     value: stats.bounced,   icon: XCircle,     color: "text-red-400",    bg: "bg-red-500/10" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-1">Outreach</h2>
          <p className="text-text-3 mt-1">Track all sent emails and delivery status</p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-border text-text-3 hover:text-text-1 hover:border-border-hover transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-bg-2 border border-border rounded-xl p-5">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-text-1">{value}</p>
            <p className="text-sm text-text-3 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={refetch} className="text-xs text-red-400 underline mt-1">
            Retry
          </button>
        </div>
      )}

      {!loading && sends.length === 0 ? (
        <div className="bg-bg-2 border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-bg-3 flex items-center justify-center">
            <Mail className="h-8 w-8 text-text-3" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-1">No emails sent yet</h3>
            <p className="text-sm text-text-3 mt-1 max-w-md">
              Generate outreach for a lead and send it from the Cold Email tab. All sent emails
              appear here with live delivery status.
            </p>
          </div>
        </div>
      ) : (
        <OutreachTable sends={sends} loading={loading} />
      )}
    </div>
  );
}
