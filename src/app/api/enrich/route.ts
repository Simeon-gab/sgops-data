import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { enrichLead } from "@/lib/engine/enricher";
import { scoreLead } from "@/lib/engine/scorer";
import type { Lead, CleanBusinessRecord, Competitor, SocialProfile, ApiError } from "@/lib/utils/types";

// ── Helper: map a DB Lead row to the shape the engine services expect ─────────

function toCleanRecord(lead: Lead): CleanBusinessRecord {
  return {
    source: (lead.source === "manual" ? "google_places" : lead.source) as CleanBusinessRecord["source"],
    name: lead.name,
    address: {
      street: lead.street ?? "",
      city: lead.city,
      state: lead.state,
      zip: lead.zip ?? "",
      country: lead.country,
      country_code: lead.country_code ?? "",
      full: lead.address_full ?? "",
    },
    phone: {
      raw: lead.phone ?? "",
      formatted: lead.phone_formatted ?? "",
      country_code: "",
      is_valid: lead.phone_valid,
    },
    email: {
      address: lead.email,
      source: (lead.email_source as "website" | "directory" | "pattern" | null) ?? null,
      is_verified: lead.email_verified,
      confidence: lead.email_confidence ?? 0,
    },
    website: {
      url: lead.website,
      is_active: lead.website_active,
      has_ssl: lead.website_has_ssl,
    },
    rating: lead.rating,
    review_count: lead.review_count,
    category: lead.niche_label,
    place_id: lead.place_id,
    coordinates:
      lead.latitude != null && lead.longitude != null
        ? { lat: lead.latitude, lng: lead.longitude }
        : null,
    data_quality: lead.data_quality,
    quality_issues: lead.quality_issues ?? [],
    duplicate_hash: lead.duplicate_hash ?? "",
  };
}

// ── POST /api/enrich ──────────────────────────────────────────────────────────
// Body: { lead_id: string } | { lead_ids: string[] }
// Fetches website + SerpAPI for each lead, scores, writes back to DB.

export async function POST(req: NextRequest) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: { lead_id?: string; lead_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const ids = body.lead_ids ?? (body.lead_id ? [body.lead_id] : []);
  if (ids.length === 0) {
    return NextResponse.json<ApiError>(
      { error: "Provide lead_id or lead_ids", code: "bad_request" },
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

  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("*")
    .in("id", ids)
    .eq("workspace_id", workspace.id);

  if (leadsError || !leads?.length) {
    return NextResponse.json<ApiError>(
      { error: "Leads not found", code: "not_found" },
      { status: 404 }
    );
  }

  const serpApiKey = process.env.SERPAPI_KEY;
  const enriched: Lead[] = [];

  for (const lead of leads as Lead[]) {
    // Pull top-3 competitors from DB: same niche + city, most reviews, excluding self
    const { data: competitorRows } = await supabase
      .from("leads")
      .select("name, has_video_content, rating, review_count")
      .eq("workspace_id", workspace.id)
      .eq("niche_id", lead.niche_id)
      .eq("city", lead.city)
      .neq("id", lead.id)
      .order("review_count", { ascending: false })
      .limit(3);

    const competitors: Competitor[] = (competitorRows ?? []).map(
      (c: { name: string; has_video_content: boolean; rating: number | null; review_count: number }) => ({
        name: c.name,
        has_video: c.has_video_content,
        rating: c.rating ?? 0,
        review_count: c.review_count,
      })
    );

    const record = toCleanRecord(lead);

    const enrichment = await enrichLead(record, { serpApiKey, competitors });
    const { score, tier, breakdown } = scoreLead(record, enrichment);

    const { data: updated, error: updateError } = await supabase
      .from("leads")
      .update({
        has_video_content:   enrichment.has_video_content,
        has_blog:            enrichment.has_blog,
        website_quality:     enrichment.website_quality,
        social_profiles:     enrichment.social_profiles,
        runs_google_ads:     enrichment.runs_google_ads,
        runs_meta_ads:       enrichment.runs_meta_ads,
        competitors:         enrichment.competitors,
        years_in_business:   enrichment.years_in_business,
        estimated_employees: enrichment.estimated_employees,
        business_signals:    enrichment.business_signals,
        score,
        tier,
        score_breakdown: breakdown,
        enriched_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .select()
      .single();

    if (!updateError && updated) {
      enriched.push(updated as Lead);
    }
  }

  return NextResponse.json({ enriched });
}
