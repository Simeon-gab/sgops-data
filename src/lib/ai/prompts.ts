import type { CampaignPlaybook, Lead, OutreachGoal, SenderProfile } from "@/lib/utils/types";

export interface GenerationContext {
  lead: Lead;
  profile: SenderProfile;
  playbook: CampaignPlaybook;
}

// ── Tone and goal framing ─────────────────────────────────────────────────────

const TONE_GUIDANCE: Record<SenderProfile["tone"], string> = {
  direct:
    "Short, plain sentences. No preamble. Make the point in the first line and stop when it is made.",
  warm:
    "Friendly and human, still brief. It should read like a real person who actually looked them up.",
  formal:
    "Professional register. No slang, no contractions that read as casual. Respectful without being stiff.",
  casual:
    "Relaxed and conversational, like writing to a peer. Specific, never sloppy.",
};

// What the message is actually for. This is the single most important framing:
// a job seeker who sounds like a vendor gets deleted, and so does a vendor who
// sounds like they want a favour.
const GOAL_FRAMING: Record<OutreachGoal, string> = {
  win_clients:
    "You are reaching out to win this business as a client for a service. You are selling, so lead with what they get, not with what you want.",
  find_job:
    "You are reaching out about working at this organization. You are asking for an opportunity, not selling a service. Never pitch them a product, never quote a price, never imply you are a vendor. Lead with what you can contribute to their team.",
  sell_product:
    "You are reaching out to sell a product. Lead with the specific problem it removes for them, not with features.",
  partnership:
    "You are proposing a mutual partnership. Both sides gain something. Do not position yourself as a vendor or as someone asking for a favour.",
  research:
    "You are requesting information or a short conversation for research. You are not selling anything and must not imply otherwise.",
  custom:
    "Follow exactly what the sender says they are offering or asking for. Do not assume they are selling a service.",
};

// ── System prompt ─────────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: GenerationContext): string {
  const { profile, playbook } = ctx;

  const objectionLines = Object.entries(playbook.objection_responses)
    .map(([trigger, response]) => `  If they say "${trigger}": ${response}`)
    .join("\n");

  const tierLines = playbook.offer_tiers?.length
    ? playbook.offer_tiers
        .map(
          (t) =>
            `  ${t.name}: ${t.description}${t.price_range ? ` (${t.price_range})` : ""}`
        )
        .join("\n")
    : null;

  const playbookBlock = [
    `Audience: ${playbook.niche_label}`,
    playbook.audience_context && `How this audience operates: ${playbook.audience_context}`,
    playbook.pain_points && `What they need: ${playbook.pain_points}`,
    playbook.hook && `Hook: "${playbook.hook}"`,
    playbook.value_angles.length && `Angles that land: ${playbook.value_angles.join(", ")}`,
    objectionLines && `Common objections:\n${objectionLines}`,
    tierLines && `What the sender can offer:\n${tierLines}`,
  ]
    .filter(Boolean)
    .join("\n");

  const senderBlock = [
    `Name: ${profile.sender_name}`,
    `Role: ${profile.sender_role}`,
    profile.organization && `Organization: ${profile.organization}`,
    `Offering or asking for: ${profile.offer}`,
    profile.credibility && `Credibility: ${profile.credibility}`,
    profile.website && `Link: ${profile.website}`,
    `Desired next step: ${profile.cta}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You write outreach on behalf of the person described below. Your job is to produce messages that feel personal, specific, and human. Not generic. Not salesy. Not corporate.

${GOAL_FRAMING[profile.goal]}

Rules:
- Never use em dashes. Use commas, periods, or colons instead.
- Never say "I hope this email finds you well" or any variation.
- Never use "synergy", "leverage", "unlock", "game-changer", or similar buzzwords.
- Keep emails under 200 words. Shorter is better.
- Reference a specific, verifiable observation about the recipient.
- Never invent credentials, results, numbers, or experience the sender did not provide.
- Never state a fact about the recipient that is not in the data given to you.
- Always end by asking for the sender's desired next step. Never hard sell.
- Write like a real person, not a template.

Tone: ${TONE_GUIDANCE[profile.tone]}

The sender:
${senderBlock}

Audience context:
${playbookBlock}`;
}

