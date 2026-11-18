import type { CampaignPlaybook, Lead, OutreachGoal, SenderProfile } from "@/lib/utils/types";
import { siteUnverified } from "@/lib/engine/enricher";
import { citableContact, isFactCitable, isResearchStale } from "@/lib/utils/research";

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
- No filler. Every sentence must either say something true about the recipient, say what the sender does about it, or ask for the next step. If a sentence does none of these, delete it.
- Never open by introducing the sender. Who the sender is belongs in the sign-off.
- Keep emails between 60 and 120 words. Shorter is better.
- Only state things about the recipient that appear in the verified observations or the lead data. If there are none, say nothing specific about them rather than inventing something.
- Never invent credentials, results, numbers, or experience the sender did not provide.
- Always end by asking for the sender's desired next step. One ask only. Never hard sell.
- Write like a real person, not a template.

Tone: ${TONE_GUIDANCE[profile.tone]}

The sender:
${senderBlock}

Audience context:
${playbookBlock}`;
}

// ── Observation generator (rule-based, no AI) ─────────────────────────────────
// The only things an outreach message may say about a business. Each one is
// either a fact enrichment recorded with its proof, or a figure from the
// business's own listing. Nothing here is inferred, and nothing is an opinion:
// "their website looks dated" and "they clearly have budget" used to be in this
// list, and neither is something we can show the recipient if they ask.
//
// Observations are also filtered by goal. A job seeker does not care whether a
// hospital has video on its website.
//
// And by age. A fact is true on the day it was seen, so findings that expire (a
// vacancy, an ad, something missing from a website) are held back once the
// research is more than a month old. See lib/utils/research.ts.

export interface Observation {
  text: string;
  // Where a person can check it.
  source: string;
  source_url: string | null;
  // The exact text or link behind it, when enrichment captured one.
  evidence: string | null;
}

const FACTS_FOR_EVERY_GOAL = new Set([
  "hiring", "multiple_locations", "recently_opened", "recently_renovated",
  "award_winning", "founded",
]);

const ENRICHMENT_SOURCE = "Their website and search results, checked during enrichment";

export function generateObservations(
  lead: Lead,
  profile: SenderProfile,
  now: Date = new Date()
): Observation[] {
  const obs: Observation[] = [];
  const goal = profile.goal;
  const isMarketingSeller = goal === "win_clients";
  const isBuyerFocused = goal === "sell_product" || goal === "partnership";
  const fromGoogle = lead.source === "google_places" || lead.source === "serpapi";
  const research = lead.enriched_at !== null ? lead.research : null;

  // ── Facts recorded by enrichment, each with its proof ──────────────────────

  for (const fact of research?.facts ?? []) {
    const relevant =
      FACTS_FOR_EVERY_GOAL.has(fact.key) ||
      (isMarketingSeller &&
        (fact.key === "video" || fact.key === "blog" || fact.key.startsWith("social:"))) ||
      ((isMarketingSeller || isBuyerFocused) && fact.key === "google_ads");
    if (!relevant) continue;
    if (!isFactCitable(fact.key, research!, now)) continue;

    obs.push({
      text: `${fact.statement}.`,
      source: ENRICHMENT_SOURCE,
      source_url: fact.source_url,
      evidence: fact.evidence,
    });
  }

  // ── Figures from their public listing ──────────────────────────────────────

  if (lead.review_count >= 100 && lead.rating !== null) {
    obs.push({
      text: `Their ${fromGoogle ? "Google " : ""}listing shows ${lead.review_count.toLocaleString("en")} reviews and a ${lead.rating} rating.`,
      source: fromGoogle ? "Google Maps listing" : "Imported listing data",
      source_url: null,
      evidence: null,
    });
  }

  // ── Things that are missing ────────────────────────────────────────────────
  // An absence is only a finding when we looked properly. These need a readable
  // website (or a Google listing with no website on it at all), and they are
  // worded as what was found, not as a verdict on the business.

  if (isMarketingSeller) {
    if (!lead.website && fromGoogle) {
      obs.push({
        text: "Their Google listing has no website on it.",
        source: "Google Maps listing",
        source_url: null,
        evidence: null,
      });
    }
    if (research?.website_read && !lead.has_video_content && !isResearchStale(research, now)) {
      obs.push({
        text: "No video was found on their homepage, and no Instagram, TikTok or YouTube profile could be tied to them.",
        source: ENRICHMENT_SOURCE,
        source_url: lead.website,
        evidence: null,
      });
    }
  }

  return obs;
}

function observationList(observations: Observation[], none: string): string {
  if (observations.length === 0) return none;
  return observations
    .map((o, i) => `[${i + 1}] ${o.text}${o.evidence ? ` (seen: ${o.evidence})` : ""}`)
    .join("\n");
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

function leadSnapshot(lead: Lead, now: Date = new Date()): LeadSnapshot {
  const enriched = lead.enriched_at !== null;
  // Enrichment ran and recorded what it saw. Leads enriched before evidence
  // was kept have research = null, and their findings are not trusted.
  const researched = enriched && lead.research !== null;
  // What a website does or does not contain is only known when it was read. A
  // lead with no website has nothing to read, so that much is known too.
  const siteRead = researched && !siteUnverified(lead.website, lead.research);
  // Research older than a month no longer vouches for anything that can
  // change, so those fields go back to "unknown" until the lead is rechecked.
  const fresh = researched && !isResearchStale(lead.research, now);
  const siteKnown = siteRead && fresh;

  return {
    name: lead.name,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    niche: lead.niche_label,
    rating: lead.rating,
    review_count: lead.review_count,
    enriched,
    // Anything not actually checked is reported as "unknown" so the model
    // cannot mistake a blank for a "no".
    has_video: siteKnown ? lead.has_video_content : "unknown",
    has_blog: siteKnown ? lead.has_blog : "unknown",
    website: lead.website,
    website_quality: siteKnown ? lead.website_quality : "unknown",
    social_platforms: researched ? lead.social_profiles.map((s) => s.platform) : "unknown",
    runs_ads: fresh ? lead.runs_google_ads || lead.runs_meta_ads : "unknown",
    business_signals: siteKnown ? lead.business_signals : "unknown",
    years_in_business: siteRead ? lead.years_in_business : "unknown",
    estimated_employees: researched ? lead.estimated_employees : "unknown",
    competitor_names: lead.competitors.map((c) => c.name),
    score: lead.score,
    tier: lead.tier,
  };
}

// Shared accuracy contract. Every prompt that shows the model lead data must
// include this, otherwise unchecked fields get reported as confirmed absences.
const ACCURACY_RULES = `Accuracy rules (follow strictly):
- The lead JSON and the verified observations are the ONLY things you know about this organization. Do not invent facts or infer signals that are not present.
- A field set to "unknown" means it was NOT checked. Never describe an "unknown" field as a lack or absence.
- Report a signal as absent ONLY when "enriched" is true AND that field is explicitly false or empty. Even then, phrase it as "no X detected" rather than as certain fact, because detection can miss off-site profiles.`;

// ── Prompt templates ───────────────────────────────────────────────────────────

// The cold email is built to be read in a few seconds by someone who did not
// ask for it. The shape is fixed: one true thing about them, why it matters,
// what the sender does about it, one question. Nothing comes before the first
// of those, because the first line is also what shows in the inbox preview, and
// a preview that reads "My name is..." is how cold email gets deleted unopened.
//
// The ask is phrased as a question about interest rather than a request for
// time. Gong's analysis of 304,174 sales emails found interest-based asks the
// best performing call to action on a cold first touch; asking for a specific
// slot only wins later, once a conversation exists.
export function coldEmailPrompt(
  ctx: GenerationContext,
  observations: Observation[],
  now: Date = new Date()
): string {
  const { lead, profile } = ctx;
  // A first name is used only when enrichment proved one and it is recent.
  // Otherwise the team is greeted, which is never wrong.
  const contact = citableContact(lead.enriched_at !== null ? lead.research : null, now);
  const greeting = contact
    ? `"Hi ${contact.first_name}," on its own line. Use the first name exactly as written and do not mention their job title or how their name was found.`
    : `"Hi ${lead.name} team," on its own line.`;
  const signOff = [profile.sender_name, profile.sender_role, profile.organization]
    .filter(Boolean)
    .join(", ");

  const opener = observations.length
    ? `Opener: one sentence stating ONE of the verified observations in plain words. Pick the one most relevant to what the sender offers. State it as something noticed, not as praise and not as criticism. Add nothing to it: no detail, cause or consequence that the observation itself does not state.`
    : `Opener: there are no verified observations about this business, so do not claim to have noticed anything about them. Open with one sentence about a situation ${lead.niche_label.toLowerCase()} in ${lead.city} commonly face, taken from the audience context, phrased as general and not as a fact about ${lead.name}.`;

  const proof = profile.credibility
    ? "Include one proof point from the sender's credibility, using only the figures given."
    : "The sender gave no proof points, so make no claims about past results.";

  return `Write a cold email to ${lead.name}.

