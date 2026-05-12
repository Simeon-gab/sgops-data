import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ApiError } from "@/lib/utils/types";

const ALLOWED_FIELDS = [
  "agency_name",
  "agency_email",
  "agency_phone",
  "agency_website",
  "agency_portfolio_url",
] as const;

export async function GET() {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (error || !workspace) {
    return NextResponse.json<ApiError>(
      { error: "Workspace not found", code: "not_found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ workspace });
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid body", code: "bad_request" },
      { status: 400 }
    );
  }

  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      updates[field] = typeof body[field] === "string" && body[field] ? (body[field] as string) : null;
    }
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error || !workspace) {
    return NextResponse.json<ApiError>(
      { error: "Failed to update workspace", code: "update_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ workspace });
}
