import { NextRequest, NextResponse } from "next/server";
import { loadCampaign } from "@/lib/campaigns/context";
import { syncRecipientCounts } from "@/lib/campaigns/recipients";
import { loadSuppressions, screen, type SkipReason } from "@/lib/campaigns/eligibility";
import { computeAllowance, startOfLocalDay, type PauseReason } from "@/lib/campaigns/schedule";
import { sendEmail, textToHtml } from "@/lib/api/resend";
import type { ApiError, Campaign, CampaignRecipient, Lead } from "@/lib/utils/types";

export const maxDuration = 60;

// A campaign is drained by repeated calls to this route rather than one long
// run. Serverless functions are killed after a minute and the default throttle
// is ninety seconds between messages, so a single invocation could not pace a
// list of any size even if it were allowed to try. Each call sends what the
// pacing rules permit right now and reports when to call again; the campaign
// page polls it while a campaign is sending, and a cron can drive the same
// endpoint unattended.

// Wall-clock budget per invocation, well under the platform limit so that the
// bookkeeping after the last send always gets to run.
const RUN_BUDGET_MS = 20_000;

// Hard cap regardless of budget, so a campaign with no throttle cannot empty
// itself in one call and blow through the provider's rate limit.
const MAX_PER_INVOCATION = 25;

// A claim older than this belonged to an invocation that was killed mid-send.
const STUCK_CLAIM_MINUTES = 10;

// Resend's own limit is roughly two requests a second. A campaign with the
// throttle turned off still respects this.
const MIN_GAP_MS = 600;

interface SendOutcome {
  sent: number;
  skipped: number;
  failed: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await loadCampaign(params.id);
  if (!result.ok) return result.response;

  const { supabase, user, workspace, campaign } = result.context;
  const startedAt = Date.now();

  if (campaign.status !== "sending") {
    return NextResponse.json<ApiError>(
      { error: `Campaign is ${campaign.status}, not sending`, code: "not_sending" },
      { status: 409 }
    );
  }

  if (!campaign.subject_template || !campaign.body_template || !campaign.from_email) {
    return NextResponse.json<ApiError>(
      { error: "Campaign is missing its templates or sending address", code: "not_ready" },
      { status: 400 }
    );
  }

  // Rows left claimed by a killed invocation would otherwise sit in "sending"
  // forever and quietly shrink the list.
  await releaseStuckClaims(supabase, campaign.id);

  const now = new Date();
  const [sentToday, lastSentAt, pendingCount] = await Promise.all([
    countSentToday(supabase, campaign, now),
    findLastSentAt(supabase, campaign.id),
    countPending(supabase, campaign.id),
  ]);

  if (pendingCount === 0) {
    const counts = await syncRecipientCounts(supabase, campaign.id);
    await supabase
      .from("campaigns")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", campaign.id);

    return NextResponse.json({
      done: true, sent: 0, skipped: 0, failed: 0, counts,
      status: "completed", reason: null, resume_at: null,
    });
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
    return NextResponse.json({
      done: false, sent: 0, skipped: 0, failed: 0,
      counts: null,
      status: campaign.status,
      reason: allowance.reason ?? null,
      resume_at: allowance.resumeAt?.toISOString() ?? null,
    });
  }

  // ── Drain ───────────────────────────────────────────────────────────────────

  const suppressed = await loadSuppressions(supabase, campaign.workspace_id);
  const options = { allowGuessed: campaign.allow_guessed_emails, suppressed };

  const unsubscribeBase = campaign.include_unsubscribe
    ? `${req.nextUrl.origin}/api/unsubscribe`
    : null;

  const outcome: SendOutcome = { sent: 0, skipped: 0, failed: 0 };
  const gapMs = Math.max(campaign.throttle_seconds * 1000, MIN_GAP_MS);

  let budget = Math.min(allowance.allowed, MAX_PER_INVOCATION);
  let lastSendAt = lastSentAt?.getTime() ?? 0;
  let pauseReason: PauseReason | null = null;
  let resumeAt: Date | null = null;

