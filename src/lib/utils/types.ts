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
  // How much the address can be trusted. "guessed" means it was derived from a
  // domain and never confirmed to exist, which bulk sending must gate on.
  email_status: EmailStatus;
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
  source: "google_places" | "serpapi" | "directory" | "manual" | "csv_import";
  // Arbitrary columns carried over from a CSV import, usable as merge fields
  custom_fields: Record<string, string>;
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

// How much an email address can be trusted.
//   guessed  = derived from a domain, never confirmed to exist
//   verified = confirmed by a verification provider
//   invalid  = confirmed not to exist
//   unknown  = scraped or imported, never checked
export type EmailStatus = "guessed" | "verified" | "invalid" | "unknown";

// "unscored" = lead has not been enriched yet, so its digital-presence signals
// are unknown. It must never be treated as a confirmed "cold" lead.
export type LeadTier = "hot" | "warm" | "cold" | "unscored";

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
  // ── Sender profile ──────────────────────────────────────────────────────────
  // Who is sending, what they want, and who they are contacting. Drives the AI
  // system prompt, the scoring weights, and which generators are available.
  goal: OutreachGoal | null;
  sender_name: string | null;
  sender_role: string | null;
  organization: string | null;
  offer: string | null;
  audience: string | null;
  credibility: string | null;
  cta: string | null;
  tone: SenderTone | null;
  scoring_profile: ScoringProfileId | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Sender profile ────────────────────────────────────────────────────────────

export type OutreachGoal =
  | "win_clients"
  | "find_job"
  | "sell_product"
  | "partnership"
  | "research"
  | "custom";

export type SenderTone = "direct" | "warm" | "formal" | "casual";

export type ScoringProfileId =
  | "digital_presence"
  | "hiring_intent"
  | "business_maturity"
  | "contactability"
  | "none";

export type GenerateType =
  | "cold_email"
  | "call_script"
  | "follow_up"
  | "content_plan"
  | "proposal"
  | "lead_intel";

// The resolved, non-null view of the workspace's sender profile. Built by
// resolveSenderProfile so every consumer gets usable strings, never nulls.
export interface SenderProfile {
  goal: OutreachGoal;
  sender_name: string;
  sender_role: string;
  organization: string | null;
  offer: string;
  audience: string;
  credibility: string | null;
  cta: string;
  tone: SenderTone;
  scoring_profile: ScoringProfileId;
  website: string | null;
  onboarded: boolean;
}

export interface SenderProfileInput {
  goal: OutreachGoal;
  sender_name: string;
  sender_role: string;
  organization?: string | null;
  offer: string;
  audience: string;
  credibility?: string | null;
  cta?: string | null;
  tone?: SenderTone;
  scoring_profile?: ScoringProfileId;
}

// ── Campaign playbook ─────────────────────────────────────────────────────────
// Generated per (sender profile x target audience) and cached on
// niche_playbooks. Replaces the hand-written, video-agency-shaped playbooks.

export interface OfferTier {
  name: string;
  description: string;
  price_range: string | null;
}

export interface CampaignPlaybook {
  niche_id: string;
  niche_label: string;
  audience_context: string;
  pain_points: string;
  value_angles: string[];
  hook: string;
  objection_responses: Record<string, string>;
  offer_tiers: OfferTier[] | null;
}

export interface ProspectRequest {
  niche_id: string;
  country: string;
  state: string;
  city: string;
  result_count: number;
  top10_mode?: boolean;
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
  // Legacy columns, kept nullable for rows written before the sender-profile
  // migration. New rows populate the campaign-playbook columns below.
  pain_points: string | null;
  content_angles: string[] | null;
  hook: string | null;
  pricing_tiers: Record<string, unknown> | null;
  // Campaign playbook columns
  goal: OutreachGoal | null;
  audience_context: string | null;
  value_angles: string[] | null;
  offer_tiers: OfferTier[] | null;
  profile_hash: string | null;
  generated_at: string | null;
  objection_responses: Record<string, string>;
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

export interface LeadFilters {
  q?: string;
  niche?: string;
  country?: string;
  state?: string;
  city?: string;
  tier?: string;
  stage?: string;
  quality?: string;
}

export interface ApiError {
  error: string;
  code: string;
}

// ── CSV import ────────────────────────────────────────────────────────────────

export interface LeadImportRow {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  country?: string;
  state?: string;
  city?: string;
  notes?: string;
  // Unmapped CSV columns, carried through as {{merge_fields}} for campaigns
  custom_fields?: Record<string, string>;
}

export interface LeadImportResponse {
  imported: number;
  duplicates_skipped: number;
  invalid_skipped: number;
  // Rows whose address sits on a domain we refuse to mail (social pages,
  // link aggregators, free mailbox providers used as a business domain)
  blocked_skipped: number;
  custom_fields: string[];
  leads: Lead[];
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "paused"
  | "completed"
  | "cancelled";

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  status: CampaignStatus;
  subject_template: string | null;
  body_template: string | null;
  from_name: string | null;
  from_email: string | null;
  daily_limit: number;
  throttle_seconds: number;
  send_window_start: string | null;
  send_window_end: string | null;
  timezone: string;
  // A guessed info@ address is a research artifact, not a confirmed contact.
  // Off by default; the user opts in per campaign.
  allow_guessed_emails: boolean;
  include_unsubscribe: boolean;
  // Which mailbox this campaign sends from. null keeps the pre-identity
  // behaviour: from_email above, delivered by the platform.
  sending_identity_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  updated_at: string;
}

export type RecipientStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  workspace_id: string;
  lead_id: string;
  to_email: string;
  subject: string | null;
  body: string | null;
  status: RecipientStatus;
  skip_reason: string | null;
  send_id: string | null;
  attempts: number;
  last_error: string | null;
  scheduled_for: string | null;
  claimed_at: string | null;
  sent_at: string | null;
  created_at: string;
}

// ── Sending identities ───────────────────────────────────────────────

export type TransportKind = "resend" | "smtp" | "gmail" | "outlook";

export type SendingIdentityStatus = "unverified" | "verified" | "failed";

export interface SendingIdentity {
  id: string;
  workspace_id: string;
  kind: TransportKind;
  label: string | null;
  from_email: string;
  from_name: string | null;
  reply_to: string | null;
  is_default: boolean;
  status: SendingIdentityStatus;
  verified_at: string | null;
  last_error: string | null;
  // Ciphertext. Unreadable by any browser session and never returned by the
  // API, so this is null on anything the client holds.
  secrets: string | null;
  daily_limit: number | null;
  created_at: string;
  updated_at: string;
}

// What the API returns: everything except the credentials.
export type SendingIdentityPublic = Omit<SendingIdentity, "secrets"> & {
  has_credentials: boolean;
};

export type SuppressionReason =
  | "unsubscribed"
  | "bounced"
  | "complained"
  | "invalid"
  | "manual";

export interface Suppression {
  id: string;
  // null means a global suppression applying to every workspace
  workspace_id: string | null;
  email: string;
  reason: SuppressionReason;
  source: string | null;
  created_at: string;
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
  top10_mode: boolean;
  total_extracted: number;
  duplicates_skipped: number;
  search_id: string | null;
}
