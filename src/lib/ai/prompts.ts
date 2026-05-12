import type { Lead } from "@/lib/utils/types";
import type { PlaybookData } from "./playbooks";

export interface GenerationContext {
  lead: Lead;
  playbook: PlaybookData;
  agencyName: string;
  portfolioUrl?: string | null;
}

// ── System prompt ─────────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: GenerationContext): string {
  const { playbook, agencyName, portfolioUrl } = ctx;

  const objectionLines = Object.entries(playbook.objection_responses)
    .map(([trigger, response]) => `  If they say "${trigger}": ${response}`)
    .join("\n");

  const pricingLines = Object.entries(playbook.pricing_tiers)
    .map(([tier, data]) => `  ${tier}: ${data.description} (${data.price_range})`)
    .join("\n");

  const playbookBlock = `Niche: ${playbook.niche_label}
Pain points: ${playbook.pain_points}
Hook: "${playbook.hook}"
Content angles: ${playbook.content_angles.join(", ")}
Common objections:
${objectionLines}
Pricing context:
${pricingLines}`;

  return `You are a client acquisition specialist working for a creative agency that produces video content, photography, and marketing campaigns for local businesses.

Your job is to generate outreach materials that feel personal, specific, and human. Not generic. Not salesy. Not corporate.

Rules:
- Never use em dashes. Use commas, periods, or colons instead.
- Never say "I hope this email finds you well" or any variation.
- Never use "synergy", "leverage", "unlock", "game-changer", or similar buzzwords.
- Keep emails under 200 words. Shorter is better.
- Reference specific observations about the business (no video, strong reviews, etc).
- The goal is always to book a 15-minute call. Never hard sell.
- Write like a real person, not a template.

Niche context:
${playbookBlock}

Agency info:
Name: ${agencyName}
Portfolio: ${portfolioUrl ?? "Not provided"}`;
}

// ── Observation generator (rule-based, no AI) ─────────────────────────────────

export function generateObservations(lead: Lead): string[] {
  const obs: string[] = [];

  if (!lead.has_video_content) {
    obs.push(`${lead.name} has no video content on their website or social media.`);
  }
  if (lead.has_video_content && lead.website_quality === "outdated") {
    obs.push(`${lead.name} has some video but their website looks dated. There is an upgrade opportunity.`);
  }
  if (lead.review_count > 100) {
    obs.push(
      `${lead.name} has ${lead.review_count} Google reviews with a ${lead.rating} rating, indicating strong customer satisfaction.`
    );
  }
  if (lead.runs_google_ads || lead.runs_meta_ads) {
    obs.push(`${lead.name} is already spending on digital advertising, confirming they have marketing budget.`);
  }
  if (lead.social_profiles.length > 0) {
    const ig = lead.social_profiles.find((s) => s.platform === "instagram");
    if (ig && ig.followers && ig.posts_per_week !== null && ig.posts_per_week < 3) {
      obs.push(
        `${lead.name} has ${ig.followers.toLocaleString()} Instagram followers but posts inconsistently (${ig.posts_per_week}x per week).`
      );
    }
  }
  if (lead.competitors.length > 0) {
    const withVideo = lead.competitors.filter((c) => c.has_video);
    if (withVideo.length > 0) {
      obs.push(
        `${withVideo.length} of ${lead.competitors.length} competitors in the area already have video content.`
      );
    }
  }

  return obs;
}

// ── Minimal lead snapshot sent to AI (avoids leaking internal IDs) ─────────────

interface LeadSnapshot {
  name: string;
  city: string;
  state: string;
  country: string;
  niche: string;
  rating: number | null;
  review_count: number;
  has_video: boolean;
  has_blog: boolean;
  website: string | null;
  website_quality: string | null;
  social_platforms: string[];
  runs_ads: boolean;
  competitor_names: string[];
  score: number;
  tier: string;
}

function leadSnapshot(lead: Lead): LeadSnapshot {
  return {
    name: lead.name,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    niche: lead.niche_label,
    rating: lead.rating,
    review_count: lead.review_count,
    has_video: lead.has_video_content,
    has_blog: lead.has_blog,
    website: lead.website,
    website_quality: lead.website_quality,
    social_platforms: lead.social_profiles.map((s) => s.platform),
    runs_ads: lead.runs_google_ads || lead.runs_meta_ads,
    competitor_names: lead.competitors.map((c) => c.name),
    score: lead.score,
    tier: lead.tier,
  };
}

// ── Prompt templates ───────────────────────────────────────────────────────────

export function coldEmailPrompt(lead: Lead, observations: string[]): string {
  return `Generate a cold email for this business.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Key observations to reference:
${observations.join("\n")}

Requirements:
- Subject line (under 8 words, no clickbait)
- Body (under 200 words)
- Must reference at least one specific observation about the business
- End with a soft CTA (15-minute call, no pressure)
- Sign off with the agency name

Return as JSON: { "subject": "...", "body": "..." }`;
}

export function callScriptPrompt(lead: Lead, observations: string[]): string {
  return `Generate a cold call script for this business.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Key observations:
${observations.join("\n")}

Structure:
1. Opening (10 seconds, introduce yourself)
2. Hook (15 seconds, the one-line pitch from the playbook)
3. Problem (15 seconds, reference their specific situation)
4. Offer (15 seconds, what you produce for their niche)
5. Close (book a 15-minute Zoom)
6. Three objection handlers with specific responses

Keep the total script under 400 words. Write it as a readable script with clear section headers.`;
}

export function followUpPrompt(lead: Lead, originalSubject: string): string {
  return `Generate a 3-email follow-up sequence for this lead.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Original cold email subject: ${originalSubject}

Sequence:
- Day 3: Short, casual follow-up. Reference the original email. Under 80 words.
- Day 7: Value-add email. Share a relevant insight or stat about their niche. Under 120 words.
- Day 14: Final touch. Graceful close. Leave the door open. Under 80 words.

Return as JSON array: [{ "day": 3, "subject": "...", "body": "..." }, ...]`;
}

export function contentPlanPrompt(lead: Lead): string {
  return `Generate a 90-day content strategy for this business.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Structure for each month:
- Theme and title
- Number of shoot days
- Posting schedule (frequency and days)
- Deliverables list (specific to their niche)
- Platform focus (which platforms and why)
- Goal for the month

Also include:
- Suggested pricing tiers (Starter, Growth, Premium)
- Platform strategy rationale

Return as JSON with structured data.`;
}

export function proposalPrompt(lead: Lead, observations: string[]): string {
  return `Generate a one-page pitch proposal for this business.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Key observations:
${observations.join("\n")}

Structure:
- executive_summary: 2-3 sentences on their opportunity
- gap_analysis: what they are currently missing
- proposed_solution: what the agency delivers
- expected_outcomes: tangible results they can expect
- proposed_package: name, deliverables, price range
- next_step: one clear call to action

Keep it concise, confident, and specific to their niche. Return as JSON with the above keys.`;
}

export function leadIntelPrompt(lead: Lead): string {
  return `Summarize this lead's sales potential in 2-3 sentences.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Be specific about why they are ${lead.tier} tier (score: ${lead.score}/100). Reference concrete signals. Focus on the biggest opportunity and biggest risk. Plain text, no headers, no bullet points.`;
}
