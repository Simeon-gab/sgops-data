# AI Design — SgOps Data

## Overview

AI (Claude API) is used for four specific functions:
1. **Outreach generation** — cold emails, call scripts, follow-up sequences
2. **Content strategy** — 90-day plans, shot lists, platform strategy
3. **Lead intelligence summaries** — human-readable analysis of why a lead is hot/warm/cold
4. **Proposal generation** — one-page pitch documents

AI is NOT used for:
- Lead scoring (deterministic weighted formula)
- Data extraction (API calls to Google Places, SerpAPI)
- Data cleaning (rule-based pipeline)
- Email sending (Resend API)

This separation is intentional. Scoring and cleaning must be predictable, fast, and free. AI is reserved for tasks that require natural language generation and contextual reasoning.

## Model Selection

| Task | Model | Reason |
|---|---|---|
| Cold emails (individual) | claude-sonnet-4-20250514 | Quality matters for first impression |
| Call scripts | claude-sonnet-4-20250514 | Needs nuance in objection handling |
| Follow-up sequences | claude-haiku-4-5-20251001 | Faster, cheaper, simpler content |
| Content plans | claude-sonnet-4-20250514 | Strategic depth needed |
| Batch email generation (10+) | claude-haiku-4-5-20251001 | Cost efficiency at scale |
| Lead intelligence | claude-haiku-4-5-20251001 | Short summary, fast turnaround |
| Proposals | claude-sonnet-4-20250514 | Client-facing quality |

## Prompt Architecture

Every AI call uses this structure:

```
SYSTEM PROMPT
├── Role definition (you are an outreach specialist for creative agencies)
├── Niche playbook (injected based on lead's niche)
├── Tone constraints (no em dashes, conversational, not salesy)
└── Output format instructions

USER PROMPT
├── Lead data (structured JSON)
├── Agency context (name, portfolio URL)
├── Specific generation request
└── Any customization (tone, length, focus)
```

### System Prompt Template

```typescript
const SYSTEM_PROMPT = `You are a client acquisition specialist working for a creative agency that produces video content, photography, and marketing campaigns for local businesses.

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
${nichePlaybook}

Agency info:
Name: ${agencyName}
Portfolio: ${portfolioUrl || "Not provided"}`;
```

### Niche Playbook Injection

Each niche has a pre-built playbook injected into the system prompt:

```typescript
interface NichePlaybook {
  niche_id: string;
  niche_label: string;
  pain_points: string;
  content_angles: string[];
  hook: string;
  positioning: string;
  objections: {
    trigger: string;
    response: string;
  }[];
  pricing_context: string;
}
```

Example (restaurants):
```typescript
{
  niche_id: "restaurants",
  niche_label: "Restaurants & Bars",
  pain_points: "Empty tables during off-peak hours, low social media engagement, competing with delivery apps for direct orders, inability to convey atmosphere and experience online",
  content_angles: [
    "Menu showcase videos (hero dishes, seasonal specials)",
    "Chef spotlight and behind-the-scenes kitchen content",
    "Ambiance and interior reels that capture the dining experience",
    "Customer testimonial montages",
    "Seasonal promotional content tied to holidays and events"
  ],
  hook: "Your food looks incredible in person. Online, you're invisible. We fix that.",
  positioning: "Position video as the bridge between the in-person experience and the online first impression. Most diners check a restaurant online before visiting. If there's no video, they scroll past.",
  objections: [
    {
      trigger: "We rely on word of mouth",
      response: "Word of mouth is powerful. But it's slow and you can't control it. Video is word of mouth at scale. One great reel gets shared to thousands of people who would never have heard about you otherwise."
    },
    {
      trigger: "We already post on Instagram",
      response: "That's great. But phone photos of food, while authentic, don't stop the scroll. Professional content gets 3 to 5x more engagement. We don't replace what you're doing. We add a level that makes everything else work harder."
    }
  ],
  pricing_context: "Restaurants typically start at $1,500 to $2,000 for a single shoot day with 8 to 12 deliverables. Monthly retainers range from $1,500 (1 shoot/month) to $5,500 (weekly content)."
}
```

## Generation Prompts

### Cold Email

```typescript
const COLD_EMAIL_PROMPT = `Generate a cold email for this business.

Lead data:
${JSON.stringify(leadData, null, 2)}

Key observations to reference:
${observations.join("\n")}

Requirements:
- Subject line (under 8 words, no clickbait)
- Body (under 200 words)
- Must reference at least one specific observation about the business
- End with a soft CTA (15-minute call, no pressure)
- Sign off with the agency name

Return as JSON: { "subject": "...", "body": "..." }`;
```

