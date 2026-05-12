import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runProspector } from "@/lib/engine/prospector";
import { NICHES } from "@/lib/utils/constants";
import type { ProspectRequest, Lead, CleanBusinessRecord, ApiError } from "@/lib/utils/types";

export async function POST(req: NextRequest) {
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

  let body: ProspectRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const { niche_id, country, state, city, result_count } = body;
  if (!niche_id || !country || !state || !city || !result_count) {
    return NextResponse.json<ApiError>(
      { error: "Missing required fields", code: "bad_request" },
      { status: 400 }
    );
  }

  const niche = NICHES.find((n) => n.id === niche_id);
  if (!niche) {
    return NextResponse.json<ApiError>(
      { error: `Unknown niche: ${niche_id}`, code: "bad_request" },
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

  let prospectResult;
  try {
    prospectResult = await runProspector(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json<ApiError>(
      { error: message, code: "extraction_failed" },
      { status: 500 }
    );
  }

  const { records, demo_mode } = prospectResult;
  const totalExtracted = records.length;

  // Deduplicate against existing workspace leads
  const hashes = records.map((r) => r.duplicate_hash);
  const { data: existingRaw } = await supabase
    .from("leads")
    .select("duplicate_hash")
    .eq("workspace_id", workspace.id)
    .in("duplicate_hash", hashes);

  const existingHashes = new Set(
    (existingRaw ?? []).map((l: { duplicate_hash: string }) => l.duplicate_hash)
  );
  const newRecords = records.filter((r) => !existingHashes.has(r.duplicate_hash));
  const duplicatesSkipped = totalExtracted - newRecords.length;

  const now = new Date().toISOString();
  const inserts = newRecords.map((record: CleanBusinessRecord) => ({
    workspace_id: workspace.id,
    name: record.name,
    niche_id,
    niche_label: niche.label,
    place_id: record.place_id,
    country: record.address.country,
    country_code: record.address.country_code,
    state: record.address.state,
    city: record.address.city,
    street: record.address.street || null,
    zip: record.address.zip || null,
    address_full: record.address.full,
    latitude: record.coordinates?.lat ?? null,
    longitude: record.coordinates?.lng ?? null,
    email: record.email.address,
    email_verified: record.email.is_verified,
    email_confidence: record.email.confidence,
    email_source: record.email.source,
    phone: record.phone.raw || null,
    phone_formatted: record.phone.formatted || null,
    phone_valid: record.phone.is_valid,
    website: record.website.url,
    website_active: record.website.is_active,
    website_has_ssl: record.website.has_ssl,
    rating: record.rating,
    review_count: record.review_count,
    data_quality: record.data_quality,
    quality_issues: record.quality_issues,
    duplicate_hash: record.duplicate_hash,
    stage: "new",
    source: record.source === "mock" ? "manual" : record.source,
    score: 0,
    tier: "cold",
    extracted_at: now,
    has_video_content: false,
    has_blog: false,
    website_quality: null,
    social_profiles: [],
    runs_google_ads: false,
    runs_meta_ads: false,
    competitors: [],
    business_signals: [],
    score_breakdown: [],
    notes: "",
  }));

  await supabase.from("prospect_searches").insert({
    workspace_id: workspace.id,
    niche_id,
    country,
    state,
    city,
    result_count,
    leads_created: newRecords.length,
  });

  let insertedLeads: Lead[] = [];
  if (inserts.length > 0) {
    const { data: inserted } = await supabase.from("leads").insert(inserts).select();
    insertedLeads = (inserted as Lead[]) ?? [];
  }

  let existingMatchedLeads: Lead[] = [];
  if (existingHashes.size > 0) {
    const { data: existing } = await supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", workspace.id)
      .in("duplicate_hash", Array.from(existingHashes));
    existingMatchedLeads = (existing as Lead[]) ?? [];
  }

  return NextResponse.json({
    leads: [...insertedLeads, ...existingMatchedLeads],
    demo_mode,
    total_extracted: totalExtracted,
    duplicates_skipped: duplicatesSkipped,
    search_id: null,
  });
}
