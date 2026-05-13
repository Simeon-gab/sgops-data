import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { applyLeadFilters } from "@/lib/supabase/lead-filters";
import type { Lead, ApiError } from "@/lib/utils/types";

export async function GET(request: Request) {
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

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) {
    return NextResponse.json({ leads: [], total: 0 });
  }

  const { searchParams } = new URL(request.url);

  let query = supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", workspace.id);

  query = applyLeadFilters(query, searchParams);
  query = query.order("score", { ascending: false });

  const { data: leads, error } = await query;

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ leads: (leads as Lead[]) ?? [], total: leads?.length ?? 0 });
}
