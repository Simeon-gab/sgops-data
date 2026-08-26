import { NextRequest, NextResponse } from "next/server";
import { loadCampaign } from "@/lib/campaigns/context";
import { driveCampaign } from "@/lib/campaigns/worker";
import type { ApiError } from "@/lib/utils/types";

export const maxDuration = 60;

// Wall-clock budget for one run, well under the platform limit so the
// bookkeeping after the last send always gets to finish.
const RUN_BUDGET_MS = 20_000;

// ── POST /api/campaigns/[id]/send ─────────────────────────────────────────────
// Sends whatever the pacing rules currently allow and returns. Safe to call
// repeatedly; the campaign page polls it while a campaign is sending. The same
// drain runs unattended from /api/cron/campaigns.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await loadCampaign(id);
  if (!result.ok) return result.response;

  const { supabase, user, workspace, campaign } = result.context;

  const drive = await driveCampaign(supabase, {
    campaign,
    workspace,
    actorId: user.id,
    origin: req.nextUrl.origin,
    deadline: Date.now() + RUN_BUDGET_MS,
  });

  if (drive.error) {
    const notSending = campaign.status !== "sending";
    return NextResponse.json<ApiError>(
      { error: drive.error, code: notSending ? "not_sending" : "not_ready" },
      { status: notSending ? 409 : 400 }
    );
  }

  return NextResponse.json({
    done:      drive.done,
    sent:      drive.sent,
    skipped:   drive.skipped,
    failed:    drive.failed,
    retrying:  drive.retrying,
    last_error: drive.lastError,
    counts:    drive.counts,
    status:    drive.status,
    reason:    drive.reason,
    resume_at: drive.resumeAt?.toISOString() ?? null,
  });
}