Lead data:
${JSON.stringify(leadSnapshot(lead, now), null, 2)}

Verified observations (the only specific things you may say about them):
${observationList(observations, "None.")}

${ACCURACY_RULES}

Write the body in exactly this order, as short plain paragraphs with a blank line between them:
1. Greeting: ${greeting}
2. ${opener}
3. Bridge: one sentence on what that commonly costs businesses like theirs, or makes possible for them. This is your reasoning, not something you know about them, so word it as general ("often", "can", "tends to") and never as a fact about this business.
4. Offer: one or two sentences on what the sender does about it. ${proof}
5. Ask: one question that checks whether they are interested in this next step: ${profile.cta}. Make it easy to answer in one line. Ask once.
6. Sign-off: ${signOff}

Hard limits:
- Body between 60 and 120 words, counting everything from the greeting to the sign-off.
- The sentence after the greeting must be about them. It must not start with "I", "My", "We" or "Our", and must not contain "my name is", "I am reaching out", "I wanted to", "I came across", "I hope", or "just".
- No compliments that are not one of the verified observations.
- No bullet points, no bold, no headings, no placeholders in brackets.
- ${profile.website ? `At most one link, and only this one: ${profile.website}` : "No links."}
- Subject line: 2 to 5 words, specific to them, sentence case, no exclamation marks, never "quick question". It must not state or imply a problem they have not been verified to have.

