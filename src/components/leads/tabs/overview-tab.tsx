"use client";

import { useState } from "react";
import {
  Phone, Mail, Globe, Star, MapPin, Video, BookOpen,
  Instagram, Facebook, Youtube, Linkedin, Megaphone,
  TrendingUp, Users, Sparkles, AlertCircle,
} from "lucide-react";
import { TierBadge, QualityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import type { Lead, ScoreSignal } from "@/lib/utils/types";

interface OverviewTabProps {
  lead: Lead;
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score, tier }: { score: number; tier: Lead["tier"] }) {
  const color =
    tier === "hot"  ? "bg-red-500"  :
    tier === "warm" ? "bg-gold"     :
    "bg-slate-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-3">Lead Score</span>
        <span className="font-mono font-semibold text-text-1">{score}/100</span>
      </div>
      <div className="h-2 bg-bg-4 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all", color)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ── Enrichment check icon ─────────────────────────────────────────────────────

function CheckRow({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={clsx("w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
        value ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
      )}>
        {value ? "✓" : "✗"}
      </span>
      <span className={value ? "text-text-2" : "text-text-3"}>{label}</span>
    </div>
  );
}

// ── Score breakdown ───────────────────────────────────────────────────────────

function ScoreBreakdown({ signals }: { signals: ScoreSignal[] }) {
  if (signals.length === 0) {
    return (
      <p className="text-xs text-text-3 italic">
        Run enrichment to generate score breakdown.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {signals.map((s) => (
        <div
          key={s.signal}
          className="flex items-start gap-3 py-1.5 px-3 rounded-lg bg-bg-3/60 hover:bg-bg-3 transition-colors"
        >
          <span
            className={clsx(
              "mt-0.5 shrink-0 text-xs font-mono font-semibold w-12 text-right",
              s.points >= 0 ? "text-green-400" : "text-red-400"
            )}
          >
            {s.points >= 0 ? `+${s.points}` : s.points}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-1 font-medium leading-snug">{s.reason}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Social platform icon ──────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook:  Facebook,
  youtube:   Youtube,
  linkedin:  Linkedin,
  tiktok:    Megaphone,
};

// ── AI summary ────────────────────────────────────────────────────────────────

function AISummarySection({ leadId }: { leadId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, type: "lead_intel" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (!summary && !error) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={generate}
        loading={loading}
        className="gap-1.5"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Generate AI Summary
      </Button>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={generate} className="text-xs text-text-3 underline mt-0.5">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-2 leading-relaxed">{summary}</p>
      <button
        onClick={generate}
        disabled={loading}
        className="text-xs text-text-3 hover:text-text-2 underline transition-colors disabled:opacity-50"
      >
        {loading ? "Regenerating..." : "Regenerate"}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OverviewTab({ lead }: OverviewTabProps) {
  return (
    <div className="p-6 space-y-6">

      {/* Score */}
      <div className="bg-bg-3 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <TierBadge tier={lead.tier} />
          <QualityBadge quality={lead.data_quality} />
          {lead.enriched_at ? null : (
            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              Not enriched
            </span>
          )}
        </div>
        <ScoreBar score={lead.score} tier={lead.tier} />
      </div>

      {/* Contact info */}
      <Section title="Contact">
        <div className="space-y-2.5">
          {lead.phone_formatted && (
            <DataRow icon={Phone}>
              <a href={`tel:${lead.phone}`} className="hover:text-gold transition-colors">
                {lead.phone_formatted}
              </a>
              {!lead.phone_valid && <span className="text-xs text-amber-400">(unverified)</span>}
            </DataRow>
          )}
          {lead.email && (
            <DataRow icon={Mail}>
              <a href={`mailto:${lead.email}`} className="hover:text-gold transition-colors">
                {lead.email}
              </a>
              {lead.email_verified && (
                <span className="text-xs text-green-400">verified</span>
              )}
            </DataRow>
          )}
          {lead.website && (
            <DataRow icon={Globe}>
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gold transition-colors truncate"
              >
                {lead.website.replace(/https?:\/\/(www\.)?/, "")}
              </a>
            </DataRow>
          )}
          {!lead.phone_formatted && !lead.email && !lead.website && (
            <p className="text-xs text-text-3 italic">No contact information found.</p>
          )}
        </div>
      </Section>

      {/* Location */}
      <Section title="Location">
        <DataRow icon={MapPin}>
          <span className="text-text-2">
            {[lead.street, lead.city, lead.state, lead.country]
              .filter(Boolean)
              .join(", ")}
          </span>
        </DataRow>
      </Section>

      {/* Digital presence */}
      {lead.enriched_at && (
        <Section title="Digital Presence">
          <div className="grid grid-cols-2 gap-2">
            <CheckRow label="Video content" value={lead.has_video_content} />
            <CheckRow label="Has blog"      value={lead.has_blog} />
            <CheckRow label="Google Ads"    value={lead.runs_google_ads} />
            <CheckRow label="Meta Ads"      value={lead.runs_meta_ads} />
            {lead.website_quality && (
              <div className="col-span-2 flex items-center gap-2 text-xs">
                <span className="text-text-3">Website quality:</span>
                <span className={clsx("font-medium", {
                  "text-green-400": lead.website_quality === "modern",
                  "text-amber-400": lead.website_quality === "outdated",
                  "text-text-3":    lead.website_quality === "minimal",
                })}>
                  {lead.website_quality}
                </span>
              </div>
            )}
          </div>

          {lead.social_profiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {lead.social_profiles.map((p) => {
                const Icon = PLATFORM_ICONS[p.platform] ?? Globe;
                return (
                  <a
                    key={p.platform}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-bg-4 border border-border hover:border-border-hover text-text-2 hover:text-text-1 transition-colors"
                  >
                    <Icon className="h-3 w-3" />
                    {p.platform}
                  </a>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* Rating + reviews */}
      {(lead.rating != null || lead.review_count > 0) && (
        <Section title="Google Reviews">
          <div className="flex items-center gap-4">
            {lead.rating != null && (
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 text-gold fill-gold" />
                <span className="text-sm font-semibold text-text-1">{lead.rating}</span>
              </div>
            )}
            <span className="text-sm text-text-3">
              {lead.review_count.toLocaleString()} review{lead.review_count !== 1 ? "s" : ""}
            </span>
          </div>
        </Section>
      )}

      {/* Business signals */}
      {lead.business_signals.length > 0 && (
        <Section title="Business Signals">
          <div className="flex flex-wrap gap-2">
            {lead.business_signals.map((s) => (
              <span
                key={s}
                className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400"
              >
                {s.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Competitors */}
      {lead.competitors.length > 0 && (
        <Section title="Nearby Competitors">
          <div className="space-y-1.5">
            {lead.competitors.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-text-2 truncate flex-1">{c.name}</span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {c.has_video && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Video className="h-3 w-3" />
                      video
                    </span>
                  )}
                  <span className="text-text-3">{c.review_count} reviews</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Extra info */}
      {(lead.years_in_business != null || lead.estimated_employees != null) && (
        <Section title="Business Info">
          <div className="flex gap-6">
            {lead.years_in_business != null && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingUp className="h-3.5 w-3.5 text-text-3" />
                <span className="text-text-2">{lead.years_in_business} yr{lead.years_in_business !== 1 ? "s" : ""} in business</span>
              </div>
            )}
            {lead.estimated_employees != null && (
              <div className="flex items-center gap-2 text-xs">
                <Users className="h-3.5 w-3.5 text-text-3" />
                <span className="text-text-2">~{lead.estimated_employees} employees</span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Score breakdown */}
      <Section title="Score Breakdown">
        <ScoreBreakdown signals={lead.score_breakdown ?? []} />
      </Section>

      {/* AI intelligence summary */}
      <Section title="AI Intelligence">
        <AISummarySection leadId={lead.id} />
      </Section>

    </div>
  );
}

// ── Small layout helpers ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-2.5">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DataRow({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-text-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-text-3" />
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}
