import { NextRequest, NextResponse } from "next/server";
import { loadCampaign } from "@/lib/campaigns/context";
import { countRecipients, syncRecipientCounts } from "@/lib/campaigns/recipients";
import { loadSuppressions, screen } from "@/lib/campaigns/eligibility";
import { computeAllowance, startOfLocalDay } from "@/lib/campaigns/schedule";
import type { ApiError, Campaign, CampaignStatus, Lead } from "@/lib/utils/types";

// How many recipients are dry-run rendered before starting, to estimate how
// many the templates will fail on. A sample rather than the whole list: a
// campaign start should not take longer the bigger the campaign is.
const PREFLIGHT_SAMPLE = 200;

// Editable in a draft. Once a campaign has started, changing the message
// mid-flight would mean half the list got a different email from the other
// half, so these are locked and only pacing stays adjustable.
const CONTENT_FIELDS = [
  "name", "subject_template", "body_template", "from_name", "from_email",
  "allow_guessed_emails", "include_unsubscribe", "sending_identity_id",
] as const;

const PACING_FIELDS = [
  "daily_limit", "throttle_seconds", "send_window_start", "send_window_end", "timezone",
] as const;

type Action = "start" | "pause" | "resume" | "cancel";

// Which statuses each action may be applied from.
const ALLOWED_FROM: Record<Action, CampaignStatus[]> = {
  start:  ["draft", "scheduled"],
  pause:  ["sending", "scheduled"],
  resume: ["paused"],
  cancel: ["draft", "scheduled", "sending", "paused"],
};

const RESULTING_STATUS: Record<Action, CampaignStatus> = {
  start:  "sending",
  pause:  "paused",
  resume: "sending",
  cancel: "cancelled",
};

// ── GET /api/campaigns/[id] ───────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await loadCampaign(params.id);
  if (!result.ok) return result.response;

  const { supabase, campaign } = result.context;

  const counts = await countRecipients(supabase, campaign.id);

  // Why the campaign is or is not sending right now, so the detail page can say
  // "waiting until 08:00" instead of showing a stalled progress bar.
  const now = new Date();
  const { count: sentToday } = await supabase
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .eq("status", "sent")
    .gte("sent_at", startOfLocalDay(now, campaign.timezone).toISOString());

  const { data: lastSent } = await supabase
    .from("campaign_recipients")
    .select("sent_at")
    .eq("campaign_id", campaign.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const allowance = computeAllowance({
    now,
    settings: campaign,
    dailyLimit: campaign.daily_limit,
    sentToday: sentToday ?? 0,
    throttleSeconds: campaign.throttle_seconds,
    lastSentAt: lastSent?.sent_at ? new Date(lastSent.sent_at) : null,
    pendingCount: counts.pending,
  });

  return NextResponse.json({
    campaign,
    counts,
    sent_today: sentToday ?? 0,
    pacing: {
      allowed:   allowance.allowed,
      reason:    allowance.reason ?? null,
      resume_at: allowance.resumeAt?.toISOString() ?? null,
    },
  });
}

