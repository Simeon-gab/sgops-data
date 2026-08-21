import type { PipelineStage } from "./types";

export const NICHES = [
  { id: "restaurant",       label: "Restaurants",                  icon: "🍽️" },
  { id: "hotel",            label: "Hotels & Hospitality",         icon: "🏨" },
  { id: "salon",            label: "Hair & Beauty Salons",         icon: "💇" },
  { id: "gym",              label: "Gyms & Fitness Studios",       icon: "🏋️" },
  { id: "dental",           label: "Dental Clinics",               icon: "🦷" },
  { id: "real_estate",      label: "Real Estate Agencies",         icon: "🏠" },
  { id: "law_firm",         label: "Law Firms",                    icon: "⚖️" },
  { id: "auto_dealer",      label: "Car Dealerships",              icon: "🚗" },
  { id: "wedding_venue",    label: "Wedding Venues",               icon: "💒" },
  { id: "event_planner",    label: "Event Planners",               icon: "🎉" },
  { id: "contractor",       label: "Contractors & Construction",   icon: "🔨" },
  { id: "retail",           label: "Retail Stores",                icon: "🛍️" },
  { id: "medical",          label: "Medical Clinics",              icon: "🏥" },
  { id: "nightclub",        label: "Nightclubs & Bars",            icon: "🍸" },
  { id: "photography",      label: "Photography Studios",          icon: "📸" },
  { id: "spa_wellness",     label: "Spas & Wellness",              icon: "🧖" },
  { id: "bakery_cafe",      label: "Bakeries & Cafes",             icon: "🥐" },
  { id: "pet_services",     label: "Pet Grooming & Vet Clinics",   icon: "🐾" },
  { id: "fashion_clothing", label: "Fashion & Clothing Stores",    icon: "👗" },
  { id: "jewelry",          label: "Jewelry Stores",               icon: "💍" },
  { id: "barbershop",       label: "Barbershops",                  icon: "✂️" },
  { id: "car_wash",         label: "Car Wash & Detailing",         icon: "🫧" },
  { id: "printing_signage", label: "Printing & Signage",           icon: "🖨️" },
  { id: "florist",          label: "Florists",                     icon: "💐" },
  { id: "furniture",        label: "Furniture Stores",             icon: "🛋️" },
  { id: "pharmacy",         label: "Pharmacies",                   icon: "💊" },
  { id: "grocery",          label: "Supermarkets & Grocery",       icon: "🛒" },
] as const;

export type NicheId = (typeof NICHES)[number]["id"];

export const PIPELINE_STAGES: {
  id: PipelineStage;
  label: string;
  color: string;
}[] = [
  { id: "new", label: "New", color: "#d4a017" },
  { id: "contacted", label: "Contacted", color: "#e08a2e" },
  { id: "responded", label: "Responded", color: "#22c55e" },
  { id: "meeting", label: "Meeting", color: "#3b82f6" },
  { id: "proposal", label: "Proposal", color: "#8b5cf6" },
  { id: "closed", label: "Closed Won", color: "#10b981" },
  { id: "lost", label: "Lost", color: "#ef4444" },
];

export const RESULT_COUNT_OPTIONS = [50, 100, 150, 200] as const;

// ── Scoring ───────────────────────────────────────────────────────────────────
// A lead is only "hot" relative to what the sender wants. A videographer cares
// that a business has no video; a job seeker cares that it is hiring; a
// software seller cares that it can afford the product. So the signal catalog is
// shared and each scoring profile assigns its own weights. A signal weighted 0
// is skipped entirely and never appears in the breakdown.

export const SCORING_SIGNALS = [
  "no_video_content",
  "no_website",
  "outdated_website",
  "modern_website",
  "low_review_count",
  "high_review_volume",
  "no_email_found",
  "has_email",
  "verified_email",
  "has_phone",
  "has_website",
  "competitor_has_video",
  "active_instagram",
  "no_social_presence",
  "has_linkedin",
  "high_rating",
  "has_blog",
  "runs_ads",
  "established_business",
  "has_employees",
  "hiring_signal",
  "multiple_locations",
] as const;

