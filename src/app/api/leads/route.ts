import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Lead, ApiError } from "@/lib/utils/types";

export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) {
    return NextResponse.json({ leads: [], total: 0 });
  }

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ leads: (leads as Lead[]) ?? [], total: leads?.length ?? 0 });
}