// ── PATCH /api/campaigns/[id] ─────────────────────────────────────────────────
// Body: { action?: "start"|"pause"|"resume"|"cancel", ...editable fields }

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await loadCampaign(params.id);
  if (!result.ok) return result.response;

  const { supabase, campaign } = result.context;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const action = body.action as Action | undefined;

  if (action && !ALLOWED_FROM[action]) {
    return NextResponse.json<ApiError>(
      { error: "Unknown action: " + action, code: "bad_request" },
      { status: 400 }
    );
  }

  // ── Field edits ─────────────────────────────────────────────────────────────

  const updates: Record<string, unknown> = {};
  const isDraft = campaign.status === "draft" || campaign.status === "scheduled";

  for (const field of PACING_FIELDS) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  for (const field of CONTENT_FIELDS) {
    if (body[field] === undefined) continue;
    if (!isDraft) {
      return NextResponse.json<ApiError>(
        {
          error: `"${field}" cannot change once a campaign has started. Cancel it and create a new one.`,
          code: "campaign_locked",
        },
        { status: 409 }
      );
    }
    updates[field] = body[field];
  }

  // Choosing a mailbox sets the campaign's visible from-address to match it.
  // They would otherwise disagree on screen, and the preflight check reads
  // from_email rather than resolving the transport.
  if (updates.sending_identity_id) {
    // RLS scopes this table to the workspace, so a row coming back is also the
    // ownership check.
    const { data: identity } = await supabase
      .from("sending_identities")
      .select("from_email, from_name")
      .eq("id", updates.sending_identity_id as string)
      .maybeSingle();

    if (!identity) {
      return NextResponse.json<ApiError>(
        { error: "That sending identity does not exist", code: "not_found" },
        { status: 404 }
      );
    }

    updates.from_email = identity.from_email;
    if (identity.from_name) updates.from_name = identity.from_name;
  }

  // ── Status transition ───────────────────────────────────────────────────────

  let preflight: PreflightReport | null = null;

  if (action) {
    if (!ALLOWED_FROM[action].includes(campaign.status)) {
      return NextResponse.json<ApiError>(
        {
          error: `Cannot ${action} a campaign that is ${campaign.status}`,
          code: "bad_transition",
        },
        { status: 409 }
      );
    }

    if (action === "start" || action === "resume") {
      const merged = { ...campaign, ...updates } as Campaign;
      const check = await preflightCheck(supabase, merged);

      if (check.error) {
        return NextResponse.json<ApiError>(
          { error: check.error, code: "not_ready" },
          { status: 400 }
        );
      }
      preflight = check.report ?? null;

      if (action === "start") updates.started_at = new Date().toISOString();
    }

    if (action === "cancel") {
      updates.completed_at = new Date().toISOString();

      // Pending recipients are retired rather than deleted, so the campaign
      // still shows who was on the list and what happened to them.
      await supabase
        .from("campaign_recipients")
        .update({ status: "skipped", skip_reason: "campaign_cancelled" })
        .eq("campaign_id", campaign.id)
        .in("status", ["pending", "sending"]);
    }

    updates.status = RESULTING_STATUS[action];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ campaign, preflight: null });
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("id", campaign.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  if (action === "cancel") await syncRecipientCounts(supabase, campaign.id);

  return NextResponse.json({ campaign: updated as Campaign, preflight });
}

// ── DELETE /api/campaigns/[id] ────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await loadCampaign(params.id);
  if (!result.ok) return result.response;

  const { supabase, campaign } = result.context;

  // A sending campaign is deleted by cancelling it first, so a click cannot
  // silently abandon a half-delivered send.
  if (campaign.status === "sending") {
    return NextResponse.json<ApiError>(
      { error: "Pause or cancel the campaign before deleting it", code: "campaign_active" },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("campaigns").delete().eq("id", campaign.id);

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true });
}

// ── Preflight ─────────────────────────────────────────────────────────────────
// Refuses to start a campaign that cannot produce a valid email, and estimates
// how many recipients the templates will fail on before any of them are sent.

interface PreflightReport {
  sampled: number;
  would_send: number;
  would_skip: number;
  skip_reasons: Record<string, number>;
}

async function preflightCheck(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
  campaign: Campaign
): Promise<{ error?: string; report?: PreflightReport }> {
  const subject = campaign.subject_template?.trim();
  const bodyTemplate = campaign.body_template?.trim();

  if (!subject)      return { error: "Add a subject line before starting" };
  if (!bodyTemplate) return { error: "Add an email body before starting" };

  if (!campaign.from_email?.includes("@")) {
    return { error: "Set a valid sending address before starting" };
  }

  const { data: pending, count } = await supabase
    .from("campaign_recipients")
    .select("lead_id", { count: "exact" })
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .limit(PREFLIGHT_SAMPLE);

  if (!count) return { error: "Add recipients before starting" };

  const leadIds = ((pending ?? []) as { lead_id: string }[]).map((r) => r.lead_id);
  const { data: leads } = await supabase.from("leads").select("*").in("id", leadIds);

  const suppressed = await loadSuppressions(supabase, campaign.workspace_id);
  const options = { allowGuessed: campaign.allow_guessed_emails, suppressed };

  const skip_reasons: Record<string, number> = {};
  let would_send = 0;

  for (const lead of ((leads ?? []) as Lead[])) {
    const screened = screen(lead, subject, bodyTemplate, options);
    if (screened.ok) would_send++;
    else skip_reasons[screened.reason] = (skip_reasons[screened.reason] ?? 0) + 1;
  }

  const sampled = (leads as Lead[] | null)?.length ?? 0;

  if (sampled > 0 && would_send === 0) {
    return {
      error:
        "None of the sampled recipients can be mailed with these templates. Check the merge fields.",
    };
  }

  return {
    report: { sampled, would_send, would_skip: sampled - would_send, skip_reasons },
  };
}
