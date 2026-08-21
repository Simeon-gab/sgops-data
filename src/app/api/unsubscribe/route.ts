import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ── GET /api/unsubscribe?r=<recipient_id> ─────────────────────────────────────
//
// The opt-out link at the bottom of every campaign email. Reached by someone
// who is not logged in and never will be, so it runs on the service client and
// identifies the request by the recipient row's own id, which is a v4 UUID and
// unguessable in the only way that matters here.
//
// One click is the whole interaction. Asking for a confirmation step turns an
// unsubscribe into a spam complaint, which costs far more.

export async function GET(req: NextRequest) {
  const recipientId = req.nextUrl.searchParams.get("r")?.trim();

  if (!recipientId || !isUuid(recipientId)) {
    return html("This unsubscribe link is not valid.", 400);
  }

  const supabase = createServiceClient();

  const { data: recipient } = await supabase
    .from("campaign_recipients")
    .select("id, workspace_id, to_email")
    .eq("id", recipientId)
    .maybeSingle();

  if (!recipient) {
    return html("This unsubscribe link is not valid.", 404);
  }

  const email = String(recipient.to_email).trim().toLowerCase();

  const { data: existing } = await supabase
    .from("suppressions")
    .select("id")
    .eq("workspace_id", recipient.workspace_id)
    .eq("email", email)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("suppressions").insert({
      workspace_id: recipient.workspace_id,
      email,
      reason: "unsubscribed",
      source: "unsubscribe_link",
    });

    // A double-click on the link races itself. Both requests wanted the address
    // suppressed, so a duplicate is success, not an error.
    if (error && error.code !== "23505") {
      return html("Something went wrong. Please reply to the email instead.", 500);
    }
  }

  // Pull them out of anything still queued across the workspace, not just this
  // campaign. Someone who opts out of one list has opted out of the sender.
  await supabase
    .from("campaign_recipients")
    .update({ status: "skipped", skip_reason: "suppressed" })
    .eq("workspace_id", recipient.workspace_id)
    .eq("status", "pending")
    .eq("to_email", email);

  return html(
    `<strong>${escapeHtml(email)}</strong> has been unsubscribed. You will not receive further emails from this sender.`,
    200
  );
}

// Resend and other providers fetch links to check them for malware, and a
// prefetching client would otherwise opt someone out without them clicking.
// POST is the honest verb for the action; the GET above is kept because real
// mail clients still need a plain link to work.
export async function POST(req: NextRequest) {
  return GET(req);
}

function html(message: string, status: number): NextResponse {
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsubscribe</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f0f10;font-family:system-ui,sans-serif;">
<div style="max-width:32rem;padding:2.5rem;text-align:center;color:#e8e8ea;">
<p style="font-size:1rem;line-height:1.6;margin:0;">${message}</p>
</div>
</body>
</html>`;

  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
