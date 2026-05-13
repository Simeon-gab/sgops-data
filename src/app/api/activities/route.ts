import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import type { PipelineActivity, ApiError } from "@/lib/utils/types";

// ── GET /api/activities?lead_id=X ─────────────────────────────────────────────
// Returns pipeline_activities for a lead, newest first.

export async function GET(req: NextRequest) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const leadId = new URL(req.url).searchParams.get("lead_id");
  if (!leadId) {
    return NextResponse.json<ApiError>(
      { error: "lead_id is required", code: "bad_request" },
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

  const { data: activities, error } = await supabase
    .from("pipeline_activities")
    .select("*")
    .eq("lead_id", leadId)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json<ApiError>(
      { error: "Failed to fetch activities", code: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    activities: (activities ?? []) as PipelineActivity[],
  });
}
