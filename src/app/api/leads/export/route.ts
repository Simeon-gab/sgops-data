import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import type { Lead, CleanedExportRecord, ApiError } from "@/lib/utils/types";

function toExportRecord(lead: Lead): CleanedExportRecord {
  const instagram = lead.social_profiles?.find((s) => s.platform === "instagram");
  const facebook  = lead.social_profiles?.find((s) => s.platform === "facebook");
  const tiktok    = lead.social_profiles?.find((s) => s.platform === "tiktok");

  return {
    business_name:      lead.name,
    niche:              lead.niche_label,
    country:            lead.country,
    state:              lead.state,
    city:               lead.city,
    street:             lead.street ?? "",
    zip:                lead.zip ?? "",
    full_address:       lead.address_full ?? "",
    email:              lead.email ?? "",
    email_verified:     lead.email_verified,
    phone:              lead.phone_formatted ?? lead.phone ?? "",
    phone_valid:        lead.phone_valid,
    website:            lead.website ?? "",
    website_active:     lead.website_active,
    google_rating:      lead.rating ?? 0,
    google_reviews:     lead.review_count,
    has_video:          lead.has_video_content,
    social_instagram:   instagram?.url ?? "",
    social_facebook:    facebook?.url ?? "",
    social_tiktok:      tiktok?.url ?? "",
    instagram_followers: instagram?.followers ?? 0,
    runs_ads:           lead.runs_google_ads || lead.runs_meta_ads,
    years_in_business:  lead.years_in_business ?? 0,
    estimated_employees: lead.estimated_employees ?? 0,
    lead_score:         lead.score,
    lead_tier:          lead.tier,
    data_quality:       lead.data_quality,
    quality_issues:     (lead.quality_issues ?? []).join("; "),
  };
}

function escapeCSV(val: unknown): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(records: CleanedExportRecord[]): string {
  if (!records.length) return "";
  const headers = Object.keys(records[0]) as (keyof CleanedExportRecord)[];
  const rows = [
    headers.join(","),
    ...records.map((r) => headers.map((h) => escapeCSV(r[h])).join(",")),
  ];
  return rows.join("\n");
}

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
    return NextResponse.json<ApiError>(
      { error: "Could not initialize workspace", code: "workspace_error" },
      { status: 500 }
    );
  }

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("score", { ascending: false });

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  const records = (leads ?? []).map(toExportRecord);
  const csv = toCSV(records);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sgops-leads-${date}.csv"`,
    },
  });
}
