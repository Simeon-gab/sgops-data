// Outreach goals and the presets that drive onboarding.
//
// A sender profile answers three questions the AI layer used to have hardcoded:
// who is sending, what are they asking for, and who are they asking.
// Everything downstream (system prompt, observations, scoring weights,
// available generators) is derived from the goal.

import type { OutreachGoal, ScoringProfileId, SenderTone, GenerateType } from "./types";

export interface GoalPreset {
  goal: OutreachGoal;
  label: string;
  tagline: string;
  icon: string;
  // Onboarding copy: each field is asked in the sender's own language
  labels: {
    sender_role: string;
    organization: string;
    offer: string;
    audience: string;
    credibility: string;
    cta: string;
  };
  placeholders: {
    sender_role: string;
    organization: string;
    offer: string;
    audience: string;
    credibility: string;
    cta: string;
  };
  // Which generators make sense for this goal
  generators: GenerateType[];
  scoring_profile: ScoringProfileId;
  default_tone: SenderTone;
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    goal: "win_clients",
    label: "Find clients",
    tagline: "You sell a service and want more of the right customers.",
    icon: "briefcase",
    labels: {
      sender_role:  "What you do",
      organization: "Business name",
      offer:        "What you offer",
      audience:     "Who you want to reach",
      credibility:  "Why they should trust you",
      cta:          "What you want them to do next",
    },
    placeholders: {
      sender_role:  "Video producer and content strategist",
      organization: "Sunwave Studios",
      offer:        "Short-form video content and photography for local businesses, produced monthly on retainer",
      audience:     "Restaurants, hotels, and salons in Lagos with a weak social presence",
      credibility:  "40+ businesses served, 3 years running, portfolio at sunwave.co",
      cta:          "Book a 15-minute call",
    },
    generators: ["cold_email", "call_script", "follow_up", "content_plan", "proposal", "lead_intel"],
    scoring_profile: "digital_presence",
    default_tone: "direct",
  },
  {
    goal: "find_job",
    label: "Find a job or placement",
    tagline: "You want roles, internships, or placements at specific organizations.",
    icon: "target",
    labels: {
      sender_role:  "Your profession",
      organization: "Current or most recent employer",
      offer:        "What you bring",
      audience:     "Where you want to work",
      credibility:  "Your qualifications",
      cta:          "What you want them to do next",
    },
    placeholders: {
      sender_role:  "Medical laboratory scientist",
      organization: "Lagos University Teaching Hospital",
      offer:        "Clinical chemistry and haematology testing, quality control, and lab information systems",
      audience:     "Private hospitals and diagnostic laboratories in Abuja and Lagos",
      credibility:  "BMLS, licensed with MLSCN, 4 years in a 400-bed hospital lab",
      cta:          "A short conversation about openings on their team",
    },
    generators: ["cold_email", "call_script", "follow_up", "lead_intel"],
    scoring_profile: "hiring_intent",
    default_tone: "formal",
  },
  {
    goal: "sell_product",
    label: "Sell a product",
    tagline: "You have a product or software and want business buyers.",
    icon: "package",
    labels: {
      sender_role:  "Your role",
      organization: "Company name",
      offer:        "What you sell",
      audience:     "Who buys it",
      credibility:  "Proof it works",
      cta:          "What you want them to do next",
    },
    placeholders: {
      sender_role:  "Founder",
      organization: "StockPilot",
      offer:        "Inventory software that cuts stockouts for multi-branch retailers",
      audience:     "Supermarket chains and distributors with 3 or more locations",
      credibility:  "Used by 120 stores, average 18% reduction in stockouts",
      cta:          "A 20-minute demo",
    },
    generators: ["cold_email", "call_script", "follow_up", "proposal", "lead_intel"],
    scoring_profile: "business_maturity",
    default_tone: "direct",
  },
  {
    goal: "partnership",
    label: "Partnerships or sponsorship",
    tagline: "You want collaborations, sponsors, suppliers, or distribution deals.",
    icon: "handshake",
    labels: {
      sender_role:  "Your role",
      organization: "Your organization or project",
      offer:        "What you bring to the partnership",
      audience:     "Who you want to partner with",
      credibility:  "Your track record or reach",
      cta:          "What you want them to do next",
    },
    placeholders: {
      sender_role:  "Community lead",
      organization: "Lagos Tech Meetup",
      offer:        "Brand exposure to 2,000 developers across 12 events a year",
      audience:     "Software companies and fintechs hiring engineering talent",
      credibility:  "3 years running, past sponsors include two Series A startups",
      cta:          "A quick call to walk through the sponsorship tiers",
    },
    generators: ["cold_email", "call_script", "follow_up", "proposal", "lead_intel"],
    scoring_profile: "business_maturity",
    default_tone: "warm",
  },
  {
    goal: "research",
    label: "Research a market",
    tagline: "You want clean business data. No outreach yet.",
    icon: "search",
    labels: {
      sender_role:  "Your role",
      organization: "Your organization",
      offer:        "What you are researching",
      audience:     "Which businesses",
      credibility:  "Context (optional)",
      cta:          "Not used for research",
    },
    placeholders: {
      sender_role:  "Freelance market analyst",
      organization: "Independent",
      offer:        "Mapping pricing and digital presence across a sector",
      audience:     "Wholesalers and distributors in Kano",
      credibility:  "",
      cta:          "",
    },
    generators: ["lead_intel"],
    scoring_profile: "contactability",
    default_tone: "direct",
  },
  {
    goal: "custom",
    label: "Something else",
    tagline: "Describe it yourself and the system adapts.",
    icon: "sparkles",
    labels: {
      sender_role:  "Who you are",
      organization: "Your organization (optional)",
      offer:        "What you are offering or asking for",
      audience:     "Who you are reaching out to",
      credibility:  "Why they should take you seriously",
      cta:          "What you want them to do next",
    },
    placeholders: {
      sender_role:  "Independent consultant",
      organization: "",
      offer:        "Describe exactly what you can do for them",
      audience:     "Describe the businesses or people you want to contact",
      credibility:  "Experience, credentials, results, or references",
      cta:          "Reply to this email, book a call, and so on",
    },
    generators: ["cold_email", "call_script", "follow_up", "proposal", "lead_intel"],
    scoring_profile: "contactability",
    default_tone: "direct",
  },
];

const PRESET_MAP = new Map<OutreachGoal, GoalPreset>(
  GOAL_PRESETS.map((p) => [p.goal, p])
);

export function getGoalPreset(goal: OutreachGoal): GoalPreset {
  return PRESET_MAP.get(goal) ?? PRESET_MAP.get("custom")!;
}

export const TONES: { value: SenderTone; label: string; description: string }[] = [
  { value: "direct", label: "Direct", description: "Short, plain, gets to the point" },
  { value: "warm",   label: "Warm",   description: "Friendly and personal, still brief" },
  { value: "formal", label: "Formal", description: "Professional register, no slang" },
  { value: "casual", label: "Casual", description: "Relaxed and conversational" },
];

// Generators available for a goal. The API uses this to reject combinations
// that make no sense, such as a content strategy proposal for a job application.
export function generatorsForGoal(goal: OutreachGoal): GenerateType[] {
  return getGoalPreset(goal).generators;
}

export function supportsGenerator(goal: OutreachGoal, type: GenerateType): boolean {
  return generatorsForGoal(goal).includes(type);
}
