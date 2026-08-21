import type { SupabaseClient } from "@supabase/supabase-js";
import { syncRecipientCounts, type RecipientCounts } from "./recipients";
import { loadSuppressions, screen, type SkipReason } from "./eligibility";
import { computeAllowance, startOfLocalDay, type PauseReason } from "./schedule";
import { sendEmail, textToHtml } from "@/lib/api/resend";
import type { Campaign, CampaignRecipient, Lead, Workspace } from "@/lib/utils/types";

// The drain itself, independent of who asked for it.
//
// A campaign is emptied by repeated short runs rather than one long one.
// Serverless functions are killed after a minute and the default throttle is
// ninety seconds between messages, so no single invocation could pace a real
// list even if it were allowed to try. Each run sends what the pacing rules
// permit right now and reports when to come back; the campaign page polls it
// while it is open, and the cron drives the same code unattended.
//
// Nothing is held in memory between runs. The throttle is measured from
// sent_at in the database, so it holds across invocations, across a browser
// refresh, and across the two callers running at the same time.

// Hard cap per run regardless of the time budget, so a campaign with the
// throttle turned off cannot empty itself in one go and trip the provider's
// rate limit.
const MAX_PER_RUN = 25;

// A claim older than this belonged to a run that was killed mid-send.
const STUCK_CLAIM_MINUTES = 10;

// Resend's own limit is roughly two requests a second. A campaign with no
// throttle still respects this.
const MIN_GAP_MS = 600;

export interface DriveOptions {
  campaign: Campaign;
  workspace: Workspace;
  // Attributed on the pipeline activity. The signed-in user for a request, the
  // workspace owner for a cron run.
  actorId: string | null;
  // Base URL for unsubscribe links, taken from the incoming request.
  origin: string;
  // Wall-clock instant this run must finish by. The cron shares one deadline
  // across every campaign it drives.
  deadline: number;
}

export interface DriveResult {
  done: boolean;
  sent: number;
  skipped: number;
  failed: number;
  counts: RecipientCounts | null;
  status: string;
  reason: PauseReason | null;
  resumeAt: Date | null;
  // Set when the campaign could not be driven at all.
  error?: string;
}