  while (budget > 0) {
    if (Date.now() - startedAt > RUN_BUDGET_MS) break;

    const recipient = await claimNext(supabase, campaign.id);
    if (!recipient) break;

    const { data: lead } = await supabase
      .from("leads").select("*").eq("id", recipient.lead_id).maybeSingle();

    if (!lead) {
      await markSkipped(supabase, recipient.id, "no_email");
      outcome.skipped++;
      continue;
    }

    // Screened again here, not just when the list was built: a suppression can
    // land mid-campaign, and this is the last point before the message leaves.
    const screened = screen(
      lead as Lead,
      campaign.subject_template,
      campaign.body_template,
      options
    );

    if (!screened.ok) {
      await markSkipped(supabase, recipient.id, screened.reason, screened.detail);
      outcome.skipped++;
      // A skip costs nothing to deliver, so it neither waits out the throttle
      // nor spends a slot in today's budget.
      continue;
    }

    // Honour the throttle across invocations as well as within one.
    const waitMs = lastSendAt ? lastSendAt + gapMs - Date.now() : 0;
    if (waitMs > 0) {
      if (Date.now() + waitMs - startedAt > RUN_BUDGET_MS) {
        // Not enough time left in this invocation. Hand the claim back so the
        // next call picks it up rather than holding it for ten minutes.
        await releaseClaim(supabase, recipient.id);
        pauseReason = "throttled";
        resumeAt = new Date(lastSendAt + gapMs);
        break;
      }
      await delay(waitMs);
    }

    const html = buildHtml(screened.message.body, recipient.id, unsubscribeBase);

    try {
      const { resend_id } = await sendEmail({
        to:        recipient.to_email,
        subject:   screened.message.subject,
        html,
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
          status:   "sent",
          subject:  screened.message.subject,
          body:     screened.message.body,
          send_id:  send?.id ?? null,
          sent_at:  sentAt,
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
        created_by:   user.id,
      });

      outcome.sent++;
      budget--;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed";

      // Left pending when there are retries left, so a transient provider
      // error does not permanently drop someone off the list.
      const exhausted = recipient.attempts >= 3;

      await supabase
        .from("campaign_recipients")
        .update({
          status:     exhausted ? "failed" : "pending",
          last_error: message,
          claimed_at: null,
        })
        .eq("id", recipient.id);

      if (exhausted) outcome.failed++;
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
    await supabase
      .from("campaigns")
      .update({ status, completed_at: new Date().toISOString() })
      .eq("id", campaign.id);
  }

  if (!pauseReason && status !== "completed") {
    const next = computeAllowance({
      now: new Date(),
      settings: campaign,
      dailyLimit: campaign.daily_limit,
      sentToday: sentToday + outcome.sent,
      throttleSeconds: campaign.throttle_seconds,
      lastSentAt: lastSendAt ? new Date(lastSendAt) : null,
      pendingCount: counts.pending,
    });
    pauseReason = next.reason ?? null;
    resumeAt = next.resumeAt ?? null;
  }

  return NextResponse.json({
    done: status === "completed",
    ...outcome,
    counts,
    status,
    reason: pauseReason,
    resume_at: resumeAt?.toISOString() ?? null,
  });
}

// ── Recipient claiming ────────────────────────────────────────────────────────

// Claims one pending recipient by flipping its status under a status guard.
// Two invocations racing on the same row means exactly one update matches, so
// the loser simply moves to the next candidate rather than double-sending.
async function claimNext(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
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

async function releaseClaim(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
  recipientId: string
) {
  await supabase
    .from("campaign_recipients")
    .update({ status: "pending", claimed_at: null })
    .eq("id", recipientId);
}

async function releaseStuckClaims(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
  campaignId: string
) {
  const cutoff = new Date(Date.now() - STUCK_CLAIM_MINUTES * 60_000).toISOString();

  await supabase
    .from("campaign_recipients")
    .update({ status: "pending", claimed_at: null })
    .eq("campaign_id", campaignId)
    .eq("status", "sending")
    .lt("claimed_at", cutoff);
}

async function markSkipped(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
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

// ── Counting ──────────────────────────────────────────────────────────────────

async function countSentToday(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
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

async function countPending(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
  campaignId: string
): Promise<number> {
  const { count } = await supabase
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  return count ?? 0;
}

async function findLastSentAt(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
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
