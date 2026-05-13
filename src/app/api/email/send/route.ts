import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { sendEmail, textToHtml } from "@/lib/api/resend";
import type { Lead, OutreachSend, ApiError } from "@/lib/utils/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SingleSendBody {
  lead_id:     string;
  to_email:    string;
  subject:     string;
  body:        string;
  template_id?: string;
}

interface RequestBody {
  sends: SingleSendBody[];
}

// ── Rate-limit-safe queue processor ──────────────────────────────────────────
// Resend free tier: ~2 req/s. Process in chunks of 2 with 1.1s delay.

const CHUNK_SIZE = 2;
const CHUNK_DELAY_MS = 1_100;

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── POST /api/email/send ──────────────────────────────────────────────────────
// Body: { sends: [{ lead_id, to_email, subject, body, template_id? }] }
// Queues, sends, tracks in outreach_sends, auto-advances stage on first contact.

export async function POST(req: NextRequest) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: RequestBody;
  try {
    const raw = await req.json();
    // Support both single-send shorthand and batch format
    body = raw.sends
      ? (raw as RequestBody)
      : { sends: [raw as SingleSendBody] };
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  if (!body.sends?.length) {
    return NextResponse.json<ApiError>(
      { error: "No sends provided", code: "bad_request" },
      { status: 400 }
    );
  }

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) {
    return NextResponse.json<ApiError>(
      { error: "Could not initialize workspace", code: "workspace_error" },
      { status: 500 }
    );
  }

  const fromName  = workspace.agency_name  ?? "SgOps";
  const fromEmail = workspace.agency_email
    ?? process.env.RESEND_FROM_EMAIL
    ?? "onboarding@resend.dev";

  // ── 1. Insert all records as "queued" ──────────────────────────────────────

  const inserts = body.sends.map((s) => ({
    workspace_id: workspace.id,
    lead_id:      s.lead_id,
    template_id:  s.template_id ?? null,
    to_email:     s.to_email,
    subject:      s.subject,
    body:         s.body,
    status:       "queued" as const,
    resend_id:    null,
    sent_at:      null,
    opened_at:    null,
    clicked_at:   null,
  }));

  const { data: queued, error: insertError } = await supabase
    .from("outreach_sends")
    .insert(inserts)
    .select();

  if (insertError || !queued) {
    return NextResponse.json<ApiError>(
      { error: "Failed to queue emails", code: "queue_failed" },
      { status: 500 }
    );
  }

  const queuedSends = queued as OutreachSend[];

  // ── 2. Process queue in rate-limited chunks ────────────────────────────────

  const results: OutreachSend[] = [];
  let sentCount   = 0;
  let failedCount = 0;

  for (let i = 0; i < queuedSends.length; i += CHUNK_SIZE) {
    const chunk = queuedSends.slice(i, i + CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (record) => {
        try {
          const { resend_id } = await sendEmail({
            to:        record.to_email,
            subject:   record.subject,
            html:      textToHtml(record.body),
            fromName,
            fromEmail,
          });

          const now = new Date().toISOString();

          // Update send record to "sent"
          const { data: updated } = await supabase
            .from("outreach_sends")
            .update({ status: "sent", resend_id, sent_at: now })
            .eq("id", record.id)
            .select()
            .single();

          if (updated) results.push(updated as OutreachSend);

          // Auto-advance stage and log activity (best-effort)
          const { data: lead } = await supabase
            .from("leads")
            .select("stage")
            .eq("id", record.lead_id)
            .single();

          if (lead && lead.stage === "new") {
            await supabase
              .from("leads")
              .update({ stage: "contacted", last_contacted_at: now })
              .eq("id", record.lead_id);
          }

          await supabase.from("pipeline_activities").insert({
            workspace_id: workspace.id,
            lead_id:      record.lead_id,
            type:         "email_sent",
            content:      `Email sent: "${record.subject}"`,
            created_by:   user.id,
          });

          sentCount++;
        } catch {
          // Mark as failed
          await supabase
            .from("outreach_sends")
            .update({ status: "failed" })
            .eq("id", record.id);
          failedCount++;
        }
      })
    );

    // Rate-limit delay between chunks (skip after the last chunk)
    if (i + CHUNK_SIZE < queuedSends.length) {
      await delay(CHUNK_DELAY_MS);
    }
  }

  return NextResponse.json({
    sends:  results,
    sent:   sentCount,
    failed: failedCount,
    total:  queuedSends.length,
  });
}
