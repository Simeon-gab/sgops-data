"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pause, Play, Send, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { TemplateEditor } from "@/components/campaigns/template-editor";
import { CampaignProgress } from "@/components/campaigns/campaign-progress";
import { RecipientTable } from "@/components/campaigns/recipient-table";
import { useCampaign, type PreflightReport } from "@/hooks/useCampaigns";
import { SKIP_REASON_LABELS, type SkipReason } from "@/lib/campaigns/eligibility";
import type { CampaignStatus, SendingIdentityPublic } from "@/lib/utils/types";

const STATUS_VARIANT: Record<CampaignStatus, "verified" | "partial" | "unverified" | "warm" | "default"> = {
  draft:     "default",
  scheduled: "partial",
  sending:   "warm",
  paused:    "unverified",
  completed: "verified",
  cancelled: "unverified",
};

export function CampaignDetail({ id }: { id: string }) {
  const { campaign, counts, pacing, sentToday, loading, error, working, sendError, patch } =
    useCampaign(id);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showPacing, setShowPacing] = useState(false);
  const [identities, setIdentities] = useState<SendingIdentityPublic[]>([]);
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);

  // Seeded once from the server copy. Re-seeding on every refetch would undo
  // whatever the user typed between polls.
  useEffect(() => {
    if (!campaign || dirty) return;
    setSubject(campaign.subject_template ?? "");
    setBody(campaign.body_template ?? "");
    setFromEmail(campaign.from_email ?? "");
    setFromName(campaign.from_name ?? "");
  }, [campaign, dirty]);

  // Which mailboxes this workspace can send from. Absent when none are set up,
  // in which case the from-address fields below are the whole story.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sending-identities");
        const data = await res.json();
        if (!cancelled && res.ok) setIdentities(data.identities ?? []);
      } catch {
        // The campaign is still editable without the picker.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-sm text-text-3">Loading campaign...</p>;

  if (error || !campaign) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-red-400">{error ?? "Campaign not found"}</p>
        <Link href="/campaigns" className="text-sm text-gold underline mt-2 inline-block">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const isDraft = campaign.status === "draft";
  const editable = isDraft || campaign.status === "paused";

  async function save() {
    try {
      await patch({
        subject_template: subject,
        body_template: body,
        from_email: fromEmail,
        from_name: fromName,
      });
      setDirty(false);
      toast("Saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "error");
    }
  }

  async function act(action: "start" | "pause" | "resume" | "cancel") {
    try {
      // Unsaved edits go up with the action, so starting a campaign never sends
      // the previously saved version of an email the user has since rewritten.
      const body_updates =
        dirty && isDraft
          ? { subject_template: subject, body_template: body, from_email: fromEmail, from_name: fromName }
          : {};

      const result = await patch({ action, ...body_updates });
      setDirty(false);
      setPreflight(result.preflight);

      const MESSAGES = {
        start:  "Campaign started",
        resume: "Campaign resumed",
        pause:  "Campaign paused",
        cancel: "Campaign cancelled",
      };
      toast(MESSAGES[action], "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : `Could not ${action} campaign`, "error");
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-text-3 hover:text-text-1 transition-colors mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Campaigns
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-text-1 truncate">{campaign.name}</h2>
            <Badge variant={STATUS_VARIANT[campaign.status]}>{campaign.status}</Badge>
          </div>
          <p className="text-text-3 text-sm mt-1">
            {campaign.total_recipients} recipients, one every{" "}
            {campaign.throttle_seconds < 60
              ? `${campaign.throttle_seconds}s`
              : `${Math.round(campaign.throttle_seconds / 60)}m`}
            , up to {campaign.daily_limit} a day
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isDraft && (
            <Button onClick={() => act("start")} loading={working}>
              <Send className="h-4 w-4" />
              Start
            </Button>
          )}
          {campaign.status === "sending" && (
            <Button variant="secondary" onClick={() => act("pause")} loading={working}>
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button onClick={() => act("resume")} loading={working}>
              <Play className="h-4 w-4" />
              Resume
            </Button>
          )}
          {campaign.status !== "completed" && campaign.status !== "cancelled" && (
            <Button variant="ghost" onClick={() => act("cancel")} title="Cancel campaign">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Progress ───────────────────────────────────────────────────────── */}
      {counts && counts.total > 0 && (
        <div className="mb-6">
          <CampaignProgress
            campaign={campaign}
            counts={counts}
            pacing={pacing}
            sentToday={sentToday}
          />
        </div>
      )}

      {sendError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">The mail server is rejecting messages.</p>
          <p className="text-xs text-red-400/80 mt-1 leading-relaxed">{sendError}</p>
          <p className="text-xs text-text-3 mt-2 leading-relaxed">
            Recipients stay queued and are retried. Pause the campaign and fix the sending
            identity in Settings if this keeps happening.
          </p>
        </div>
      )}

      {preflight && preflight.would_skip > 0 && (
        <div className="bg-bg-2 border border-border rounded-xl p-4 mb-6">
          <p className="text-sm text-text-2">
            Checked {preflight.sampled} recipients: {preflight.would_send} will be mailed,{" "}
            {preflight.would_skip} skipped.
          </p>
          <ul className="mt-2 space-y-0.5">
            {Object.entries(preflight.skip_reasons).map(([reason, count]) => (
              <li key={reason} className="text-xs text-text-3">
                {count} — {SKIP_REASON_LABELS[reason as SkipReason] ?? reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Message ────────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-1">Message</h3>
          {editable && dirty && (
            <Button size="sm" variant="secondary" onClick={save} loading={working}>
              Save
            </Button>
          )}
        </div>

        {!isDraft && (
          <p className="text-xs text-text-3 mb-3">
            The message is locked once a campaign starts, so everyone on the list receives the
            same email. Cancel and create a new campaign to change it.
          </p>
        )}

        {identities.length > 0 ? (
          <div className="mb-3">
            <Select
              label="Send from"
              value={campaign.sending_identity_id ?? ""}
              disabled={!isDraft}
              onChange={(e) => {
                const value = e.target.value;
                // Saved immediately rather than on the Save button: the server
                // copies the mailbox's address onto the campaign, so the fields
                // below have to come back from it rather than be guessed here.
                void patch(value ? { sending_identity_id: value } : { sending_identity_id: null })
                  .catch((err) =>
                    toast(err instanceof Error ? err.message : "Could not change mailbox", "error")
                  );
              }}
              options={[
                { value: "", label: "A one-off address for this campaign" },
                ...identities.map((identity) => ({
                  value: identity.id,
                  label: identity.from_name
                    ? `${identity.from_name} <${identity.from_email}>`
                    : identity.from_email,
                })),
              ]}
            />
            <p className="text-xs text-text-3 mt-1.5">
              Mailboxes come from Settings. Choosing one here overrides the address below.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input
            label="From name"
            value={fromName}
            disabled={!isDraft || Boolean(campaign.sending_identity_id)}
            onChange={(e) => { setFromName(e.target.value); setDirty(true); }}
          />
          <Input
            label="From address"
            value={fromEmail}
            disabled={!isDraft || Boolean(campaign.sending_identity_id)}
            placeholder="you@yourdomain.com"
            onChange={(e) => { setFromEmail(e.target.value); setDirty(true); }}
          />
        </div>

        <TemplateEditor
          subject={subject}
          body={body}
          disabled={!isDraft}
          onChange={(next) => {
            setSubject(next.subject);
            setBody(next.body);
            setDirty(true);
          }}
        />
      </section>

      {/* ── Pacing ─────────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <button
          onClick={() => setShowPacing((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-text-1 hover:text-gold transition-colors mb-3"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Pacing
        </button>

        {showPacing && (
          <PacingForm
            campaign={campaign}
            working={working}
            onSave={async (updates) => {
              try {
                await patch(updates);
                toast("Pacing updated", "success");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Could not update pacing", "error");
              }
            }}
          />
        )}
      </section>

      {/* ── Recipients ─────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-text-1 mb-3">Recipients</h3>
        <RecipientTable campaignId={campaign.id} counts={counts} />
      </section>
    </div>
  );
}

// Pacing stays editable while a campaign is running: slowing a send down or
// cutting the daily limit is exactly what someone does when deliverability
// starts looking wrong, and making them cancel to do it would be worse.
function PacingForm({
  campaign,
  working,
  onSave,
}: {
  campaign: { daily_limit: number; throttle_seconds: number; send_window_start: string | null; send_window_end: string | null; timezone: string };
  working: boolean;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
}) {
  const [dailyLimit, setDailyLimit] = useState(String(campaign.daily_limit));
  const [throttle, setThrottle] = useState(String(campaign.throttle_seconds));
  const [start, setStart] = useState((campaign.send_window_start ?? "08:00").slice(0, 5));
  const [end, setEnd] = useState((campaign.send_window_end ?? "18:00").slice(0, 5));

  return (
    <div className="bg-bg-2 border border-border rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Max per day"
          type="number"
          min={1}
          value={dailyLimit}
          onChange={(e) => setDailyLimit(e.target.value)}
        />
        <Input
          label="Seconds between sends"
          type="number"
          min={0}
          value={throttle}
          onChange={(e) => setThrottle(e.target.value)}
        />
        <Input
          label="Send from"
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <Input
          label="Send until"
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>

      <p className="text-xs text-text-3">
        Times are in {campaign.timezone}. A few dozen messages a day from a new domain looks
        like a person writing; a few hundred looks like a list.
      </p>

      <Button
        size="sm"
        variant="secondary"
        loading={working}
        onClick={() =>
          onSave({
            daily_limit: Number(dailyLimit) || campaign.daily_limit,
            throttle_seconds: Number(throttle),
            send_window_start: start,
            send_window_end: end,
          })
        }
      >
        Save pacing
      </Button>
    </div>
  );
}
