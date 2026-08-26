import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createServiceClient } from "@/lib/supabase/server";
import { syncRecipientCounts } from "@/lib/campaigns/recipients";

// ── POST /api/webhooks ────────────────────────────────────────────────────────
// Handles Resend delivery webhooks.
// Configure in Resend dashboard: https://resend.com/webhooks
// Events: email.sent, email.delivered, email.opened, email.clicked,
//         email.bounced, email.complained, email.failed, email.delivery_delayed
//
// Every request is signature-verified with the Svix scheme Resend uses. This
// endpoint is public by necessity and it writes to the suppression list, so an
// unverified caller could suppress a workspace's contacts or falsify delivery
// status.

interface ResendEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    created_at?: string;
    [key: string]: unknown;
  };
}

// Map Resend event types to our status column values
const EVENT_STATUS_MAP: Record<string, string> = {
  "email.sent":             "sent",
  "email.delivered":        "delivered",
  "email.opened":           "opened",
  "email.clicked":          "clicked",
  "email.bounced":          "bounced",
  "email.complained":       "bounced",
  "email.failed":           "failed",
  "email.delivery_delayed": "sent",   // delayed — keep as sent, not failed
};

// Events meaning the message never reached anyone, so the campaign recipient
// that was optimistically marked sent has to be corrected.
//
// A complaint is not among them: that message did arrive, and the person who
// received it pressed the spam button. It suppresses the address without
// rewriting the fact of delivery.
const DELIVERY_FAILED_EVENTS = new Set(["email.bounced", "email.failed"]);

// Timestamp fields to update alongside status
const EVENT_TIMESTAMP_MAP: Record<string, string | null> = {
  "email.sent":      "sent_at",
  "email.delivered": null,
  "email.opened":    "opened_at",
  "email.clicked":   "clicked_at",
};

// Events that mean the address must never be mailed again. Continuing to send
// after a hard bounce or a complaint is what gets a sending domain blacklisted,
// and the damage is not confined to the workspace that caused it.
// Deliberately not including email.failed. A bounce and a complaint are the
// address telling us something about itself. A failure often is not: a rejected
// sender domain, a provider outage or a malformed message all surface here, and
// none of them are the recipient's fault. Suppressing on it would quietly
// blacklist good leads for a problem at our end, and a suppression is meant to
// be permanent.
const SUPPRESSION_REASONS: Record<string, string> = {
  "email.bounced":    "bounced",
  "email.complained": "complained",
};

// Status priority (never downgrade)
const STATUS_PRIORITY: Record<string, number> = {
  queued:    0,
  sent:      1,
  delivered: 2,
  opened:    3,
  clicked:   4,
  bounced:   5,
  failed:    5,
};

// ── GET /api/webhooks ─────────────────────────────────────────────────────────
//
// Says the endpoint is alive and does nothing else. Delivery events arrive by
// POST, so a webhook receiver has no reason to answer a GET, and a bare 405 is
// the technically correct reply. It is also indistinguishable from a broken
// deployment when someone opens the URL to check their work, and some
// providers probe an endpoint before accepting it.
//
// Reads nothing, writes nothing, and reveals nothing beyond the fact that a
// route is mounted here, which the 405 already gave away.

