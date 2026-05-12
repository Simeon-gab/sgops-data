"use client";

import { Copy, RefreshCw, Calendar, Camera, Target, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabContent } from "@/hooks/useTabContent";
import { toast } from "@/components/ui/toast";
import { LoadingState, ErrorState } from "./cold-email-tab";
import type { Lead } from "@/lib/utils/types";

interface ContentPlanTabProps {
  lead: Lead;
}

// ── Structured plan renderer ───────────────────────────────────────────────────

interface MonthData {
  theme?: string;
  shoot_days?: number;
  posting_schedule?: string;
  deliverables?: string[];
  platform_focus?: string;
  platforms?: string[];
  goal?: string;
  [key: string]: unknown;
}

interface PricingTier {
  description?: string;
  price_range?: string;
  [key: string]: unknown;
}

function MonthCard({ month, data }: { month: string; data: MonthData }) {
  return (
    <div className="rounded-xl border border-border bg-bg-3 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-bg-4">
        <Calendar className="h-4 w-4 text-gold" />
        <span className="text-sm font-semibold text-text-1">
          {month.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
        {data.theme && (
          <span className="text-xs text-text-3 italic truncate">— {data.theme}</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {data.goal && (
          <div className="flex items-start gap-2">
            <Target className="h-3.5 w-3.5 text-text-3 mt-0.5 shrink-0" />
            <p className="text-xs text-text-2">{data.goal}</p>
          </div>
        )}

        {(data.shoot_days != null || data.posting_schedule) && (
          <div className="flex items-start gap-2">
            <Camera className="h-3.5 w-3.5 text-text-3 mt-0.5 shrink-0" />
            <p className="text-xs text-text-2">
              {data.shoot_days != null && `${data.shoot_days} shoot day${data.shoot_days !== 1 ? "s" : ""}`}
              {data.shoot_days != null && data.posting_schedule && " · "}
              {data.posting_schedule}
            </p>
          </div>
        )}

        {(data.platform_focus || (data.platforms && data.platforms.length > 0)) && (
          <div className="flex flex-wrap gap-1.5">
            {(data.platforms ?? (data.platform_focus ? [data.platform_focus] : [])).map(
              (p: string, i: number) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400"
                >
                  {p}
                </span>
              )
            )}
          </div>
        )}

        {data.deliverables && data.deliverables.length > 0 && (
          <ul className="space-y-1">
            {data.deliverables.map((d: string, i: number) => (
              <li key={i} className="text-xs text-text-2 flex items-start gap-1.5">
                <span className="text-text-3 shrink-0 mt-0.5">•</span>
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PricingSection({ tiers }: { tiers: Record<string, PricingTier> }) {
  const tierColors: Record<string, string> = {
    starter: "text-slate-400 border-slate-500/20 bg-slate-500/5",
    growth:  "text-gold border-gold/20 bg-gold/5",
    premium: "text-purple-400 border-purple-500/20 bg-purple-500/5",
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {Object.entries(tiers).map(([tier, data]) => (
        <div
          key={tier}
          className={`rounded-xl border p-3 space-y-1.5 ${tierColors[tier] ?? "text-text-2 border-border bg-bg-3"}`}
        >
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 opacity-70" />
            <span className="text-xs font-semibold capitalize">{tier}</span>
          </div>
          {data.description && (
            <p className="text-xs opacity-80 leading-snug">{data.description}</p>
          )}
          {data.price_range && (
            <p className="text-xs font-mono font-semibold">{data.price_range}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Fallback: raw JSON pretty-print ───────────────────────────────────────────

function RawPlan({ data }: { data: unknown }) {
  return (
    <div className="rounded-xl border border-border bg-bg-3 p-4 overflow-x-auto">
      <pre className="text-xs text-text-2 whitespace-pre-wrap font-mono leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContentPlanTab({ lead }: ContentPlanTabProps) {
  const { templates, loading, error, regenerate } = useTabContent(lead.id, "content_plan");
  const template = templates[0] ?? null;

  if (loading) return <LoadingState label="Generating 90-day content plan" />;
  if (error)   return <ErrorState error={error} onRetry={regenerate} />;
  if (!template) return null;

  const plan = template.structured_data as Record<string, unknown> | null;

  const copyPlan = () => {
    navigator.clipboard.writeText(template.body);
    toast("Content plan copied to clipboard", "success");
  };

  // Detect structured month keys
  const monthKeys = plan
    ? Object.keys(plan).filter((k) => /month/.test(k))
    : [];
  const pricingData = plan?.pricing_tiers as Record<string, PricingTier> | undefined
    ?? plan?.pricing as Record<string, PricingTier> | undefined;
  const platformStrategy = plan?.platform_strategy as string | undefined;
  const monthsArray = plan?.months as MonthData[] | undefined;

  const hasStructured =
    plan && (monthKeys.length > 0 || (monthsArray && monthsArray.length > 0));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-3">
          90-day plan · {template.model_used ?? "AI"} · {template.tokens_used ?? 0} tokens
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copyPlan}>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={regenerate}>
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </Button>
        </div>
      </div>

      {hasStructured ? (
        <div className="space-y-5">
          {/* Months as array */}
          {monthsArray && monthsArray.length > 0 && (
            <div className="space-y-3">
              {monthsArray.map((m, i) => (
                <MonthCard key={i} month={`Month ${i + 1}`} data={m} />
              ))}
            </div>
          )}

          {/* Months as keys (month_1, month_2, etc.) */}
          {monthKeys.length > 0 && (
            <div className="space-y-3">
              {monthKeys.map((key) => (
                <MonthCard key={key} month={key} data={plan![key] as MonthData} />
              ))}
            </div>
          )}

          {platformStrategy && (
            <div>
              <h4 className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-2">
                Platform Strategy
              </h4>
              <p className="text-sm text-text-2 leading-relaxed">{platformStrategy}</p>
            </div>
          )}

          {pricingData && Object.keys(pricingData).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-2.5">
                Proposed Pricing Tiers
              </h4>
              <PricingSection tiers={pricingData} />
            </div>
          )}
        </div>
      ) : (
        <RawPlan data={plan ?? template.body} />
      )}
    </div>
  );
}
