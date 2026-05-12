import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Lead, PipelineStage, ApiError } from "@/lib/utils/types";

// ── PATCH /api/leads/[id] ─────────────────────────────────────────────────────
// Body: { stage?: PipelineStage, notes?: string }
// Automatically logs pipeline_activities on stage change or note save.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: { stage?: PipelineStage; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (wsError || !workspace) {
    return NextResponse.json<ApiError>(
      { error: "Workspace not found", code: "workspace_not_found" },
      { status: 404 }
    );
  }

  // Fetch current lead to detect changes
  const { data: current, error: fetchError } = await supabase
    .from("leads")
    .select("stage, notes")
    .eq("id", params.id)
    .eq("workspace_id", workspace.id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json<ApiError>(
      { error: "Lead not found", code: "not_found" },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {};
  const activities: {
    workspace_id: string;
    lead_id: string;
    type: string;
    from_stage?: string | null;
    to_stage?: string | null;
    content?: string | null;
    created_by: string;
  }[] = [];

  // Stage change
  if (body.stage !== undefined && body.stage !== current.stage) {
    updates.stage = body.stage;
    if (body.stage === "contacted") {
      updates.last_contacted_at = new Date().toISOString();
    }
    activities.push({
      workspace_id: workspace.id,
      lead_id: params.id,
      type: "stage_change",
      from_stage: current.stage,
      to_stage: body.stage,
      created_by: user.id,
    });
  }

  // Notes change
  if (
    body.notes !== undefined &&
    body.notes !== current.notes &&
    body.notes.trim().length > 0
  ) {
    updates.notes = body.notes;
    activities.push({
      workspace_id: workspace.id,
      lead_id: params.id,
      type: "note",
      content: body.notes.trim(),
      created_by: user.id,
    });
  } else if (body.notes !== undefined && body.notes !== current.notes) {
    // Clear notes without logging
    updates.notes = body.notes;
  }

  if (Object.keys(updates).length === 0) {
    // Nothing changed — return current lead
    const { data: unchanged } = await supabase
      .from("leads")
      .select("*")
      .eq("id", params.id)
      .single();
    return NextResponse.json({ lead: unchanged as Lead });
  }

  const { data: updated, error: updateError } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", params.id)
    .eq("workspace_id", workspace.id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json<ApiError>(
      { error: "Failed to update lead", code: "update_failed" },
      { status: 500 }
    );
  }

  // Log activities (best-effort — don't fail the request if this errors)
  if (activities.length > 0) {
    await supabase.from("pipeline_activities").insert(activities);
  }

  return NextResponse.json({ lead: updated as Lead });
}
