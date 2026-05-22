"use client";

import { useState } from "react";
import {
  Share2, Camera, Video, Film, Megaphone, Tv, PenTool, Layers, Sparkles, Globe, MessageSquare,
  ChevronDown, ChevronUp, Copy, RefreshCw, Loader2, CheckCircle, AlertCircle,
  BarChart2, Search, Lightbulb, CheckSquare, DollarSign, Target, FileText,
  TrendingUp, TrendingDown, Zap, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { Lead } from "@/lib/utils/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ContentPlanData {
  executive_summary: string;
  current_state: { strengths: string[]; weaknesses: string[] };
  gap_analysis: string[];
  strategy: {
    overview: string;
    by_service: Array<{ service: string; approach: string; specifics: string[] }>;
    content_calendar: string;
  };
  deliverables: Array<{ item: string; timeline: string }>;
  pricing: {
    starter: { name: string; description: string; includes: string[]; price: string };
    growth:  { name: string; description: string; includes: string[]; price: string };
    premium: { name: string; description: string; includes: string[]; price: string };
  };
  kpis: Array<{ metric: string; target: string; timeline: string }>;
}

type Step = 1 | 2 | 3;

// ── Static data ────────────────────────────────────────────────────────────────

const SERVICES = [
  { id: "Social Media Management", label: "Social Media Management", icon: Share2 },
  { id: "Photography",              label: "Photography",              icon: Camera },
  { id: "Videography",              label: "Videography",              icon: Video },
  { id: "Video Production",         label: "Video Production",         icon: Film },
  { id: "Marketing Agency",         label: "Marketing Agency",         icon: Megaphone },
  { id: "Advertising Agency",       label: "Advertising Agency",       icon: Tv },
  { id: "Content Creation",         label: "Content Creation",         icon: PenTool },
  { id: "Graphic Design",           label: "Graphic Design",           icon: Layers },
  { id: "Branding",                 label: "Branding",                 icon: Sparkles },
  { id: "Web Design",               label: "Web Design",               icon: Globe },
  { id: "PR & Communications",      label: "PR & Communications",      icon: MessageSquare },
] as const;

const DURATIONS = [
  { value: 30 as const, label: "30-Day Sprint", desc: "Fast results, focused scope" },
  { value: 60 as const, label: "60-Day Plan",   desc: "Balanced depth and delivery" },
  { value: 90 as const, label: "90-Day Plan",   desc: "Full strategy, maximum ROI" },
];

// ── Business analysis (pure data derivation, no AI) ───────────────────────────

interface BusinessAnalysis {
  currentAssets:      string[];
  missingAssets:      string[];
  opportunities:      string[];
  competitorInsights: string[];
}

