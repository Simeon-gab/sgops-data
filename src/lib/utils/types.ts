export interface Lead {
  id: string;
  workspace_id: string;
  name: string;
  niche_id: string;
  niche_label: string;
  place_id: string | null;
  country: string;
  country_code: string | null;
  state: string;
  city: string;
  street: string | null;
  zip: string | null;
  address_full: string | null;
  latitude: number | null;
  longitude: number | null;
  email: string | null;
  email_verified: boolean;
  email_confidence: number | null;
  email_source: string | null;
  phone: string | null;
  phone_formatted: string | null;
  phone_valid: boolean;
  website: string | null;
  website_active: boolean;
  website_has_ssl: boolean;
  rating: number | null;
  review_count: number;
  has_video_content: boolean;
  has_blog: boolean;
  website_quality: "modern" | "outdated" | "minimal" | null;
  social_profiles: SocialProfile[];
  runs_google_ads: boolean;
  runs_meta_ads: boolean;
  competitors: Competitor[];
  years_in_business: number | null;
  estimated_employees: number | null;
  business_signals: string[];
  score: number;
  tier: LeadTier;
  score_breakdown: ScoreSignal[];
  data_quality: DataQuality;
  quality_issues: string[];
  duplicate_hash: string | null;
  stage: PipelineStage;
  last_contacted_at: string | null;
  notes: string;
  source: "google_places" | "serpapi" | "directory" | "manual";
  extracted_at: string;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialProfile {
  platform: "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin";
  url: string;
  followers: number | null;
  posts_per_week: number | null;
}

export interface Competitor {
  name: string;
  has_video: boolean;
  rating: number;
  review_count: number;
}

export interface ScoreSignal {
  signal: string;
  points: number;
  reason: string;
}

export type PipelineStage =
  | "new"
  | "contacted"
  | "responded"
  | "meeting"
  | "proposal"
  | "closed"
  | "lost";

export type DataQuality = "verified" | "partial" | "unverified";

export type LeadTier = "hot" | "warm" | "cold";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  agency_name: string | null;
  agency_email: string | null;
  agency_phone: string | null;
  agency_website: string | null;
  agency_portfolio_url: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProspectRequest {
  niche_id: string;
  country: string;
  state: string;
  city: string;
  result_count: number;
}

export interface OutreachTemplate {
  id: string;
  workspace_id: string;
  lead_id: string;
  type:
    | "cold_email"
    | "call_script"
    | "follow_up_3"
    | "follow_up_7"
    | "follow_up_14"
    | "content_plan"
    | "proposal";
  subject: string | null;
  body: string;
  structured_data: Record<string, unknown> | null;
  model_used: string | null;
  tokens_used: number | null;
  created_at: string;
}

export interface OutreachSend {
  id: string;
  workspace_id: string;
  lead_id: string;
  template_id: string | null;
  to_email: string;
  subject: string;
  body: string;
  status: "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed";
  resend_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

export interface PipelineActivity {
  id: string;
  workspace_id: string;
  lead_id: string;
  type: "stage_change" | "note" | "email_sent" | "call_logged" | "meeting_scheduled";
  from_stage: string | null;
  to_stage: string | null;
  content: string | null;
  created_by: string | null;
  created_at: string;
}

export interface NichePlaybook {
  id: string;
  workspace_id: string;
  niche_id: string;
  niche_label: string;
  icon: string | null;
  pain_points: string;
  content_angles: string[];
  hook: string;
  objection_responses: Record<string, string>;
  pricing_tiers: Record<string, unknown>;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface CleanedExportRecord {
  business_name: string;
  niche: string;
  country: string;
  state: string;
  city: string;
  street: string;
  zip: string;
  full_address: string;
  email: string;
  email_verified: boolean;
  phone: string;
  phone_valid: boolean;
  website: string;
  website_active: boolean;
  google_rating: number;
  google_reviews: number;
  has_video: boolean;
  social_instagram: string;
  social_facebook: string;
  social_tiktok: string;
  instagram_followers: number;
  runs_ads: boolean;
  years_in_business: number;
  estimated_employees: number;
  lead_score: number;
  lead_tier: string;
  data_quality: string;
  quality_issues: string;
}

export interface ApiError {
  error: string;
  code: string;
}

// ── Engine types ──────────────────────────────────────────────────────────────

export interface RawBusinessRecord {
  source: "google_places" | "serpapi" | "directory" | "mock";
  name: string;
  address_raw: string;
  phone_raw: string;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  category: string;
  place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  photos_count: number;
  extracted_at: string;
}

export interface CleanBusinessRecord {
  source: "google_places" | "serpapi" | "directory" | "mock";
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    country_code: string;
    full: string;
  };
  phone: {
    raw: string;
    formatted: string;
    country_code: string;
    is_valid: boolean;
  };
  email: {
    address: string | null;
    source: "website" | "directory" | "pattern" | null;
    is_verified: boolean;
    confidence: number;
  };
  website: {
    url: string | null;
    is_active: boolean;
    has_ssl: boolean;
  };
  rating: number | null;
  review_count: number;
  category: string;
  place_id: string | null;
  coordinates: { lat: number; lng: number } | null;
  data_quality: DataQuality;
  quality_issues: string[];
  duplicate_hash: string;
}

export interface ProspectApiResponse {
  leads: Lead[];
  demo_mode: boolean;
  total_extracted: number;
  duplicates_skipped: number;
  search_id: string | null;
}
