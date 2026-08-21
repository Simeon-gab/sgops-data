"use client";

import { Clock, Gauge, Moon } from "lucide-react";
import type { RecipientCounts } from "@/lib/campaigns/recipients";
import type { Pacing } from "@/hooks/useCampaigns";
import type { Campaign } from "@/lib/utils/types";

interface CampaignProgressProps {
  campaign: Campaign;
  counts: RecipientCounts;
  pacing: Pacing | null;
  sentToday: number;
}

// A campaign that is deliberately waiting looks identical to a campaign that
// is broken unless the page says which it is, so the reason for a pause is
// given as much room as the progress bar.

export function CampaignProgress({ campaign, counts, pacing, sentToday }: CampaignProgressProps) {
  const settled = counts.sent + counts.failed + counts.skipped;
  const percent = counts.total > 0 ? Math.round((settled / counts.total) * 100) : 0;

  const SEGMENTS = [
    { value: counts.sent,    className: "bg-green-500",  label: "Sent" },
    { value: counts.failed,  className: "bg-red-500",    label: "Failed" },
    { value: counts.skipped, className: "bg-slate-600",  label: "Skipped" },
  ].filter((s) => s.value > 0);

  return (
    <div className="bg-bg-2 border border-border rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-text-1">{counts.sent}</span>
          <span className="text-sm text-text-3">of {counts.total} sent</span>
        </div>
        <span className="text-sm text-text-3">{percent}%</span>
      </div>

      <div className="h-2 rounded-full bg-bg-3 overflow-hidden flex">
        {SEGMENTS.map((segment) => (
          <div
            key={segment.label}
            className={segment.className}
            style={{ width: `${(segment.value / Math.max(1, counts.total)) * 100}%` }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-text-3">
        <Stat label="Pending" value={counts.pending} />
        <Stat label="Sent"    value={counts.sent} />
        {counts.failed > 0  && <Stat label="Failed"  value={counts.failed} />}
        {counts.skipped > 0 && <Stat label="Skipped" value={counts.skipped} />}
        <Stat label="Today" value={`${sentToday} / ${campaign.daily_limit}`} />
      </div>

      {pacing?.reason && counts.pending > 0 && (
        <PauseNotice reason={pacing.reason} resumeAt={pacing.resume_at} campaign={campaign} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span>
      <span className="text-text-2 font-medium">{value}</span> {label}
    </span>
  );
}

function PauseNotice({
  reason,
  resumeAt,
  campaign,
}: {
  reason: NonNullable<Pacing["reason"]>;
  resumeAt: string | null;
  campaign: Campaign;
}) {
  const when = resumeAt ? formatResume(resumeAt, campaign.timezone) : null;

  const NOTICES = {
    throttled: {
      icon: Gauge,
      text: `Pacing at one message every ${formatSeconds(campaign.throttle_seconds)}.`,
    },
    daily_limit: {
      icon: Clock,
      text: `Today's limit of ${campaign.daily_limit} reached. Sending resumes tomorrow.`,
    },
    outside_window: {
      icon: Moon,
      text: `Outside the sending window (${(campaign.send_window_start ?? "").slice(0, 5)} to ${(campaign.send_window_end ?? "").slice(0, 5)} ${campaign.timezone}).`,
    },
  } as const;

  const notice = NOTICES[reason];
  const Icon = notice.icon;

  return (
    <div className="flex items-start gap-2 mt-4 pt-3 border-t border-border text-xs text-text-3">
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span className="leading-relaxed">
        {notice.text}
        {when && <> Next message around <span className="text-text-2">{when}</span>.</>}
      </span>
    </div>
  );
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "minute" : `${minutes} minutes`;
}

function formatResume(iso: string, timezone: string): string {
  const date = new Date(iso);
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
      hourCycle: "h23",
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}