Return as JSON: { "subject": "...", "body": "...", "observation_used": <the number of the observation you opened with, or null> }`;
}

export function callScriptPrompt(ctx: GenerationContext, observations: Observation[]): string {
  const { lead, profile } = ctx;

  return `Write a cold call script for contacting ${lead.name}.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Verified observations (the only specific things you may say about them):
${observationList(observations, "None. Do not claim to have noticed anything specific about them.")}

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
- Day 3: Two or three sentences. Restate the single most useful point of the original email in new words, then repeat the ask. Under 60 words.
- Day 7: One new, relevant point about their sector that the first email did not make, drawn from the audience context, then the ask. Under 90 words.
- Day 14: Final note. Say this is the last message and leave the door open, with no guilt. Under 50 words.

Every email must add something. Never write "just checking in", "bumping this", "following up on my last email", or "did you see my email". Never open by introducing the sender. Do not state anything about the business that is not in the lead data.

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

export function proposalPrompt(ctx: GenerationContext, observations: Observation[]): string {
  const { lead, profile } = ctx;
  const who = profile.organization ?? profile.sender_name;

  return `Write a one-page proposal from ${who} to ${lead.name}.

Lead data:
${JSON.stringify(leadSnapshot(lead), null, 2)}

Verified observations (the only specific things you may say about them):
${observationList(observations, "None. Do not claim to have noticed anything specific about them.")}

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
