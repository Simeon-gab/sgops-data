import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import type { OutreachSend, ApiError } from "@/lib/utils/types";

// ── GET /api/email/sends ──────────────────────────────────────────────────────
// Returns all outreach_sends for the workspace, joined with lead name.

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
    return NextResponse.json({ sends: [] });
  }

  const { data, error } = await supabase
    .from("outreach_sends")
    .select("*, leads:lead_id(name, niche_label, city)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ sends: data ?? [] });
}