// ── Observation generator (rule-based, no AI) ─────────────────────────────────
// Only emits observations that are true given what has actually been checked,
// and only ones that matter for this sender's goal. A job seeker does not care
// whether a hospital has video on its website.

export function generateObservations(lead: Lead, profile: SenderProfile): string[] {
  const obs: string[] = [];
  const enriched = lead.enriched_at !== null;
  const goal = profile.goal;
  const isMarketingSeller = goal === "win_clients";
  const isBuyerFocused = goal === "sell_product" || goal === "partnership";

  // ── Signals that matter to every goal ──────────────────────────────────────

  if (enriched && lead.business_signals.includes("hiring")) {
    obs.push(`${lead.name} has hiring or careers language on their website.`);
  }
  if (enriched && lead.business_signals.includes("multiple_locations")) {
    obs.push(`${lead.name} operates multiple locations.`);
  }
  if (enriched && lead.business_signals.includes("recently_opened")) {
    obs.push(`${lead.name} appears to have opened recently.`);
  }
  if (enriched && lead.business_signals.includes("award_winning")) {
    obs.push(`${lead.name} advertises awards or recognition on their site.`);
  }
  if (lead.review_count > 100) {
    obs.push(
      `${lead.name} has ${lead.review_count} Google reviews with a ${lead.rating} rating, indicating strong customer satisfaction.`
    );
  }
  if (enriched && lead.years_in_business !== null && lead.years_in_business >= 3) {
    obs.push(`${lead.name} has been operating for around ${lead.years_in_business} years.`);
  }
  if (enriched && lead.estimated_employees !== null && lead.estimated_employees >= 5) {
    obs.push(`${lead.name} looks to have roughly ${lead.estimated_employees} staff.`);
  }

  // ── Marketing-opportunity signals ──────────────────────────────────────────

  if (isMarketingSeller && enriched) {
    if (!lead.has_video_content) {
      obs.push(`${lead.name} has no video content detected on their website or social media.`);
    }
    if (lead.has_video_content && lead.website_quality === "outdated") {
      obs.push(
        `${lead.name} has some video but their website looks dated. There is an upgrade opportunity.`
      );
    }
    const ig = lead.social_profiles.find((s) => s.platform === "instagram");
    if (ig && ig.followers && ig.posts_per_week !== null && ig.posts_per_week < 3) {
      obs.push(
        `${lead.name} has ${ig.followers.toLocaleString()} Instagram followers but posts inconsistently (${ig.posts_per_week}x per week).`
      );
    }
    const withVideo = lead.competitors.filter((c) => c.has_video);
    if (withVideo.length > 0) {
      obs.push(
        `${withVideo.length} of ${lead.competitors.length} competitors in the area already have video content.`
      );
    }
  }

  // ── Budget and buying-power signals ────────────────────────────────────────

  if ((isBuyerFocused || isMarketingSeller) && enriched) {
    if (lead.runs_google_ads || lead.runs_meta_ads) {
      obs.push(
        `${lead.name} is already spending on digital advertising, confirming they have marketing budget.`
      );
    }
  }
  if (isBuyerFocused && enriched && lead.website_quality === "modern") {
    obs.push(`${lead.name} runs a modern, actively maintained website.`);
  }

  return obs;
}

// ── Minimal lead snapshot sent to AI (avoids leaking internal IDs) ─────────────

// Digital-presence fields are "unknown" until the lead has been enriched.
// "unknown" must never be interpreted as "confirmed absent".
type Unknown = "unknown";

interface LeadSnapshot {
  name: string;
  city: string;
  state: string;
  country: string;
  niche: string;
  rating: number | null;
  review_count: number;
  enriched: boolean;
  has_video: boolean | Unknown;
  has_blog: boolean | Unknown;
  website: string | null;
  website_quality: string | Unknown | null;
  social_platforms: string[] | Unknown;
  runs_ads: boolean | Unknown;
  business_signals: string[] | Unknown;
  years_in_business: number | Unknown | null;
  estimated_employees: number | Unknown | null;
  competitor_names: string[];
  score: number;
  tier: string;
}

