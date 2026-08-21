import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { applyLeadFilters } from "@/lib/supabase/lead-filters";
import type { Lead, ApiError } from "@/lib/utils/types";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

  // Supabase caps an unranged response at 1000 rows, so an unpaginated select
  // silently hides everything past the first thousand leads. Page explicitly and
  // report the true total from the count so the UI knows there is more.
  const limit = clamp(parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "", 10) || 0);

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspace.id);

  query = applyLeadFilters(query, searchParams);
  // id is a deterministic tiebreak: without it, rows sharing a score can repeat
  // or vanish across pages.
  query = query
    .order("score", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: leads, error, count } = await query;

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  const rows = (leads as Lead[]) ?? [];
  const total = count ?? rows.length;

  return NextResponse.json({
    leads: rows,
    total,
    limit,
    offset,
    has_more: offset + rows.length < total,
  });
}
