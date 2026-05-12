import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ── POST /api/webhooks ────────────────────────────────────────────────────────
// Handles Resend delivery webhooks.
// Configure in Resend dashboard: https://resend.com/webhooks
// Events: email.sent, email.delivered, email.opened, email.clicked,
//         email.bounced, email.delivery_delayed, email.complained
//
// NOTE: For production, add Svix signature verification:
//   npm install svix
//   import { Webhook } from "svix";
//   const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!);
//   wh.verify(rawBody, headers);

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
  let event: ResendEvent;
  try {
    event = await req.json();
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
    .select("id, status")
    .eq("resend_id", resendId)
    .maybeSingle();

  if (!existing) {
    // Record not found (could be from a different deployment or test) — still 200
    return NextResponse.json({ received: true });
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