function leadSnapshot(lead: Lead): LeadSnapshot {
  const enriched = lead.enriched_at !== null;
  return {
    name: lead.name,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    niche: lead.niche_label,
    rating: lead.rating,
    review_count: lead.review_count,
    enriched,
    // Digital-presence signals are only trustworthy after enrichment. Before that
    // they are reported as "unknown" so the model cannot mistake a blank for a "no".
    has_video: enriched ? lead.has_video_content : "unknown",
    has_blog: enriched ? lead.has_blog : "unknown",
    website: lead.website,
    website_quality: enriched ? lead.website_quality : "unknown",
    social_platforms: enriched ? lead.social_profiles.map((s) => s.platform) : "unknown",
    runs_ads: enriched ? lead.runs_google_ads || lead.runs_meta_ads : "unknown",
    business_signals: enriched ? lead.business_signals : "unknown",
    years_in_business: enriched ? lead.years_in_business : "unknown",
    estimated_employees: enriched ? lead.estimated_employees : "unknown",
    competitor_names: lead.competitors.map((c) => c.name),
    score: lead.score,
    tier: lead.tier,
  };
}

// Shared accuracy contract. Every prompt that shows the model lead data must
// include this, otherwise unchecked fields get reported as confirmed absences.
const ACCURACY_RULES = `Accuracy rules (follow strictly):
- The lead JSON is the ONLY thing you know about this organization. Do not invent facts or infer signals that are not present.
- A field set to "unknown" means it was NOT checked. Never describe an "unknown" field as a lack or absence.
- Report a signal as absent ONLY when "enriched" is true AND that field is explicitly false or empty. Even then, phrase it as "no X detected" rather than as certain fact, because detection can miss off-site profiles.`;

// ── Prompt templates ───────────────────────────────────────────────────────────

export function coldEmailPrompt(ctx: GenerationContext, observations: string[]): string {
  const { lead, profile } = ctx;
  const signOff = profile.organization
    ? `${profile.sender_name}, ${profile.organization}`
    : profile.sender_name;

  return `Write a cold email to ${lead.name}.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Observations you may reference (only these, and only if relevant):
${observations.length ? observations.join("\n") : "None available. Reference only the lead data above, and keep it general rather than inventing detail."}

${ACCURACY_RULES}

Requirements:
- Subject line under 8 words, no clickbait
- Body under 200 words
- Reference at least one specific, true observation about them
- Close by asking for: ${profile.cta}
- Sign off as: ${signOff}

Return as JSON: { "subject": "...", "body": "..." }`;
}

export function callScriptPrompt(ctx: GenerationContext, observations: string[]): string {
  const { lead, profile } = ctx;

  return `Write a cold call script for contacting ${lead.name}.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Observations you may reference:
${observations.length ? observations.join("\n") : "None available."}

${ACCURACY_RULES}

Structure:
1. Opening (10 seconds, introduce ${profile.sender_name}, ${profile.sender_role})
2. Hook (15 seconds, the one-line reason for calling)
3. Relevance (15 seconds, reference their specific situation)
4. The ask (15 seconds, what ${profile.sender_name} offers or wants)
5. Close (ask for: ${profile.cta})
6. Three objection handlers with specific responses

Keep the total script under 400 words. Write it as a readable script with clear section headers.`;
}

export function followUpPrompt(ctx: GenerationContext, originalSubject: string): string {
  const { lead, profile } = ctx;

  return `Write a 3-email follow-up sequence to ${lead.name}.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Original email subject: ${originalSubject}
The ask: ${profile.cta}

${ACCURACY_RULES}

Sequence:
- Day 3: Short, casual follow-up. Reference the original email. Under 80 words.
- Day 7: Value-add email. Share a relevant insight about their situation. Under 120 words.
- Day 14: Final touch. Graceful close. Leave the door open. Under 80 words.

Return as JSON array: [{ "day": 3, "subject": "...", "body": "..." }, ...]`;
}

