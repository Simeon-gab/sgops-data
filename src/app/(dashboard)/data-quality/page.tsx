"use client";

import { CheckCircle, AlertTriangle, XCircle, ShieldCheck, Download } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { QualityBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { QUALITY_ISSUE_LABELS } from "@/lib/utils/constants";

async function downloadCSV() {
  try {
    const res = await fetch("/api/leads/export");
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sgops-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast("Export failed", "error");
  }
}

export default function DataQualityPage() {
  const { leads, loading } = useLeads(true);

  const verified   = leads.filter((l) => l.data_quality === "verified").length;
  const partial    = leads.filter((l) => l.data_quality === "partial").length;
  const unverified = leads.filter((l) => l.data_quality === "unverified").length;

  const issueCounts: Record<string, number> = {};
  for (const lead of leads) {
    for (const issue of lead.quality_issues ?? []) {
      issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
    }
  }
  const topIssues = Object.entries(issueCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([issue, count]) => ({
      issue,
      count,
      label: QUALITY_ISSUE_LABELS[issue] ?? issue,
      pct:   leads.length > 0 ? Math.round((count / leads.length) * 100) : 0,
    }));

  const stats = [
    {
      label: "Verified",
      count:  loading ? "..." : verified,
      icon:   CheckCircle,
      color:  "text-green-400",
      bg:     "bg-green-500/10",
    },
    {
      label: "Partial",
      count:  loading ? "..." : partial,
      icon:   AlertTriangle,
      color:  "text-amber-400",
      bg:     "bg-amber-500/10",
    },
    {
      label: "Unverified",
      count:  loading ? "..." : unverified,
      icon:   XCircle,
      color:  "text-text-3",
      bg:     "bg-bg-3",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-1">Data Quality</h2>
          <p className="text-text-3 mt-1">Monitor and resolve data quality issues across your leads</p>
        </div>
        {!loading && leads.length > 0 && (
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-border text-text-3 hover:text-text-1 hover:border-border-hover transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map(({ label, icon: Icon, color, bg, count }) => (
          <div key={label} className="bg-bg-2 border border-border rounded-xl p-5">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-text-1">{count}</p>
            <p className="text-sm text-text-3 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="h-4 w-40 bg-bg-3 rounded animate-pulse" />
          </div>
          <div className="divide-y divide-border/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="h-4 w-32 bg-bg-3 rounded animate-pulse" />
                <div className="h-2 w-24 bg-bg-3 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : !leads.length ? (
        <div className="bg-bg-2 border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-bg-3 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-text-3" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-1">No data to review</h3>
            <p className="text-sm text-text-3 mt-1 max-w-md">
              After running a prospect search, all records will appear here with their quality
              scores and issue flags.
            </p>
          </div>
        </div>
      ) : topIssues.length > 0 ? (
        <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-text-1">Quality issue breakdown</h3>
            <p className="text-xs text-text-3 mt-0.5">
              Issues flagged across {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="divide-y divide-border/50">
            {topIssues.map(({ issue, label, count, pct }) => (
              <div key={issue} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <QualityBadge
                    quality={
                      issue === "missing_email" || issue === "invalid_phone" || issue === "missing_phone"
                        ? "partial"
                        : "unverified"
                    }
                  />
                  <span className="text-sm text-text-2 truncate">{label}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="w-24 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold/50 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-3 w-16 text-right">
                    {count} ({pct}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-bg-2 border border-border rounded-xl p-8 flex flex-col items-center text-center gap-3">
          <CheckCircle className="h-8 w-8 text-green-400" />
          <div>
            <p className="text-sm font-medium text-text-1">No quality issues detected</p>
            <p className="text-xs text-text-3 mt-0.5">All {leads.length} leads passed quality checks</p>
          </div>
        </div>
      )}
    </div>
  );
}
