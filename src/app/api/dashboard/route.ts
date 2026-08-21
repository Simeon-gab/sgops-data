import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { PIPELINE_STAGES } from "@/lib/utils/constants";
import type { ApiError } from "@/lib/utils/types";

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
  if (!workspace) {
    return NextResponse.json({ leads: emptyLeadStats(), sends: emptySendStats() });
  }

  // Aggregated in Postgres. Counting rows in JS meant pulling every lead into
  // the API, which silently truncated at 1000 rows and reported wrong totals.
  const [{ data: leadStats }, { data: sendStats }] = await Promise.all([
    supabase.rpc("workspace_lead_stats", { ws: workspace.id }),
    supabase.rpc("workspace_send_stats", { ws: workspace.id }),
  ]);

  const l = (leadStats as LeadStatsRow | null) ?? null;
  const s = (sendStats as SendStatsRow | null) ?? null;

  if (!l) {
    return NextResponse.json({ leads: emptyLeadStats(), sends: emptySendStats() });
  }

  // The RPC returns only stages that have rows. Project onto the full stage
  // list so the pipeline chart always renders every column.
  const stageCounts = new Map(
    (l.by_stage ?? []).map((row) => [row.stage, row.count])
  );
  const by_stage = PIPELINE_STAGES.map(({ id, label, color }) => ({
    stage: id,
    label,
    color,
    count: stageCounts.get(id) ?? 0,
  }));

  return NextResponse.json({
    leads: {
      total: l.total,
      hot: l.hot,
      warm: l.warm,
      cold: l.cold,
      // Leads that were never enriched, so their tier is genuinely unknown
      // rather than a confirmed "cold".
      unscored: l.unscored,
      enriched: l.enriched,
      active: l.active,
      with_email: l.with_email,
      email_guessed: l.email_guessed,
      email_verified: l.email_verified,
      by_stage,
      by_niche: l.by_niche ?? [],
      verified: l.verified,
      partial: l.partial,
      unverified: l.unverified,
    },
    sends: s ?? emptySendStats(),
  });
}

interface LeadStatsRow {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  unscored: number;
  enriched: number;
  active: number;
  with_email: number;
  verified: number;
  partial: number;
  unverified: number;
  email_guessed: number;
  email_verified: number;
  by_stage: { stage: string; count: number }[] | null;
  by_niche: { niche: string; count: number }[] | null;
}

interface SendStatsRow {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  bounced: number;
}

function emptyLeadStats() {
  return {
    total: 0, hot: 0, warm: 0, cold: 0, unscored: 0, enriched: 0,
    active: 0, with_email: 0, email_guessed: 0, email_verified: 0,
    by_stage: PIPELINE_STAGES.map(({ id, label, color }) => ({ stage: id, label, color, count: 0 })),
    by_niche: [],
    verified: 0, partial: 0, unverified: 0,
  };
}

function emptySendStats() {
  return { total: 0, sent: 0, delivered: 0, opened: 0, bounced: 0 };
}