export function contentPlanPrompt(
  ctx: GenerationContext,
  options?: { services?: string[]; duration?: 30 | 60 | 90 }
): string {
  const { lead, profile } = ctx;
  const services = options?.services?.length
    ? options.services.join(", ")
    : profile.offer;
  const duration = options?.duration ?? 90;
  const who = profile.organization ?? profile.sender_name;

  return `Generate a ${duration}-day strategy proposal for ${lead.name}, written by ${who}.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Services being proposed: ${services}
Plan duration: ${duration} days

${ACCURACY_RULES}

This is a real sales proposal. Every section must be specific to ${lead.name}, their city (${lead.city}), their sector (${lead.niche_label}), and the services listed above. No generic filler.

Return ONLY valid JSON with this exact structure. All values must be strings or arrays of strings, never nested objects inside arrays:

{
  "executive_summary": "3-4 sentences. What problem ${who} solves for ${lead.name} and why now. Confident and direct.",
  "current_state": {
    "strengths": ["Concrete strength 1 from their data", "Concrete strength 2", "Concrete strength 3"],
    "weaknesses": ["Concrete weakness 1 from their data", "Concrete weakness 2", "Concrete weakness 3"]
  },
  "gap_analysis": ["Specific gap 1 for this business", "Specific gap 2", "Specific gap 3", "Specific gap 4"],
  "strategy": {
    "overview": "2-3 sentences on the overall strategic approach for this ${duration}-day engagement.",
    "by_service": [
      {
        "service": "Exact service name",
        "approach": "How this is approached specifically for ${lead.name} and their sector.",
        "specifics": ["Specific tactic 1", "Specific tactic 2", "Specific tactic 3", "Specific tactic 4"]
      }
    ],
    "content_calendar": "One paragraph describing how the work is structured and delivered across the ${duration} days."
  },
  "deliverables": [
    { "item": "Specific deliverable name", "timeline": "Week 1" },
    { "item": "Specific deliverable name", "timeline": "Week 2" }
  ],
  "pricing": {
    "starter": {
      "name": "Starter",
      "description": "Entry-level package for ${lead.name}",
      "includes": ["Deliverable 1", "Deliverable 2", "Deliverable 3"],
      "price": "Price with currency"
    },
    "growth": {
      "name": "Growth",
      "description": "Mid-tier package for scaling results",
      "includes": ["Everything in Starter", "Deliverable 4", "Deliverable 5", "Deliverable 6"],
      "price": "Price with currency"
    },
    "premium": {
      "name": "Premium",
      "description": "Full-service partnership",
      "includes": ["Everything in Growth", "Deliverable 7", "Deliverable 8", "Deliverable 9"],
      "price": "Price with currency"
    }
  },
  "kpis": [
    { "metric": "Metric name", "target": "Specific measurable target", "timeline": "30 days" }
  ]
}

Generate 6-8 deliverables and 5-6 KPIs. Price packages specific to the services selected: ${services}.`;
}

export function proposalPrompt(ctx: GenerationContext, observations: string[]): string {
  const { lead, profile } = ctx;
  const who = profile.organization ?? profile.sender_name;

  return `Write a one-page proposal from ${who} to ${lead.name}.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Observations you may reference:
${observations.length ? observations.join("\n") : "None available."}

${ACCURACY_RULES}

Structure:
- executive_summary: 2-3 sentences on their opportunity
- gap_analysis: what they are currently missing
- proposed_solution: what ${who} delivers
- expected_outcomes: tangible results they can expect
- proposed_package: name, deliverables, price range
- next_step: one clear call to action, specifically: ${profile.cta}

Keep it concise, confident, and specific. Return as JSON with the above keys.`;
}

export function leadIntelPrompt(ctx: GenerationContext): string {
  const { lead, profile } = ctx;
  const snapshot = leadSnapshot(lead);

  const question =
    profile.goal === "find_job"
      ? `whether ${lead.name} is a promising place to approach about work, and how best to approach them`
      : profile.goal === "research"
      ? `what this organization's data actually tells us, and what is still missing`
      : `this lead's potential for someone offering: ${profile.offer}`;

  return `In 2-3 sentences, summarize ${question}.

Lead data (JSON):
${JSON.stringify(snapshot, null, 2)}

${ACCURACY_RULES}
- An empty social_platforms array or has_video:false reflects what our scan found, not proof they have none.

Focus on the single biggest opportunity and the single biggest risk, grounded only in the data above. Plain text, no headers, no bullet points.`;
}
