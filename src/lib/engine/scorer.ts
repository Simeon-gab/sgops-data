import type { CleanBusinessRecord, ScoreSignal, LeadTier } from "@/lib/utils/types";
import type { EnrichmentResult } from "./enricher";
import { SCORING_WEIGHTS, TIER_THRESHOLDS } from "@/lib/utils/constants";

export interface ScoreResult {
  score: number;
  tier: LeadTier;
  breakdown: ScoreSignal[];
}

// Thresholds
const LOW_REVIEW_THRESHOLD  = 50;
const HIGH_RATING_THRESHOLD = 4.5;

// ── Pure scoring function ─────────────────────────────────────────────────────
// No external I/O. Takes cleaned record + enrichment, returns score/tier/breakdown.
// Max possible score is exactly 100 when all positive, non-exclusive signals fire.

export function scoreLead(
  record: CleanBusinessRecord,
  enrichment: EnrichmentResult
): ScoreResult {
  const breakdown: ScoreSignal[] = [];
  let total = 0;

  function add(signal: keyof typeof SCORING_WEIGHTS, reason: string) {
    const points = SCORING_WEIGHTS[signal];
    breakdown.push({ signal, points, reason });
    total += points;
  }

  // No video content: the core opportunity signal
  if (!enrichment.has_video_content) {
    add("no_video_content", "No video content detected on website or embeds");
  }

  // Website signals (mutually exclusive: no_website vs outdated_website)
  if (!record.website.url) {
    add("no_website", "No website found, significant digital gap");
  } else if (enrichment.website_quality === "outdated") {
    add("outdated_website", "Website appears outdated, needs a refresh");
  }

  // Review count: low visibility = opportunity
  if (record.review_count < LOW_REVIEW_THRESHOLD) {
    add(
      "low_review_count",
      `Only ${record.review_count} review${record.review_count === 1 ? "" : "s"}, low online visibility`
    );
  }

  // No email: limited digital touchpoints
  if (!record.email.address) {
    add("no_email_found", "No contact email found online");
  }

  // Competitor advantage creates urgency
  const videoCompetitor = enrichment.competitors.find((c) => c.has_video);
  if (videoCompetitor) {
    add("competitor_has_video", `Competitor "${videoCompetitor.name}" already uses video`);
  }

  // Social signals (mutually exclusive: active_instagram vs no_social_presence)
  const hasInstagram = enrichment.social_profiles.some((p) => p.platform === "instagram");
  if (hasInstagram) {
    add("active_instagram", "Active on Instagram, already invested in visual content");
  } else if (enrichment.social_profiles.length === 0) {
    add("no_social_presence", "No social media profiles detected");
  }

  // High rating: successful business with budget to invest
  if (record.rating !== null && record.rating >= HIGH_RATING_THRESHOLD) {
    add("high_rating", `Rated ${record.rating}/5, an established business`);
  }

  // Blog: content-marketing minded, likely understands content ROI
  if (enrichment.has_blog) {
    add("has_blog", "Maintains a blog, already values content marketing");
  }

  // Running ads: harder sell — they already have a marketing partner
  if (enrichment.runs_google_ads || enrichment.runs_meta_ads) {
    const type =
      enrichment.runs_google_ads && enrichment.runs_meta_ads
        ? "Google and Meta ads"
        : enrichment.runs_google_ads
        ? "Google ads"
        : "Meta ads";
    add("runs_ads", `Running ${type}, likely already working with a marketing agency`);
  }

  const score = Math.max(0, Math.min(100, total));
  const tier: LeadTier =
    score >= TIER_THRESHOLDS.hot  ? "hot"  :
    score >= TIER_THRESHOLDS.warm ? "warm" :
    "cold";

  return { score, tier, breakdown };
}
