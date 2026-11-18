import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { applyLeadFilters } from "@/lib/supabase/lead-filters";
import { EXPORT_COLUMNS, toCSV, type ExportLead } from "@/lib/utils/leads-export";
import type { ApiError } from "@/lib/utils/types";

// GET /api/leads/export
// The filtered lead list as a CSV file.
//
// A single select is capped at 1000 rows by PostgREST, so the list is fetched
// in pages. The first page also asks for the total, and the remaining pages
// are then requested together rather than one after another: fetched in
// sequence, each page waited on the one before and a few thousand leads took
// longer than the request was allowed to run.

const EXPORT_PAGE = 1000;
const MAX_EXPORT_ROWS = 50_000;
// Enough to be fast, few enough not to crowd out the app's other queries.
const PARALLEL_PAGES = 4;

export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) {
    return NextResponse.json<ApiError>(
      { error: "Could not initialize workspace", code: "workspace_error" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const columns = EXPORT_COLUMNS.join(",");

  const fetchPage = (page: number, withCount: boolean) => {
    const from = page * EXPORT_PAGE;
    let query = supabase
      .from("leads")
      .select(columns, withCount ? { count: "exact" } : undefined)
      .eq("workspace_id", workspace.id);

    query = applyLeadFilters(query, searchParams);
    // id breaks ties in score, so pages fetched separately never overlap.
    return query
      .order("score", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + EXPORT_PAGE - 1) as PromiseLike<{
        data: ExportLead[] | null;
        count: number | null;
        error: { message: string } | null;
      }>;
  };

  const first = await fetchPage(0, true);
  if (first.error) {
    return NextResponse.json<ApiError>(
      { error: first.error.message, code: "db_error" },
      { status: 500 }
    );
  }

  const leads: ExportLead[] = first.data ?? [];
  const total = Math.min(first.count ?? leads.length, MAX_EXPORT_ROWS);
  const pageCount = Math.ceil(total / EXPORT_PAGE);

  for (let start = 1; start < pageCount; start += PARALLEL_PAGES) {
    const pages = [];
    for (let p = start; p < Math.min(start + PARALLEL_PAGES, pageCount); p++) {
      pages.push(fetchPage(p, false));
    }

    for (const result of await Promise.all(pages)) {
      if (result.error) {
        // A partial file would look complete. Fail instead.
        return NextResponse.json<ApiError>(
          { error: result.error.message, code: "db_error" },
          { status: 500 }
        );
      }
      leads.push(...(result.data ?? []));
    }
  }

  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCSV(leads), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sgops-leads-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Export-Rows": String(leads.length),
    },
  });
}
