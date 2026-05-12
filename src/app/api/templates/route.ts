import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OutreachTemplate, ApiError } from "@/lib/utils/types";

// ── GET /api/templates ────────────────────────────────────────────────────────
// Query params: lead_id (required), type (optional)
// type=follow_up expands to follow_up_3 + follow_up_7 + follow_up_14

const FOLLOW_UP_TYPES = ["follow_up_3", "follow_up_7", "follow_up_14"] as const;

export async function GET(req: NextRequest) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("lead_id");
  const type   = searchParams.get("type");

  if (!leadId) {
    return NextResponse.json<ApiError>(
      { error: "lead_id is required", code: "bad_request" },
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

  let query = supabase
    .from("outreach_templates")
    .select("*")
    .eq("lead_id", leadId)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (type) {
    if (type === "follow_up") {
      query = query.in("type", [...FOLLOW_UP_TYPES]);
    } else {
      query = query.eq("type", type);
    }
  }

  const { data: templates, error: fetchError } = await query;

  if (fetchError) {
    return NextResponse.json<ApiError>(
      { error: "Failed to fetch templates", code: "fetch_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ templates: (templates ?? []) as OutreachTemplate[] });
}