export async function driveCampaign(
  supabase: SupabaseClient,
  options: DriveOptions
): Promise<DriveResult> {
  const { campaign, workspace, actorId, origin, deadline } = options;

  const idle = (over: Partial<DriveResult> = {}): DriveResult => ({
    done: false, sent: 0, skipped: 0, failed: 0, counts: null,
    status: campaign.status, reason: null, resumeAt: null, ...over,
  });

  if (campaign.status !== "sending") {
    return idle({ error: `Campaign is ${campaign.status}, not sending` });
  }

  if (!campaign.subject_template || !campaign.body_template || !campaign.from_email) {
    return idle({ error: "Campaign is missing its templates or sending address" });
  }

  // Rows left claimed by a killed run would otherwise sit in "sending" forever
  // and quietly shrink the list.
  await releaseStuckClaims(supabase, campaign.id);

  const now = new Date();
  const [sentToday, lastSentAt, pendingCount] = await Promise.all([
    countSentToday(supabase, campaign, now),
    findLastSentAt(supabase, campaign.id),
    countPending(supabase, campaign.id),
  ]);

  if (pendingCount === 0) {
    const counts = await syncRecipientCounts(supabase, campaign.id);
    await complete(supabase, campaign.id);
    return { ...idle(), done: true, counts, status: "completed" };
  }

  const allowance = computeAllowance({
    now,
    settings: campaign,
    dailyLimit: campaign.daily_limit,
    sentToday,
    throttleSeconds: campaign.throttle_seconds,
    lastSentAt,
    pendingCount,
  });

  if (allowance.allowed === 0) {
    return idle({
      reason: allowance.reason ?? null,
      resumeAt: allowance.resumeAt ?? null,
    });
  }

  // ── Drain ───────────────────────────────────────────────────────────────────

  const suppressed = await loadSuppressions(supabase, campaign.workspace_id);
  const screenOptions = { allowGuessed: campaign.allow_guessed_emails, suppressed };

  const unsubscribeBase = campaign.include_unsubscribe ? `${origin}/api/unsubscribe` : null;
  const gapMs = Math.max(campaign.throttle_seconds * 1000, MIN_GAP_MS);

  let sent = 0, skipped = 0, failed = 0;
  let budget = Math.min(allowance.allowed, MAX_PER_RUN);
  let lastSendAt = lastSentAt?.getTime() ?? 0;
  let pauseReason: PauseReason | null = null;
  let resumeAt: Date | null = null;

  while (budget > 0) {
    if (Date.now() > deadline) break;

    const recipient = await claimNext(supabase, campaign.id);
    if (!recipient) break;

    const { data: lead } = await supabase
      .from("leads").select("*").eq("id", recipient.lead_id).maybeSingle();

    if (!lead) {
      await markSkipped(supabase, recipient.id, "no_email");
      skipped++;
      continue;
    }

    // Screened again here, not just when the list was built: a suppression can
    // land mid-campaign, and this is the last point before the message leaves.
    const screened = screen(
      lead as Lead,
      campaign.subject_template,
      campaign.body_template,
      screenOptions
    );

    if (!screened.ok) {
      await markSkipped(supabase, recipient.id, screened.reason, screened.detail);
      skipped++;
      // A skip costs nothing to deliver, so it neither waits out the throttle
      // nor spends a slot in today's budget.
      continue;
    }

    // Honour the throttle across runs as well as within one.
    const waitMs = lastSendAt ? lastSendAt + gapMs - Date.now() : 0;
    if (waitMs > 0) {
      if (Date.now() + waitMs > deadline) {
        // Not enough time left in this run. Hand the claim back so the next one
        // picks it up rather than holding it for ten minutes.
        await releaseClaim(supabase, recipient.id);
        pauseReason = "throttled";
        resumeAt = new Date(lastSendAt + gapMs);
        break;
      }
      await delay(waitMs);
    }

    try {
      const { resend_id } = await sendEmail({
        to:        recipient.to_email,
        subject:   screened.message.subject,
        html:      buildHtml(screened.message.body, recipient.id, unsubscribeBase),
        fromName:  campaign.from_name ?? workspace.agency_name ?? "SgOps",
        fromEmail: campaign.from_email,
      });

      lastSendAt = Date.now();
      const sentAt = new Date().toISOString();

      // outreach_sends is the single record of everything this workspace has
      // mailed, so campaign sends land there too and inherit delivery webhooks.
      const { data: send } = await supabase
        .from("outreach_sends")
        .insert({
          workspace_id: campaign.workspace_id,
          lead_id:      recipient.lead_id,
          template_id:  null,
          to_email:     recipient.to_email,
          subject:      screened.message.subject,
          body:         screened.message.body,
          status:       "sent",
          resend_id,
          sent_at:      sentAt,
        })
        .select("id")
        .single();

      await supabase
        .from("campaign_recipients")
        .update({
          status:     "sent",
          subject:    screened.message.subject,
          body:       screened.message.body,
          send_id:    send?.id ?? null,
          sent_at:    sentAt,
          claimed_at: null,
        })
        .eq("id", recipient.id);

      // Best-effort pipeline bookkeeping. A failure here must not turn a
      // delivered email into a failed one.
      if ((lead as Lead).stage === "new") {
        await supabase
          .from("leads")
          .update({ stage: "contacted", last_contacted_at: sentAt })
          .eq("id", recipient.lead_id);
      }

      await supabase.from("pipeline_activities").insert({
        workspace_id: campaign.workspace_id,
        lead_id:      recipient.lead_id,
        type:         "email_sent",
        content:      `Campaign "${campaign.name}": ${screened.message.subject}`,
        created_by:   actorId,
      });

      sent++;
      budget--;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed";

      // Left pending while retries remain, so a transient provider error does
      // not permanently drop someone off the list.
      const exhausted = recipient.attempts >= 3;

      await supabase
        .from("campaign_recipients")
        .update({
          status:     exhausted ? "failed" : "pending",
          last_error: message,
          claimed_at: null,
        })
        .eq("id", recipient.id);

      if (exhausted) failed++;
      // A provider that just rejected a send is unlikely to accept the next one
      // immediately, so a failure still waits out the gap.
      lastSendAt = Date.now();
      budget--;
    }
  }

  // ── Wrap up ─────────────────────────────────────────────────────────────────

  const counts = await syncRecipientCounts(supabase, campaign.id);

  let status: string = campaign.status;
  if (counts.pending === 0 && counts.sending === 0) {
    status = "completed";
    await complete(supabase, campaign.id);
  }

  if (!pauseReason && status !== "completed") {
    const next = computeAllowance({
      now: new Date(),
      settings: campaign,
      dailyLimit: campaign.daily_limit,
      sentToday: sentToday + sent,
      throttleSeconds: campaign.throttle_seconds,
      lastSentAt: lastSendAt ? new Date(lastSendAt) : null,
      pendingCount: counts.pending,
    });
    pauseReason = next.reason ?? null;
    resumeAt = next.resumeAt ?? null;
  }

  return {
    done: status === "completed",
    sent, skipped, failed, counts, status,
    reason: pauseReason,
    resumeAt,
  };
}

