import type { CleanBusinessRecord, ScoreSignal, LeadTier } from "@/lib/utils/types";
import type { EnrichmentResult } from "./enricher";
import { getScoringProfile, type ScoringSignal } from "@/lib/utils/constants";

export interface ScoreResult {
  score: number;
  tier: LeadTier;
  breakdown: ScoreSignal[];
}

// Thresholds
const LOW_REVIEW_THRESHOLD   = 50;
const HIGH_REVIEW_THRESHOLD  = 100;
const HIGH_RATING_THRESHOLD  = 4.5;
const ESTABLISHED_YEARS      = 3;
const MIN_EMPLOYEES          = 5;

interface Candidate {
  signal: ScoringSignal;
  reason: string;
}

// ── Signal detection ──────────────────────────────────────────────────────────
// Detects every signal the data supports, independent of which ones the active
// scoring profile cares about. Mutually exclusive signals (no_website vs
// outdated_website, active_instagram vs no_social_presence) are resolved here,
// so at most one member of each group is ever emitted.

function detectSignals(
  record: CleanBusinessRecord,
  enrichment: EnrichmentResult
): Candidate[] {
  const out: Candidate[] = [];
  const add = (signal: ScoringSignal, reason: string) => out.push({ signal, reason });

  // Video
  if (!enrichment.has_video_content) {
    add("no_video_content", "No video content detected on website or embeds");
  }

  // Website (exclusive group)
  if (!record.website.url) {
    add("no_website", "No website found, significant digital gap");
  } else {
    add("has_website", "Has a live website");
    if (enrichment.website_quality === "outdated") {
      add("outdated_website", "Website appears outdated, needs a refresh");
    } else if (enrichment.website_quality === "modern") {
      add("modern_website", "Website is modern and actively maintained");
    }
  }

  // Reviews (exclusive group).
  // A source with no reputation data at all, OpenStreetMap being the one in the
  // chain, reports neither a rating nor a review count, and the cleaner stores
  // the missing count as zero. Treating that as "low online visibility" would
  // fire the signal on every OSM lead in the workspace and rank them by an
  // absence of data rather than by anything true about the business. No rating
  // and no reviews together means unknown; a rating with few reviews is a real
  // finding.
  const hasReviewData = record.rating !== null || record.review_count > 0;
  if (hasReviewData && record.review_count < LOW_REVIEW_THRESHOLD) {
    add(
      "low_review_count",
      `Only ${record.review_count} review${record.review_count === 1 ? "" : "s"}, low online visibility`
    );
  } else if (record.review_count >= HIGH_REVIEW_THRESHOLD) {
    add("high_review_volume", `${record.review_count} reviews, an established local presence`);
  }

  // Email (exclusive group)
  if (!record.email.address) {
    add("no_email_found", "No contact email found online");
  } else {
    add("has_email", "Contact email available");
    if (record.email.is_verified) {
      add("verified_email", "Email address is verified");
    }
  }

  // Phone
  if (record.phone.is_valid) {
    add("has_phone", "Valid phone number on file");
  }

  // Competitor advantage creates urgency
  const videoCompetitor = enrichment.competitors.find((c) => c.has_video);
  if (videoCompetitor) {
    add("competitor_has_video", `Competitor "${videoCompetitor.name}" already uses video`);
  }

  // Social (exclusive group)
  const hasInstagram = enrichment.social_profiles.some((p) => p.platform === "instagram");
  if (hasInstagram) {
    add("active_instagram", "Active on Instagram, already invested in visual content");
  } else if (enrichment.social_profiles.length === 0) {
    add("no_social_presence", "No social media profiles detected");
  }

  if (enrichment.social_profiles.some((p) => p.platform === "linkedin")) {
    add("has_linkedin", "Has a LinkedIn company page, reachable through professional channels");
  }

  // Rating
  if (record.rating !== null && record.rating >= HIGH_RATING_THRESHOLD) {
    add("high_rating", `Rated ${record.rating}/5, an established business`);
  }

  // Blog
  if (enrichment.has_blog) {
    add("has_blog", "Maintains a blog, already values content marketing");
  }

  // Ads. Weighted negatively for marketing sellers (they likely have an agency
  // already) and positively for product sellers (confirmed marketing budget).
  if (enrichment.runs_google_ads || enrichment.runs_meta_ads) {
    const type =
      enrichment.runs_google_ads && enrichment.runs_meta_ads
        ? "Google and Meta ads"
        : enrichment.runs_google_ads
        ? "Google ads"
        : "Meta ads";
    add("runs_ads", `Running ${type}, confirmed marketing spend`);
  }

  // Size and stability
  if (enrichment.years_in_business !== null && enrichment.years_in_business >= ESTABLISHED_YEARS) {
    add("established_business", `${enrichment.years_in_business} years in business`);
  }
  if (enrichment.estimated_employees !== null && enrichment.estimated_employees >= MIN_EMPLOYEES) {
    add("has_employees", `Estimated ${enrichment.estimated_employees} employees`);
  }

  // Signals scraped from the site copy
  if (enrichment.business_signals.includes("hiring")) {
    add("hiring_signal", "Careers or hiring language found on their website");
  }
  if (enrichment.business_signals.includes("multiple_locations")) {
    add("multiple_locations", "Operates multiple locations");
  }

  return out;
}

// ── Pure scoring function ─────────────────────────────────────────────────────
// No external I/O. Takes a cleaned record, enrichment, and the workspace's
// scoring profile, and returns score/tier/breakdown. Signals the profile does
// not weight are dropped, so the breakdown only ever explains this sender's
// definition of a good lead.

export function scoreLead(
  record: CleanBusinessRecord,
  enrichment: EnrichmentResult,
  scoringProfileId?: string | null
): ScoreResult {
  const profile = getScoringProfile(scoringProfileId);

  // "none" opts out of scoring entirely rather than scoring everything zero,
  // which would render every lead as a confirmed cold lead.
  if (profile.id === "none") {
    return { score: 0, tier: "unscored", breakdown: [] };
  }

  const breakdown: ScoreSignal[] = [];
  let total = 0;

  for (const { signal, reason } of detectSignals(record, enrichment)) {
    const points = profile.weights[signal];
    if (points === undefined || points === 0) continue;
    breakdown.push({ signal, points, reason });
    total += points;
  }

  const score = Math.max(0, Math.min(100, total));
  const tier: LeadTier =
    score >= profile.thresholds.hot  ? "hot"  :
    score >= profile.thresholds.warm ? "warm" :
    "cold";

  return { score, tier, breakdown };
}
