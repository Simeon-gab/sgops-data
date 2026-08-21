import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { driveCampaign } from "@/lib/campaigns/worker";
import type { Campaign, Workspace } from "@/lib/utils/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ── GET /api/cron/campaigns ───────────────────────────────────────────────────
//
// Drives every sending campaign a little, so a campaign progresses whether or
// not anyone has its page open. Configured in vercel.json.
//
// Runs on the service client because a cron has no session, which means RLS is
// not scoping anything here: every query below filters by campaign or workspace
// explicitly, and the only rows this touches belong to campaigns their own
// owner already started.

// Left for the wrap-up work after the last send.
const DEADLINE_MS = 45_000;

// A campaign whose throttle has not elapsed returns immediately, so this is a
// bound on how many are checked, not on how much sending happens.
const MAX_CAMPAIGNS = 20;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Refusing outright when unconfigured, rather than running open, because an
  // unauthenticated caller could otherwise drive real sends.
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured", code: "cron_disabled" },
      { status: 503 }
    );
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const supabase = createServiceClient();
  const deadline = Date.now() + DEADLINE_MS;

  // updated_at is bumped whenever a campaign's counters are synced, which every
  // run does, so ordering by it rotates fairly through the sending campaigns
  // instead of starving the ones at the back.
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "sending")
    .order("updated_at", { ascending: true })
    .limit(MAX_CAMPAIGNS);

  if (error) {
    return NextResponse.json({ error: error.message, code: "db_error" }, { status: 500 });
  }

  const rows = (campaigns as Campaign[]) ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ campaigns: 0, sent: 0, results: [] });
  }

  // Workspaces in one round trip: the worker needs each one for the from-name
  // fallback and for who to attribute the pipeline activity to.
  const workspaceIds = Array.from(new Set(rows.map((c) => c.workspace_id)));
  const { data: workspaceRows } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", workspaceIds);

  const workspaces = new Map(
    ((workspaceRows as Workspace[]) ?? []).map((w) => [w.id, w])
  );

  const results: Record<string, unknown>[] = [];
  let totalSent = 0;

  for (const campaign of rows) {
    if (Date.now() > deadline) break;

    const workspace = workspaces.get(campaign.workspace_id);
    if (!workspace) continue;

    try {
      const drive = await driveCampaign(supabase, {
        campaign,
        workspace,
        // No session here, so the workspace owner is the actor on record.
        actorId: workspace.owner_id,
        origin: req.nextUrl.origin,
        deadline,
      });

      totalSent += drive.sent;
      results.push({
        id:      campaign.id,
        name:    campaign.name,
        sent:    drive.sent,
        skipped: drive.skipped,
        failed:  drive.failed,
        status:  drive.status,
        reason:  drive.reason,
        error:   drive.error ?? null,
      });
    } catch (err) {
      // One broken campaign must not stop the others from being driven.
      results.push({
        id:    campaign.id,
        name:  campaign.name,
        error: err instanceof Error ? err.message : "Drive failed",
      });
    }
  }

  return NextResponse.json({
    campaigns: results.length,
    sent: totalSent,
    results,
  });
}
