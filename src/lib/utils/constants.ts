import type { PipelineStage } from "./types";

export const NICHES = [
  { id: "restaurant", label: "Restaurants", icon: "🍽️" },
  { id: "hotel", label: "Hotels & Hospitality", icon: "🏨" },
  { id: "salon", label: "Hair & Beauty Salons", icon: "💇" },
  { id: "gym", label: "Gyms & Fitness Studios", icon: "🏋️" },
  { id: "dental", label: "Dental Clinics", icon: "🦷" },
  { id: "real_estate", label: "Real Estate Agencies", icon: "🏠" },
  { id: "law_firm", label: "Law Firms", icon: "⚖️" },
  { id: "auto_dealer", label: "Car Dealerships", icon: "🚗" },
  { id: "wedding_venue", label: "Wedding Venues", icon: "💒" },
  { id: "event_planner", label: "Event Planners", icon: "🎉" },
  { id: "contractor", label: "Contractors & Construction", icon: "🔨" },
  { id: "retail", label: "Retail Stores", icon: "🛍️" },
  { id: "medical", label: "Medical Clinics", icon: "🏥" },
  { id: "nightclub", label: "Nightclubs & Bars", icon: "🍸" },
  { id: "photography", label: "Photography Studios", icon: "📸" },
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

export const SCORING_WEIGHTS = {
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
} as const;

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
  no_website: "No website",
  low_reviews: "Low review count",
  dead_website: "Website unreachable",
  invalid_phone: "Invalid phone number",
  missing_phone: "No phone number",
  no_rating: "No Google rating",
  possible_duplicate: "Possible duplicate",
};
