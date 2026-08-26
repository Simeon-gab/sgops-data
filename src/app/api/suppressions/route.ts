import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import type { ApiError, Suppression, SuppressionReason } from "@/lib/utils/types";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const REASONS: SuppressionReason[] = [
  "unsubscribed", "bounced", "complained", "invalid", "manual",
];

// ── GET /api/suppressions ─────────────────────────────────────────────────────
// The workspace's own suppressions plus the global ones, which apply to every
// workspace because a hard bounce damages reputation nobody owns alone.

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) return NextResponse.json({ suppressions: [], total: 0 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT)
  );
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "", 10) || 0);
  const search = searchParams.get("q")?.trim();

  let query = supabase
    .from("suppressions")
    .select("*", { count: "exact" })
    .or(`workspace_id.eq.${workspace.id},workspace_id.is.null`);

  if (search) query = query.ilike("email", `%${search}%`);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  const rows = (data as Suppression[]) ?? [];
  const total = count ?? rows.length;

  return NextResponse.json({
    suppressions: rows,
    total,
    limit,
    offset,
    has_more: offset + rows.length < total,
  });
}

// ── POST /api/suppressions ────────────────────────────────────────────────────
// Body: { emails: string[], reason?: SuppressionReason, source?: string }

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: { emails?: string[]; email?: string; reason?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const raw = body.emails ?? (body.email ? [body.email] : []);
  const emails = Array.from(
    new Set(
      raw
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => e.includes("@"))
    )
  );

  if (emails.length === 0) {
    return NextResponse.json<ApiError>(
      { error: "Provide at least one email address", code: "bad_request" },
      { status: 400 }
    );
  }

  const reason = REASONS.includes(body.reason as SuppressionReason)
    ? (body.reason as SuppressionReason)
    : "manual";

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) {
    return NextResponse.json<ApiError>(
      { error: "Could not initialize workspace", code: "workspace_error" },
      { status: 500 }
    );
  }

  // The uniqueness rule is an expression index over COALESCE(workspace_id, ...)
  // so that a global row and a workspace row can coexist for one address.
  // ON CONFLICT cannot name an expression index, so already-suppressed
  // addresses are filtered out here and a losing race is swallowed below.
  const { data: existing } = await supabase
    .from("suppressions")
    .select("email")
    .eq("workspace_id", workspace.id)
    .in("email", emails);

  const known = new Set(
    ((existing ?? []) as { email: string }[]).map((r) => r.email.toLowerCase())
  );
  const fresh = emails.filter((email) => !known.has(email));

  let data: { id: string }[] = [];

  if (fresh.length > 0) {
    const insert = await supabase
      .from("suppressions")
      .insert(
        fresh.map((email) => ({
          workspace_id: workspace.id,
          email,
          reason,
          source: body.source ?? "manual",
        }))
      )
      .select("id");

    // 23505 means a concurrent request suppressed the same address first,
    // which is the outcome this call wanted anyway.
    if (insert.error && insert.error.code !== "23505") {
      return NextResponse.json<ApiError>(
        { error: insert.error.message, code: "db_error" },
        { status: 500 }
      );
    }

    data = (insert.data as { id: string }[]) ?? [];
  }

  // Anyone already queued in a live campaign is pulled out now, rather than
  // being mailed because their campaign was built before this call.
  await supabase
    .from("campaign_recipients")
    .update({ status: "skipped", skip_reason: "suppressed" })
    .eq("workspace_id", workspace.id)
    .eq("status", "pending")
    .in("to_email", emails);

  return NextResponse.json({
    added: data?.length ?? 0,
    submitted: emails.length,
  });
}

// ── DELETE /api/suppressions ──────────────────────────────────────────────────
// Body: { email: string }
// Only the workspace's own rows. Global suppressions come from hard bounces and
// complaints and are not the workspace's to lift.

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json<ApiError>(
      { error: "Provide an email address", code: "bad_request" },
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

  const { data, error } = await supabase
    .from("suppressions")
    .delete()
    .eq("workspace_id", workspace.id)
    .ilike("email", email)
    .select("id");

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ removed: data?.length ?? 0 });
}