export async function GET() {
  return NextResponse.json({
    endpoint: "resend-webhooks",
    status: "ready",
    expects: "POST, signed with the Svix scheme",
    configured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  // Fail closed, the same way the cron endpoint does. This route writes to the
  // suppression list, so an unverified caller who knows or guesses a resend_id
  // could suppress a workspace's contacts or mark real sends as bounced.
  // Delivery tracking silently not working is the lesser problem.
  if (!secret) {
    return NextResponse.json(
      { error: "RESEND_WEBHOOK_SECRET is not configured", code: "webhooks_disabled" },
      { status: 503 }
    );
  }

  // The signature covers the exact bytes that were sent, so the body has to be
  // read as text and parsed afterwards. Calling req.json() first would leave
  // nothing to verify against.
  const raw = await req.text();

  try {
    new Webhook(secret).verify(raw, {
      "svix-id":        req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    });
  } catch {
    // Also catches a replayed delivery: svix rejects timestamps outside its
    // tolerance window.
    return NextResponse.json(
      { error: "Invalid signature", code: "bad_signature" },
      { status: 401 }
    );
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const newStatus = EVENT_STATUS_MAP[event.type];
  if (!newStatus) {
    // Unknown event type — acknowledge and ignore
    return NextResponse.json({ received: true });
  }

  const resendId = event.data?.email_id;
  if (!resendId) {
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("outreach_sends")
    .select("id, status, workspace_id, to_email")
    .eq("resend_id", resendId)
    .maybeSingle();

  if (!existing) {
    // Record not found (could be from a different deployment or test) — still 200
    return NextResponse.json({ received: true });
  }

  // A bounce or a complaint is the address telling us never to write again.
  // Recorded before the status bookkeeping, and independently of it, because a
  // status that was already at its ceiling would otherwise return early below
  // and leave the address mailable.
  const suppressionReason = SUPPRESSION_REASONS[event.type];
  if (suppressionReason && existing.to_email) {
    await suppress(supabase, existing.workspace_id, existing.to_email, suppressionReason, event.type);
  }

  // The worker marks a campaign recipient sent the moment the provider accepts
  // the message, which is the only thing it can know at that point. A bounce or
  // a failure arrives later and says otherwise, so the campaign is corrected
  // here rather than showing a delivery that never happened.
  if (DELIVERY_FAILED_EVENTS.has(event.type)) {
    await markRecipientFailed(supabase, existing.id, event.type);
  }

  // Only upgrade status, never downgrade
  const currentPriority = STATUS_PRIORITY[existing.status] ?? 0;
  const newPriority      = STATUS_PRIORITY[newStatus] ?? 0;

  if (newPriority <= currentPriority && existing.status !== "sent") {
    return NextResponse.json({ received: true, skipped: "no upgrade" });
  }

  const updates: Record<string, unknown> = { status: newStatus };
  const tsField = EVENT_TIMESTAMP_MAP[event.type];
  if (tsField) updates[tsField] = event.created_at ?? new Date().toISOString();

  await supabase
    .from("outreach_sends")
    .update(updates)
    .eq("id", existing.id);

  return NextResponse.json({ received: true, status: newStatus });
}

// ── Campaign correction ───────────────────────────────────────────────────────

async function markRecipientFailed(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
  sendId: string,
  eventType: string
): Promise<void> {
  // Guarded on "sent" so this only ever corrects a row this send created, and
  // cannot overwrite one that was skipped, cancelled or is queued for a retry.
  const { data } = await supabase
    .from("campaign_recipients")
    .update({ status: "failed", last_error: eventType })
    .eq("send_id", sendId)
    .eq("status", "sent")
    .select("campaign_id")
    .maybeSingle();

  const campaignId = (data as { campaign_id?: string } | null)?.campaign_id;
  if (!campaignId) return;

  // The campaign's own counters are derived from its recipient rows, and a
  // finished campaign is never driven again, so without this the totals would
  // keep claiming a delivery that has just been disproved.
  await syncRecipientCounts(supabase, campaignId);
}

// ── Suppression ───────────────────────────────────────────────────────────────

async function suppress(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
  workspaceId: string,
  toEmail: string,
  reason: string,
  source: string
): Promise<void> {
  const email = String(toEmail).trim().toLowerCase();
  if (!email.includes("@")) return;

  const { data: existing } = await supabase
    .from("suppressions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", email)
    .maybeSingle();

  if (!existing) {
    // 23505 means a concurrent webhook delivery got there first, which is the
    // outcome this wanted. Resend retries events, so that is the normal case.
    const { error } = await supabase.from("suppressions").insert({
      workspace_id: workspaceId,
      email,
      reason,
      source,
    });
    if (error && error.code !== "23505") return;
  }

  // Anyone queued behind this address in a live campaign comes off the list now
  // rather than at their turn.
  await supabase
    .from("campaign_recipients")
    .update({ status: "skipped", skip_reason: "suppressed" })
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .eq("to_email", email);
}