### Call Script

```typescript
const CALL_SCRIPT_PROMPT = `Generate a cold call script for this business.

Lead data:
${JSON.stringify(leadData, null, 2)}

Structure:
1. Opening (10 seconds, introduce yourself)
2. Hook (15 seconds, the one-line pitch from the playbook)
3. Problem (15 seconds, reference their specific situation)
4. Offer (15 seconds, what you produce for their niche)
5. Close (book a 15-minute Zoom)
6. Three objection handlers with specific responses

Keep the total script under 400 words. Write it as a readable script with clear section headers.`;
```

### Follow-Up Sequence

```typescript
const FOLLOW_UP_PROMPT = `Generate a 3-email follow-up sequence for this lead.

Lead data:
${JSON.stringify(leadData, null, 2)}

Original cold email subject: ${originalSubject}

Sequence:
- Day 3: Short, casual follow-up. Reference the original email. Under 80 words.
- Day 7: Value-add email. Share a relevant insight or stat about their niche. Under 120 words.
- Day 14: Final touch. Graceful close. Leave the door open. Under 80 words.

Return as JSON array: [{ "day": 3, "subject": "...", "body": "..." }, ...]`;
```

### Content Plan

```typescript
const CONTENT_PLAN_PROMPT = `Generate a 90-day content strategy for this business.

Lead data:
${JSON.stringify(leadData, null, 2)}

Structure for each month:
- Theme/title
- Number of shoot days
- Posting schedule (frequency and days)
- Deliverables list (specific to their niche)
- Platform focus (which platforms and why)
- Goal for the month

Also include:
- Suggested pricing tiers (Starter, Growth, Premium)
- Platform strategy rationale

Return as JSON with structured data.`;
```

## Observation Generator

Before calling the AI for outreach, the system generates a list of specific observations about the lead. These are rule-based, not AI-generated:

```typescript
function generateObservations(lead: ScoredLead): string[] {
  const obs: string[] = [];

  if (!lead.has_video_content) {
    obs.push(`${lead.name} has no video content on their website or social media.`);
  }
  if (lead.has_video_content && lead.website_quality === "outdated") {
    obs.push(`${lead.name} has some video but their website looks dated. There's an upgrade opportunity.`);
  }
  if (lead.review_count > 100) {
    obs.push(`${lead.name} has ${lead.review_count} Google reviews with a ${lead.rating} rating, indicating strong customer satisfaction.`);
  }
  if (lead.runs_google_ads || lead.runs_meta_ads) {
    obs.push(`${lead.name} is already spending on digital advertising, confirming they have marketing budget.`);
  }
  if (lead.social_profiles.length > 0) {
    const ig = lead.social_profiles.find(s => s.platform === "instagram");
    if (ig && ig.followers && ig.posts_per_week !== null && ig.posts_per_week < 3) {
      obs.push(`${lead.name} has ${ig.followers.toLocaleString()} Instagram followers but posts inconsistently (${ig.posts_per_week}x per week).`);
    }
  }
  if (lead.competitors.length > 0) {
    const withVideo = lead.competitors.filter(c => c.has_video);
    if (withVideo.length > 0) {
      obs.push(`${withVideo.length} of ${lead.competitors.length} competitors in the area already have video content.`);
    }
  }

  return obs;
}
```

## Token Budget Management

To control costs:

```typescript
const TOKEN_BUDGETS = {
  cold_email: { max_tokens: 600, model: "claude-sonnet-4-20250514" },
  call_script: { max_tokens: 1000, model: "claude-sonnet-4-20250514" },
  follow_up_sequence: { max_tokens: 800, model: "claude-haiku-4-5-20251001" },
  content_plan: { max_tokens: 1500, model: "claude-sonnet-4-20250514" },
  lead_intelligence: { max_tokens: 300, model: "claude-haiku-4-5-20251001" },
  proposal: { max_tokens: 1200, model: "claude-sonnet-4-20250514" },
  batch_email: { max_tokens: 500, model: "claude-haiku-4-5-20251001" },
};
```

## Caching Strategy

AI-generated content is cached in `outreach_templates` table. If a user revisits a lead's email tab, the cached version is shown with a "Regenerate" button. Regeneration creates a new record (old one is not deleted, for A/B comparison).

## Batch Generation

For generating emails for 50+ leads at once:
1. Group leads by niche (same playbook context)
2. Use claude-haiku-4-5-20251001 for cost efficiency
3. Send requests in parallel (max 5 concurrent)
4. Stream results to the UI as they complete
5. Store all generated content in outreach_templates
6. Show progress bar (X of Y generated)