// ── Recipient claiming ────────────────────────────────────────────────────────

// Claims one pending recipient by flipping its status under a status guard.
// Two runs racing on the same row means exactly one update matches, so the
// loser simply moves to the next candidate rather than double-sending.
async function claimNext(
  supabase: SupabaseClient,
  campaignId: string
): Promise<CampaignRecipient | null> {
  const nowIso = new Date().toISOString();

  const { data: candidates } = await supabase
    .from("campaign_recipients")
    .select("id, attempts")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(10);

  for (const candidate of ((candidates ?? []) as { id: string; attempts: number }[])) {
    const { data: claimed } = await supabase
      .from("campaign_recipients")
      .update({
        status:     "sending",
        claimed_at: nowIso,
        attempts:   candidate.attempts + 1,
      })
      .eq("id", candidate.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (claimed) return claimed as CampaignRecipient;
  }

  return null;
}

async function releaseClaim(supabase: SupabaseClient, recipientId: string) {
  await supabase
    .from("campaign_recipients")
    .update({ status: "pending", claimed_at: null })
    .eq("id", recipientId);
}

async function releaseStuckClaims(supabase: SupabaseClient, campaignId: string) {
  const cutoff = new Date(Date.now() - STUCK_CLAIM_MINUTES * 60_000).toISOString();

  await supabase
    .from("campaign_recipients")
    .update({ status: "pending", claimed_at: null })
    .eq("campaign_id", campaignId)
    .eq("status", "sending")
    .lt("claimed_at", cutoff);
}

async function markSkipped(
  supabase: SupabaseClient,
  recipientId: string,
  reason: SkipReason,
  detail?: string
) {
  await supabase
    .from("campaign_recipients")
    .update({
      status:      "skipped",
      skip_reason: detail ? `${reason}: ${detail}` : reason,
      claimed_at:  null,
    })
    .eq("id", recipientId);
}

async function complete(supabase: SupabaseClient, campaignId: string) {
  await supabase
    .from("campaigns")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", campaignId);
}

// ── Counting ──────────────────────────────────────────────────────────────────

async function countSentToday(
  supabase: SupabaseClient,
  campaign: Campaign,
  now: Date
): Promise<number> {
  const { count } = await supabase
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .eq("status", "sent")
    .gte("sent_at", startOfLocalDay(now, campaign.timezone).toISOString());

  return count ?? 0;
}

async function countPending(supabase: SupabaseClient, campaignId: string): Promise<number> {
  const { count } = await supabase
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  return count ?? 0;
}

async function findLastSentAt(
  supabase: SupabaseClient,
  campaignId: string
): Promise<Date | null> {
  const { data } = await supabase
    .from("campaign_recipients")
    .select("sent_at")
    .eq("campaign_id", campaignId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.sent_at ? new Date(data.sent_at) : null;
}

// ── Message assembly ──────────────────────────────────────────────────────────

function buildHtml(body: string, recipientId: string, unsubscribeBase: string | null): string {
  const html = textToHtml(body);
  if (!unsubscribeBase) return html;

  const link = `${unsubscribeBase}?r=${encodeURIComponent(recipientId)}`;

  return (
    html +
    `<div style="margin-top:2em;padding-top:1em;border-top:1px solid #e5e5e5;` +
    `font-family:system-ui,sans-serif;font-size:12px;color:#8a8a8a;">` +
    `<a href="${link}" style="color:#8a8a8a;">Unsubscribe</a>` +
    `</div>`
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