export type ScoringSignal = (typeof SCORING_SIGNALS)[number];

export type SignalWeights = Partial<Record<ScoringSignal, number>>;

export interface ScoringProfile {
  id: string;
  label: string;
  description: string;
  weights: SignalWeights;
  thresholds: { hot: number; warm: number };
}

// Client acquisition for a service business. These are the original weights and
// thresholds, unchanged, so existing workspaces score exactly as before.
const DIGITAL_PRESENCE_WEIGHTS: SignalWeights = {
  no_video_content: 22,
  low_review_count: 18,
  no_email_found: 10,
  outdated_website: 15,
  no_social_presence: 8,
  competitor_has_video: 12,
  runs_ads: -10,
  high_rating: 5,
  active_instagram: 8,
  has_blog: 5,
  no_website: 20,
};

export const SCORING_PROFILES: Record<string, ScoringProfile> = {
  digital_presence: {
    id: "digital_presence",
    label: "Marketing opportunity",
    description:
      "Ranks businesses by how much they are missing online. Best when you sell marketing, content, web, or design services.",
    weights: DIGITAL_PRESENCE_WEIGHTS,
    thresholds: { hot: 65, warm: 35 },
  },
  hiring_intent: {
    id: "hiring_intent",
    label: "Hiring signals",
    description:
      "Ranks organizations by how likely they are to be hiring and reachable. Best for job, placement, and internship outreach.",
    weights: {
      hiring_signal: 30,
      has_email: 25,
      verified_email: 10,
      has_website: 10,
      has_linkedin: 10,
      established_business: 8,
      has_employees: 7,
      multiple_locations: 5,
    },
    thresholds: { hot: 60, warm: 30 },
  },
  business_maturity: {
    id: "business_maturity",
    label: "Buying power",
    description:
      "Ranks businesses by size, stability, and evidence of existing budget. Best for B2B product sales and partnerships.",
    weights: {
      established_business: 20,
      has_employees: 15,
      high_review_volume: 15,
      runs_ads: 15,
      has_email: 15,
      modern_website: 10,
      has_linkedin: 10,
      multiple_locations: 8,
    },
    thresholds: { hot: 60, warm: 30 },
  },
  contactability: {
    id: "contactability",
    label: "Contactability",
    description:
      "Ranks purely by how complete and reachable the contact data is. A safe default when you are researching or your goal does not fit the others.",
    weights: {
      has_email: 30,
      verified_email: 15,
      has_phone: 12,
      has_website: 10,
      has_linkedin: 8,
      established_business: 5,
      high_review_volume: 5,
      hiring_signal: 15,
    },
    thresholds: { hot: 60, warm: 30 },
  },
  none: {
    id: "none",
    label: "No scoring",
    description: "Leave every lead unscored and sort them yourself.",
    weights: {},
    thresholds: { hot: 101, warm: 101 },
  },
};

export const DEFAULT_SCORING_PROFILE = "contactability";

export function getScoringProfile(id: string | null | undefined): ScoringProfile {
  return SCORING_PROFILES[id ?? ""] ?? SCORING_PROFILES[DEFAULT_SCORING_PROFILE];
}

// Retained for callers that still reference the original agency weight table.
export const SCORING_WEIGHTS = DIGITAL_PRESENCE_WEIGHTS;

export const TIER_THRESHOLDS = {
  hot: 65,
  warm: 35,
} as const;

export const DATA_QUALITY_LABELS: Record<string, string> = {
  verified: "Verified",
  partial: "Partial",
  unverified: "Unverified",
};

export const QUALITY_ISSUE_LABELS: Record<string, string> = {
  missing_email: "No email found",
  guessed_email: "Email is a guess, not confirmed",
  no_website: "No website",
  low_reviews: "Low review count",
  dead_website: "Website unreachable",
  invalid_phone: "Invalid phone number",
  missing_phone: "No phone number",
  no_rating: "No Google rating",
  possible_duplicate: "Possible duplicate",
};
