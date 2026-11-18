import type { LeadResearch, ResearchContact } from "./types";

// How long a finding can be quoted to a business before it has to be checked
// again.
//
// Every fact is true on the day it was seen. Some stay true: a founding year, a
// second branch. Others expire quietly: a job opening closes, an ad campaign
// ends, the person named on the about page moves on. An email that opens on a
// vacancy filled six weeks ago tells the recipient the sender did not look.
//
// Pure functions with the clock passed in, so they can be used on the server
// and in the browser, and tested without waiting a month.

export const RESEARCH_MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// Findings that do not go out of date in a month.
const DURABLE_FACTS = new Set(["founded", "multiple_locations", "award_winning"]);

export function researchAgeDays(research: LeadResearch, now: Date = new Date()): number {
  const checked = Date.parse(research.checked_at);
  // A date that cannot be read is treated as very old, never as fresh.
  if (Number.isNaN(checked)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - checked) / DAY_MS));
}

export function isResearchStale(research: LeadResearch | null, now: Date = new Date()): boolean {
  if (!research) return false;
  return researchAgeDays(research, now) > RESEARCH_MAX_AGE_DAYS;
}

// True for a finding that may have stopped being true since it was seen.
export function isPerishableFact(key: string): boolean {
  return !DURABLE_FACTS.has(key) && !key.startsWith("social:");
}

// Whether a recorded fact may still be quoted in outreach.
export function isFactCitable(
  key: string,
  research: LeadResearch,
  now: Date = new Date()
): boolean {
  return !isPerishableFact(key) || !isResearchStale(research, now);
}

// The person to greet, or null when there is none we can still stand behind.
// People change jobs, so a contact expires with the rest.
export function citableContact(
  research: LeadResearch | null,
  now: Date = new Date()
): ResearchContact | null {
  if (!research?.contact) return null;
  return isResearchStale(research, now) ? null : research.contact;
}
