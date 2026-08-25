import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createServiceClient } from "@/lib/supabase/server";

// ── POST /api/webhooks ────────────────────────────────────────────────────────
// Handles Resend delivery webhooks.
// Configure in Resend dashboard: https://resend.com/webhooks
// Events: email.sent, email.delivered, email.opened, email.clicked,
//         email.bounced, email.delivery_delayed, email.complained
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
  "email.delivery_delayed": "sent",   // delayed — keep as sent, not failed
};

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
