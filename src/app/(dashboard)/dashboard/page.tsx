"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Flame,
  Kanban,
  Mail,
  Search,
  ArrowRight,
  TrendingUp,
  CheckCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  leads: {
    total: number;
    hot: number;
    warm: number;
    cold: number;
    active: number;
    with_email: number;
    by_stage: Array<{ stage: string; label: string; count: number; color: string }>;
    by_niche: Array<{ niche: string; count: number }>;
    verified: number;
    partial: number;
    unverified: number;
  };
  sends: {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    bounced: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month:   "long",
    day:     "numeric",
  });
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  bg,
  loading,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-bg-2 border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-16 bg-bg-3 rounded animate-pulse" />
          <div className="h-3 w-24 bg-bg-3 rounded animate-pulse" />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold text-text-1">{value}</p>
          <p className="text-sm text-text-3 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-text-3 mt-1 opacity-70">{sub}</p>}
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-1">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const leads   = data?.leads;
  const sends   = data?.sends;
  const maxStage = Math.max(1, ...(leads?.by_stage.map((s) => s.count) ?? [1]));
  const maxNiche = Math.max(1, ...(leads?.by_niche.map((n) => n.count) ?? [1]));
  const deliveryRate = pct(sends?.delivered ?? 0, sends?.sent ?? 0);
  const openRate     = pct(sends?.opened ?? 0, sends?.delivered ?? 0);

  return (
    <div className="max-w-5xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text-1">
          {greeting()}
        </h2>
        <p className="text-text-3 mt-1 text-sm">
          {todayLabel()} · Here&apos;s your agency pipeline at a glance
        </p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
        <StatCard
          label="Total Leads"
          value={leads?.total ?? 0}
          sub={`${leads?.hot ?? 0} hot · ${leads?.with_email ?? 0} with email`}
          icon={Users}
          color="text-text-2"
          bg="bg-bg-3"
          loading={loading}
        />
        <StatCard
          label="Hot Leads"
          value={leads?.hot ?? 0}
          sub={`${pct(leads?.hot ?? 0, leads?.total ?? 0)}% of total`}
          icon={Flame}
          color="text-red-400"
          bg="bg-red-500/10"
          loading={loading}
        />
        <StatCard
          label="Active Pipeline"
          value={leads?.active ?? 0}
          sub={`${(leads?.total ?? 0) - (leads?.active ?? 0)} closed or lost`}
          icon={Kanban}
          color="text-blue-400"
          bg="bg-blue-500/10"
          loading={loading}
        />
        <StatCard
          label="Emails Sent"
          value={sends?.sent ?? 0}
          sub={deliveryRate > 0 ? `${deliveryRate}% delivery rate` : "No emails yet"}
          icon={Mail}
          color="text-gold"
          bg="bg-gold/10"
          loading={loading}
        />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Pipeline funnel */}
        <SectionCard title="Pipeline Funnel">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 w-20 bg-bg-3 rounded animate-pulse" />
                  <div className="h-3 flex-1 bg-bg-3 rounded animate-pulse" />
                  <div className="h-3 w-8 bg-bg-3 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : leads?.total === 0 ? (
            <p className="text-sm text-text-3 py-4 text-center">No leads yet</p>
          ) : (
            <div className="space-y-2.5">
              {(leads?.by_stage ?? []).map(({ stage, label, count, color }) => (
                <div key={stage} className="flex items-center gap-3 group">
                  <span className="text-xs text-text-3 w-24 shrink-0 truncate">{label}</span>
                  <div className="flex-1 h-2 bg-bg-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width:           `${pct(count, maxStage)}%`,
                        backgroundColor: color,
                        opacity:         count > 0 ? 0.8 : 0.15,
                      }}
                    />
                  </div>
                  <span className="text-xs text-text-3 w-6 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Top niches */}
        <SectionCard title="Top Niches">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 w-24 bg-bg-3 rounded animate-pulse" />
                  <div className="h-3 flex-1 bg-bg-3 rounded animate-pulse" />
                  <div className="h-3 w-8 bg-bg-3 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : !leads?.by_niche?.length ? (
            <p className="text-sm text-text-3 py-4 text-center">No leads yet</p>
          ) : (
            <div className="space-y-2.5">
              {(leads?.by_niche ?? []).map(({ niche, count }) => (
                <div key={niche} className="flex items-center gap-3">
                  <span className="text-xs text-text-2 w-32 shrink-0 truncate">{niche}</span>
                  <div className="flex-1 h-2 bg-bg-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gold/60 transition-all duration-500"
                      style={{ width: `${pct(count, maxNiche)}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-3 w-6 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Email health + data quality row */}
      {!loading && (sends?.sent ?? 0) > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <SectionCard title="Email Health">
            <div className="space-y-3">
              {[
                { label: "Delivery rate",  value: deliveryRate, color: "bg-green-500" },
                { label: "Open rate",      value: openRate,     color: "bg-gold" },
                { label: "Bounce rate",    value: pct(sends?.bounced ?? 0, sends?.sent ?? 0), color: "bg-red-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-text-3 w-28 shrink-0">{label}</span>
                  <div className="flex-1 h-2 bg-bg-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color}/60 transition-all duration-500`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-text-2 w-10 text-right shrink-0">{value}%</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Data Quality">
            <div className="space-y-3">
              {[
                { label: "Verified",   value: leads?.verified   ?? 0, color: "bg-green-500" },
                { label: "Partial",    value: leads?.partial    ?? 0, color: "bg-amber-500" },
                { label: "Unverified", value: leads?.unverified ?? 0, color: "bg-text-3" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-text-3 w-28 shrink-0">{label}</span>
                  <div className="flex-1 h-2 bg-bg-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color}/60 transition-all duration-500`}
                      style={{ width: `${pct(value, leads?.total ?? 0)}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-3 w-6 text-right shrink-0">{value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-bg-2 border border-border rounded-xl p-5">
        <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-4">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/prospect",     icon: Search,      label: "New search",  desc: "Find leads" },
            { href: "/leads",        icon: Users,       label: "View leads",  desc: "Browse all" },
            { href: "/pipeline",     icon: Kanban,      label: "Pipeline",    desc: "Track deals" },
            { href: "/outreach",     icon: Mail,        label: "Outreach",    desc: "Email history" },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 p-3 rounded-lg bg-bg-3 hover:bg-bg-4 border border-transparent hover:border-border transition-all"
            >
              <Icon className="h-4 w-4 text-text-3 group-hover:text-gold transition-colors shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-2 group-hover:text-text-1 transition-colors truncate">{label}</p>
                <p className="text-xs text-text-3 truncate">{desc}</p>
              </div>
              <ArrowRight className="h-3 w-3 text-text-3 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Empty state CTA */}
      {!loading && (leads?.total ?? 0) === 0 && (
        <div className="mt-6 bg-bg-2 border border-border rounded-2xl p-10 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gold-dim flex items-center justify-center">
            <TrendingUp className="h-7 w-7 text-gold" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-1">Start building your pipeline</h3>
            <p className="text-sm text-text-3 mt-1 max-w-sm">
              Run your first prospect search to populate your dashboard with real data.
            </p>
          </div>
          <Link
            href="/prospect"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold text-bg-0 font-medium text-sm hover:bg-gold-bright transition-colors"
          >
            <Search className="h-4 w-4" />
            Start prospecting
          </Link>
        </div>
      )}

      {/* Delivery rate notice when emails delivered */}
      {!loading && (sends?.sent ?? 0) > 0 && (sends?.delivered ?? 0) > 0 && (
        <div className="mt-4 flex items-center gap-2 text-xs text-green-400">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {sends!.delivered} of {sends!.sent} emails delivered ({deliveryRate}% delivery rate)
          </span>
        </div>
      )}
    </div>
  );
}