function analyzeLeadData(lead: Lead): BusinessAnalysis {
  const currentAssets:      string[] = [];
  const missingAssets:      string[] = [];
  const opportunities:      string[] = [];
  const competitorInsights: string[] = [];

  if (lead.website) currentAssets.push("Business website present");
  if (lead.has_video_content) currentAssets.push("Video content exists");
  if (lead.has_blog) currentAssets.push("Blog or content section");
  if (lead.social_profiles.length > 0) {
    currentAssets.push(`Active on ${lead.social_profiles.map((s) => s.platform).join(", ")}`);
  }
  if (lead.runs_google_ads) currentAssets.push("Running Google Ads");
  if (lead.runs_meta_ads)   currentAssets.push("Running Meta Ads");
  if (lead.rating && lead.review_count > 0) {
    currentAssets.push(`${lead.review_count.toLocaleString()} Google reviews (${lead.rating} avg)`);
  }
  if (currentAssets.length === 0) currentAssets.push("Limited digital presence found");

  if (!lead.has_video_content) missingAssets.push("No video content");
  if (!lead.website)            missingAssets.push("No website detected");
  if (!lead.has_blog)           missingAssets.push("No blog or content section");
  if (!lead.runs_google_ads && !lead.runs_meta_ads) missingAssets.push("Not running digital ads");
  const ig = lead.social_profiles.find((s) => s.platform === "instagram");
  if (ig && ig.posts_per_week !== null && ig.posts_per_week < 3) {
    missingAssets.push(`Inconsistent Instagram posting (${ig.posts_per_week}x/week)`);
  }
  if (missingAssets.length === 0) missingAssets.push("Strong baseline digital presence");

  if (lead.review_count > 50) opportunities.push("Strong review base for testimonial-driven content");
  if (lead.rating && lead.rating >= 4.5) opportunities.push("Exceptional rating — prime for brand trust content");
  if (!lead.has_video_content)  opportunities.push("First-mover video advantage in their niche");
  if (lead.social_profiles.length > 0 && !lead.has_video_content) {
    opportunities.push("Existing audience to target with new video content");
  }
  if (lead.runs_google_ads || lead.runs_meta_ads) {
    opportunities.push("Existing ad budget to amplify with quality creative");
  }
  if (opportunities.length === 0) opportunities.push("Content differentiation opportunity in local market");

  const withVideo = lead.competitors.filter((c) => c.has_video);
  if (lead.competitors.length > 0) {
    if (withVideo.length > 0) {
      competitorInsights.push(`${withVideo.length} of ${lead.competitors.length} competitors have video`);
    } else {
      competitorInsights.push(`None of ${lead.competitors.length} local competitors have video content`);
    }
    if (lead.competitors.length > 3) {
      competitorInsights.push(`${lead.competitors.length} competitors active in the local market`);
    }
  } else {
    competitorInsights.push("No direct competitors identified — early mover advantage");
  }

  return { currentAssets, missingAssets, opportunities, competitorInsights };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AnalysisCard({
  title,
  icon: Icon,
  colorClass,
  items,
}: {
  title: string;
  icon: React.ElementType;
  colorClass: string;
  items: string[];
}) {
  return (
    <div className={`rounded-xl border p-3 space-y-2 ${colorClass}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-text-2 flex items-start gap-1.5">
            <span className="shrink-0 mt-0.5 opacity-40">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  expanded,
  onToggle,
  onCopy,
  children,
}: {
  title: string;
  icon: React.ElementType;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-2 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-3/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-gold" />
          <span className="text-sm font-semibold text-text-1">{title}</span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-text-3" />
          : <ChevronDown className="h-4 w-4 text-text-3" />
        }
      </button>
      {expanded && (
        <div className="border-t border-border">
          <div className="p-4">{children}</div>
          <div className="px-4 pb-3">
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 text-xs text-text-3 hover:text-text-2 transition-colors"
            >
              <Copy className="h-3 w-3" />
              Copy section
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plan display ──────────────────────────────────────────────────────────────

function PlanDisplay({
  plan,
  services,
  duration,
  tokensUsed,
  onRebuild,
}: {
  plan: ContentPlanData;
  services: string[];
  duration: 30 | 60 | 90;
  tokensUsed: number;
  onRebuild: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["executive_summary"])
  );

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`${label} copied`, "success");
  };

  const copyAll = () => {
    const lines: string[] = [
      "CONTENT STRATEGY PROPOSAL",
      `Services: ${services.join(", ")}`,
      `Duration: ${duration} days`,
      "",
      "EXECUTIVE SUMMARY",
      plan.executive_summary,
      "",
      "CURRENT STATE",
      "Strengths:",
      ...plan.current_state.strengths.map((s) => `  - ${s}`),
      "Weaknesses:",
      ...plan.current_state.weaknesses.map((w) => `  - ${w}`),
      "",
      "GAP ANALYSIS",
      ...plan.gap_analysis.map((g) => `- ${g}`),
      "",
      "STRATEGY",
      plan.strategy.overview,
      "",
      ...plan.strategy.by_service.flatMap((svc) => [
        svc.service,
        svc.approach,
        ...svc.specifics.map((sp) => `  - ${sp}`),
        "",
      ]),
      "Content Calendar:",
      plan.strategy.content_calendar,
      "",
      "DELIVERABLES",
      ...plan.deliverables.map((d) => `- ${d.item} (${d.timeline})`),
      "",
      "PRICING",
      ...(["starter", "growth", "premium"] as const).flatMap((key) => {
        const t = plan.pricing[key];
        return [`${t.name} — ${t.price}`, ...t.includes.map((i) => `  - ${i}`), ""];
      }),
      "KPIs",
      ...plan.kpis.map((k) => `- ${k.metric}: ${k.target} (${k.timeline})`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast("Full content plan copied", "success");
  };

  const tierColors = {
    starter: "border-slate-500/20 bg-slate-500/5 text-slate-400",
    growth:  "border-gold/20 bg-gold/5 text-gold",
    premium: "border-purple-500/20 bg-purple-500/5 text-purple-400",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-2 font-medium">{duration}-day plan for {services.join(", ")}</p>
          <p className="text-xs text-text-3 mt-0.5">{tokensUsed.toLocaleString()} tokens used</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copyAll}>
            <Copy className="h-3.5 w-3.5" />
            Copy All
          </Button>
          <Button variant="ghost" size="sm" onClick={onRebuild}>
            <RefreshCw className="h-3.5 w-3.5" />
            Rebuild
          </Button>
        </div>
      </div>

      <Section
        title="Executive Summary"
        icon={FileText}
        expanded={expanded.has("executive_summary")}
        onToggle={() => toggle("executive_summary")}
        onCopy={() => copy(plan.executive_summary, "Executive summary")}
      >
        <p className="text-sm text-text-2 leading-relaxed">{plan.executive_summary}</p>
      </Section>

      <Section
        title="Current State"
        icon={BarChart2}
        expanded={expanded.has("current_state")}
        onToggle={() => toggle("current_state")}
        onCopy={() => copy(
          `Strengths:\n${plan.current_state.strengths.map((s) => `- ${s}`).join("\n")}\n\nWeaknesses:\n${plan.current_state.weaknesses.map((w) => `- ${w}`).join("\n")}`,
          "Current state"
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs font-semibold text-green-400">Strengths</span>
            </div>
            {plan.current_state.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="h-3 w-3 text-green-400/60 mt-0.5 shrink-0" />
                <p className="text-xs text-text-2">{s}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              <span className="text-xs font-semibold text-red-400">Weaknesses</span>
            </div>
            {plan.current_state.weaknesses.map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle className="h-3 w-3 text-red-400/60 mt-0.5 shrink-0" />
                <p className="text-xs text-text-2">{w}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Gap Analysis"
        icon={Search}
        expanded={expanded.has("gap_analysis")}
        onToggle={() => toggle("gap_analysis")}
        onCopy={() => copy(plan.gap_analysis.map((g) => `- ${g}`).join("\n"), "Gap analysis")}
      >
        <ul className="space-y-2.5">
          {plan.gap_analysis.map((gap, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="text-xs font-mono text-text-3 mt-0.5 w-4 shrink-0">{i + 1}.</span>
              <p className="text-sm text-text-2">{gap}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Strategy"
        icon={Lightbulb}
        expanded={expanded.has("strategy")}
        onToggle={() => toggle("strategy")}
        onCopy={() => copy(
          [
            plan.strategy.overview,
            "",
            ...plan.strategy.by_service.flatMap((s) => [
              s.service, s.approach, ...s.specifics.map((sp) => `  - ${sp}`), "",
            ]),
            "Content Calendar:", plan.strategy.content_calendar,
          ].join("\n"),
          "Strategy"
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-2 leading-relaxed">{plan.strategy.overview}</p>
          {plan.strategy.by_service.map((svc, i) => (
            <div key={i} className="rounded-lg border border-border bg-bg-3 p-3 space-y-2">
              <p className="text-xs font-semibold text-gold">{svc.service}</p>
              <p className="text-xs text-text-2 leading-relaxed">{svc.approach}</p>
              {svc.specifics.length > 0 && (
                <ul className="space-y-1">
                  {svc.specifics.map((sp, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-xs text-text-3">
                      <span className="shrink-0 mt-0.5">•</span>
                      {sp}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {plan.strategy.content_calendar && (
            <div className="rounded-lg bg-bg-3 border border-border p-3">
              <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-1.5">Content Calendar</p>
              <p className="text-xs text-text-2 leading-relaxed">{plan.strategy.content_calendar}</p>
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Deliverables"
        icon={CheckSquare}
        expanded={expanded.has("deliverables")}
        onToggle={() => toggle("deliverables")}
        onCopy={() => copy(plan.deliverables.map((d) => `- ${d.item} (${d.timeline})`).join("\n"), "Deliverables")}
      >
        <div className="space-y-0">
          {plan.deliverables.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-text-3 shrink-0" />
                <p className="text-sm text-text-2">{d.item}</p>
              </div>
              <span className="text-xs text-text-3 whitespace-nowrap shrink-0">{d.timeline}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Proposed Pricing"
        icon={DollarSign}
        expanded={expanded.has("pricing")}
        onToggle={() => toggle("pricing")}
        onCopy={() => copy(
          (["starter", "growth", "premium"] as const)
            .map((k) => {
              const t = plan.pricing[k];
              return `${t.name} — ${t.price}\n${t.includes.map((i) => `  - ${i}`).join("\n")}`;
            })
            .join("\n\n"),
          "Pricing"
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["starter", "growth", "premium"] as const).map((key) => {
            const tier = plan.pricing[key];
            return (
              <div key={key} className={`rounded-xl border p-3 space-y-2 ${tierColors[key]}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{tier.name}</span>
                  <span className="text-xs font-mono font-bold">{tier.price}</span>
                </div>
                <p className="text-xs text-text-3 leading-snug">{tier.description}</p>
                <ul className="space-y-1">
                  {tier.includes.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-text-2">
                      <span className="shrink-0 mt-0.5 opacity-40">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="KPIs & Success Metrics"
        icon={Target}
        expanded={expanded.has("kpis")}
        onToggle={() => toggle("kpis")}
        onCopy={() => copy(plan.kpis.map((k) => `${k.metric}: ${k.target} (${k.timeline})`).join("\n"), "KPIs")}
      >
        <div className="space-y-0">
          {plan.kpis.map((kpi, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
              <Zap className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-1">{kpi.metric}</p>
                <p className="text-xs text-text-3 mt-0.5">{kpi.target}</p>
              </div>
              <span className="text-xs text-text-3 whitespace-nowrap shrink-0">{kpi.timeline}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContentPlanTab({ lead }: { lead: Lead }) {
  const [step, setStep]                         = useState<Step>(1);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [duration, setDuration]                 = useState<30 | 60 | 90>(90);
  const [generating, setGenerating]             = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [plan, setPlan]                         = useState<ContentPlanData | null>(null);
  const [tokensUsed, setTokensUsed]             = useState(0);

  const analysis = analyzeLeadData(lead);

  const toggleService = (id: string) =>
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          type: "content_plan",
          services: selectedServices,
          duration,
        }),
      });
      const data = await res.json() as { templates?: Array<{ structured_data: unknown; tokens_used?: number }>; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const template = data.templates?.[0];
      if (!template?.structured_data) throw new Error("No plan data returned");
      setPlan(template.structured_data as ContentPlanData);
      setTokensUsed(template.tokens_used ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleRebuild = () => {
    setPlan(null);
    setError(null);
    setStep(1);
    setSelectedServices([]);
    setDuration(90);
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (generating) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="h-8 w-8 text-gold animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-text-1">Generating your content strategy</p>
          <p className="text-xs text-text-3 mt-1">
            Writing a custom {duration}-day proposal for {lead.name}. Usually 15-30 seconds.
          </p>
        </div>
      </div>
    );
  }

  // ── Plan display ─────────────────────────────────────────────────────────────

  if (plan) {
    return (
      <div className="p-6">
        <PlanDisplay
          plan={plan}
          services={selectedServices}
          duration={duration}
          tokensUsed={tokensUsed}
          onRebuild={handleRebuild}
        />
      </div>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step === s
                  ? "bg-gold text-bg-1"
                  : step > s
                  ? "bg-gold/20 text-gold"
                  : "bg-bg-3 text-text-3"
              }`}
            >
              {step > s ? <CheckCircle className="h-3.5 w-3.5" /> : s}
            </div>
            {s < 3 && (
              <div className={`h-px w-8 transition-colors ${step > s ? "bg-gold/40" : "bg-border"}`} />
            )}
          </div>
        ))}
        <span className="text-xs text-text-3 ml-1">
          {step === 1 && "Select services"}
          {step === 2 && "Review analysis"}
          {step === 3 && "Set duration & generate"}
        </span>
      </div>

      {/* Step 1: Service selection */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-1">What services are you proposing?</h3>
            <p className="text-xs text-text-3 mt-1">Select one or more. The plan will be tailored to these services.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SERVICES.map((svc) => {
              const selected = selectedServices.includes(svc.id);
              return (
                <button
                  key={svc.id}
                  onClick={() => toggleService(svc.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    selected
                      ? "border-gold/40 bg-gold/5 text-gold"
                      : "border-border bg-bg-2 text-text-2 hover:bg-bg-3"
                  }`}
                >
                  <svc.icon className={`h-4 w-4 shrink-0 ${selected ? "text-gold" : "text-text-3"}`} />
                  <span className="text-xs font-medium leading-tight">{svc.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={selectedServices.length === 0}>
              Next: Review Analysis
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Business analysis */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-1">Business analysis: {lead.name}</h3>
            <p className="text-xs text-text-3 mt-1">Derived from public data. Claude will use this to personalise your proposal.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnalysisCard
              title="What they have"
              icon={CheckCircle}
              colorClass="border-green-500/20 bg-green-500/5 text-green-400"
              items={analysis.currentAssets}
            />
            <AnalysisCard
              title="What's missing"
              icon={AlertCircle}
              colorClass="border-red-500/20 bg-red-500/5 text-red-400"
              items={analysis.missingAssets}
            />
            <AnalysisCard
              title="Opportunities"
              icon={Zap}
              colorClass="border-gold/20 bg-gold/5 text-gold"
              items={analysis.opportunities}
            />
            <AnalysisCard
              title="Competitor activity"
              icon={Users}
              colorClass="border-blue-500/20 bg-blue-500/5 text-blue-400"
              items={analysis.competitorInsights}
            />
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)} className="text-xs text-text-3 hover:text-text-2 transition-colors">
              Back
            </button>
            <Button onClick={() => setStep(3)}>Next: Set Duration</Button>
          </div>
        </div>
      )}

      {/* Step 3: Duration + generate */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-1">How long is the engagement?</h3>
            <p className="text-xs text-text-3 mt-1">Choose the plan duration for your proposal.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {DURATIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border text-center transition-colors ${
                  duration === d.value
                    ? "border-gold/40 bg-gold/5"
                    : "border-border bg-bg-2 hover:bg-bg-3"
                }`}
              >
                <span className={`text-sm font-semibold ${duration === d.value ? "text-gold" : "text-text-1"}`}>
                  {d.label}
                </span>
                <span className="text-xs text-text-3 leading-snug">{d.desc}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-bg-3 p-3">
            <p className="text-xs text-text-3">
              Generating a <span className="font-medium text-text-2">{duration}-day plan</span> for{" "}
              <span className="font-medium text-text-2">{lead.name}</span> covering{" "}
              <span className="font-medium text-text-2">{selectedServices.join(", ")}</span>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(2)} className="text-xs text-text-3 hover:text-text-2 transition-colors">
              Back
            </button>
            <Button onClick={handleGenerate}>
              Generate Strategy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
