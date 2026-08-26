import { NextRequest, NextResponse } from "next/server";
import { loadCampaign } from "@/lib/campaigns/context";
import { addRecipients, syncRecipientCounts } from "@/lib/campaigns/recipients";
import { applyLeadFilters } from "@/lib/supabase/lead-filters";
import type { ApiError, CampaignRecipient, Lead, RecipientStatus } from "@/lib/utils/types";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const LEAD_PAGE = 1000;
const MAX_LEAD_PAGES = 20;

interface AddBody {
  lead_ids?: string[];
  filters?: Record<string, string>;
}

// ── GET /api/campaigns/[id]/recipients ────────────────────────────────────────
// Paginated, optionally filtered by status. Joined to the lead so the table can
// show who each address belongs to without a second round trip per row.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await loadCampaign(id);
  if (!result.ok) return result.response;

  const { supabase, campaign } = result.context;
  const { searchParams } = new URL(req.url);

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT)
  );
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "", 10) || 0);
  const status = searchParams.get("status")?.trim() as RecipientStatus | undefined;

  let query = supabase
    .from("campaign_recipients")
    .select("*, lead:leads(id, name, city, state, niche_label, tier, score)", { count: "exact" })
    .eq("campaign_id", campaign.id);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  const rows = (data as CampaignRecipient[]) ?? [];
  const total = count ?? rows.length;

  return NextResponse.json({
    recipients: rows,
    total,
    limit,
    offset,
    has_more: offset + rows.length < total,
  });
}

// ── POST /api/campaigns/[id]/recipients ───────────────────────────────────────
// Body: { lead_ids: string[] } or { filters: {...} }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await loadCampaign(id);
  if (!result.ok) return result.response;

  const { supabase, workspace, campaign } = result.context;

  // Adding to a list that is already going out would mail people under a
  // campaign they were never previewed against.
  if (campaign.status !== "draft" && campaign.status !== "paused") {
    return NextResponse.json<ApiError>(
      {
        error: `Recipients can only be added while a campaign is draft or paused, not ${campaign.status}`,
        code: "campaign_locked",
      },
      { status: 409 }
    );
  }

  let body: AddBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  if (!body.lead_ids?.length && !body.filters) {
    return NextResponse.json<ApiError>(
      { error: "Provide lead_ids or filters", code: "bad_request" },
      { status: 400 }
    );
  }

  try {
    const leads = body.lead_ids?.length
      ? await leadsByIds(supabase, workspace.id, body.lead_ids)
      : await leadsByFilters(supabase, workspace.id, body.filters ?? {});

    const added = await addRecipients(supabase, campaign, leads);
    return NextResponse.json({ ...added, selected: leads.length });
  } catch (err) {
    return NextResponse.json<ApiError>(
      { error: err instanceof Error ? err.message : "Could not add recipients", code: "db_error" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/campaigns/[id]/recipients ─────────────────────────────────────
// Body: { recipient_ids: string[] } or { all_pending: true }
// Only pending rows are removable. A sent row is a record of something that
// actually left the building and stays.

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await loadCampaign(id);
  if (!result.ok) return result.response;

  const { supabase, campaign } = result.context;

  let body: { recipient_ids?: string[]; all_pending?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("campaign_recipients")
    .delete()
    .eq("campaign_id", campaign.id)
    .eq("status", "pending");

  if (body.recipient_ids?.length) {
    query = query.in("id", body.recipient_ids);
  } else if (!body.all_pending) {
    return NextResponse.json<ApiError>(
      { error: "Provide recipient_ids or all_pending", code: "bad_request" },
      { status: 400 }
    );
  }

  const { data, error } = await query.select("id");

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  const counts = await syncRecipientCounts(supabase, campaign.id);
  return NextResponse.json({ removed: data?.length ?? 0, counts });
}

// ── Lead loading ──────────────────────────────────────────────────────────────

async function leadsByIds(
  // biome-ignore lint: Supabase client generic is not exported in a usable form
  supabase: any,
  workspaceId: string,
  ids: string[]
): Promise<Lead[]> {
  const unique = Array.from(new Set(ids));
  const out: Lead[] = [];

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
    let query = supabase.from("leads").select("*").eq("workspace_id", workspaceId);
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
