import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { applyLeadFilters } from "@/lib/supabase/lead-filters";
import { addRecipients } from "@/lib/campaigns/recipients";
import { resolveSenderProfile } from "@/lib/utils/sender-profile";
import type { ApiError, Campaign, Lead } from "@/lib/utils/types";

// Selecting a whole filtered view is the normal way to build a list, so this
// has to cope with more leads than PostgREST returns in one response.
const LEAD_PAGE = 1000;
const MAX_LEAD_PAGES = 20;

interface CreateBody {
  name?: string;
  subject_template?: string;
  body_template?: string;
  from_name?: string;
  from_email?: string;
  daily_limit?: number;
  throttle_seconds?: number;
  send_window_start?: string | null;
  send_window_end?: string | null;
  timezone?: string;
  allow_guessed_emails?: boolean;
  include_unsubscribe?: boolean;
  sending_identity_id?: string;
  // Recipient source. Explicit ids win when both are given.
  lead_ids?: string[];
  filters?: Record<string, string>;
}

// ── GET /api/campaigns ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) return NextResponse.json({ campaigns: [] });

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ campaigns: (data as Campaign[]) ?? [] });
}

// ── POST /api/campaigns ───────────────────────────────────────────────────────
// Creates a draft. Recipients can be seeded now or added later; either way the
// campaign does not send until it is explicitly started.

export async function POST(req: NextRequest) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json<ApiError>(
      { error: "Campaign name is required", code: "bad_request" },
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

  const profile = resolveSenderProfile(workspace);

  // Campaigns send from the workspace default mailbox unless told otherwise.
  // from_email is seeded alongside it so the campaign page and the preflight
  // check can show and validate an address without resolving the transport.
  const { data: defaultIdentity } = await supabase
    .from("sending_identities")
    .select("id, from_email, from_name")
    .eq("workspace_id", workspace.id)
    .eq("is_default", true)
    .maybeSingle();

  const { data: created, error: createError } = await supabase
    .from("campaigns")
    .insert({
      workspace_id:      workspace.id,
      name,
      status:            "draft",
      subject_template:  body.subject_template ?? null,
      body_template:     body.body_template ?? null,
      sending_identity_id: body.sending_identity_id ?? defaultIdentity?.id ?? null,
      from_name:         body.from_name
        ?? defaultIdentity?.from_name
        ?? (profile.sender_name || workspace.agency_name || null),
      from_email:        body.from_email
        ?? defaultIdentity?.from_email
        ?? workspace.agency_email
        ?? null,
      ...numeric("daily_limit", body.daily_limit),
      ...numeric("throttle_seconds", body.throttle_seconds),
      ...(body.send_window_start !== undefined ? { send_window_start: body.send_window_start } : {}),
      ...(body.send_window_end   !== undefined ? { send_window_end:   body.send_window_end   } : {}),
      ...(body.timezone ? { timezone: body.timezone } : {}),
      allow_guessed_emails: Boolean(body.allow_guessed_emails),
      include_unsubscribe:  body.include_unsubscribe !== false,
    })
    .select()
    .single();

  if (createError || !created) {
    return NextResponse.json<ApiError>(
      { error: createError?.message ?? "Could not create campaign", code: "db_error" },
      { status: 500 }
    );
  }

  const campaign = created as Campaign;

  // ── Optional recipient seeding ──────────────────────────────────────────────

  let recipients = null;
  const wantsRecipients = Boolean(body.lead_ids?.length) || Boolean(body.filters);

  if (wantsRecipients) {
    try {
      const leads = body.lead_ids?.length
        ? await leadsByIds(supabase, workspace.id, body.lead_ids)
        : await leadsByFilters(supabase, workspace.id, body.filters ?? {});

      recipients = await addRecipients(supabase, campaign, leads);
    } catch (err) {
      // The campaign exists and is a valid empty draft, so this is reported
      // rather than rolled back: the user can retry adding recipients.
      return NextResponse.json({
        campaign,
        recipients: null,
        recipients_error: err instanceof Error ? err.message : "Could not add recipients",
      });
    }
  }

  const { data: fresh } = await supabase
    .from("campaigns").select("*").eq("id", campaign.id).single();

  return NextResponse.json({ campaign: (fresh as Campaign) ?? campaign, recipients });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function numeric(field: string, value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? { [field]: Math.floor(value) }
    : {};
}

async function leadsByIds(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
  workspaceId: string,
  ids: string[]
): Promise<Lead[]> {
  const unique = Array.from(new Set(ids));
  const out: Lead[] = [];

  // Chunked: a few thousand ids in one `in` filter overflows the URL length.
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("id", unique.slice(i, i + 200));

    if (error) throw new Error(error.message);
    out.push(...((data as Lead[]) ?? []));
  }

  return out;
}

async function leadsByFilters(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
  workspaceId: string,
  filters: Record<string, string>
): Promise<Lead[]> {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => typeof v === "string" && v !== "")
  );

  const out: Lead[] = [];

  for (let page = 0; page < MAX_LEAD_PAGES; page++) {
    let query = supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId);

    query = applyLeadFilters(query, params);

    const offset = page * LEAD_PAGE;
    const { data, error } = await query
      .order("score", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + LEAD_PAGE - 1);

    if (error) throw new Error(error.message);

    const rows = (data as Lead[]) ?? [];
    out.push(...rows);
    if (rows.length < LEAD_PAGE) break;
  }

  return out;
}
