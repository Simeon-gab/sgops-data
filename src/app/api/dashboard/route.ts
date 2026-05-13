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

  const [{ data: leads }, { data: sends }] = await Promise.all([
    supabase
      .from("leads")
      .select("tier, stage, niche_label, data_quality, email")
      .eq("workspace_id", workspace.id),
    supabase
      .from("outreach_sends")
      .select("status")
      .eq("workspace_id", workspace.id),
  ]);

  const l = leads ?? [];
  const s = sends ?? [];

  // Tier counts
  const hot  = l.filter((x) => x.tier === "hot").length;
  const warm = l.filter((x) => x.tier === "warm").length;
  const cold = l.filter((x) => x.tier === "cold").length;

  // Active = not closed/lost
  const active = l.filter((x) => x.stage !== "closed" && x.stage !== "lost").length;

  // Pipeline by stage
  const by_stage = PIPELINE_STAGES.map(({ id, label, color }) => ({
    stage: id,
    label,
    color,
    count: l.filter((x) => x.stage === id).length,
  }));

  // Top niches (top 6)
  const nicheCounts: Record<string, number> = {};
  for (const lead of l) {
    nicheCounts[lead.niche_label] = (nicheCounts[lead.niche_label] ?? 0) + 1;
  }
  const by_niche = Object.entries(nicheCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([niche, count]) => ({ niche, count }));

  // Data quality
  const verified   = l.filter((x) => x.data_quality === "verified").length;
  const partial    = l.filter((x) => x.data_quality === "partial").length;
  const unverified = l.filter((x) => x.data_quality === "unverified").length;
  const with_email = l.filter((x) => x.email).length;

  // Send stats
  const sent      = s.filter((x) => ["sent", "delivered", "opened", "clicked"].includes(x.status)).length;
  const delivered = s.filter((x) => ["delivered", "opened", "clicked"].includes(x.status)).length;
  const opened    = s.filter((x) => ["opened", "clicked"].includes(x.status)).length;
  const bounced   = s.filter((x) => ["bounced", "failed"].includes(x.status)).length;

  return NextResponse.json({
    leads: {
      total: l.length,
      hot, warm, cold, active, with_email,
      by_stage, by_niche,
      verified, partial, unverified,
    },
    sends: {
      total: s.length,
      sent, delivered, opened, bounced,
    },
  });
}

function emptyLeadStats() {
  return {
    total: 0, hot: 0, warm: 0, cold: 0, active: 0, with_email: 0,
    by_stage: PIPELINE_STAGES.map(({ id, label, color }) => ({ stage: id, label, color, count: 0 })),
    by_niche: [],
    verified: 0, partial: 0, unverified: 0,
  };
}

function emptySendStats() {
  return { total: 0, sent: 0, delivered: 0, opened: 0, bounced: 0 };
}
