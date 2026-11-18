import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RESEARCH_MAX_AGE_DAYS,
  citableContact,
  isFactCitable,
  isPerishableFact,
  isResearchStale,
  researchAgeDays,
} from "@/lib/utils/research";
import type { LeadResearch } from "@/lib/utils/types";

// A fact is true on the day it was seen. These guard the rule for how long it
// may go on being quoted to the business it is about.

const CHECKED = "2026-11-18T09:00:00.000Z";
const daysLater = (n: number) => new Date(Date.parse(CHECKED) + n * 24 * 60 * 60 * 1000);

const research = (over: Partial<LeadResearch> = {}): LeadResearch => ({
  website_read: true,
  checked_at: CHECKED,
  facts: [],
  ...over,
});

test("research is fresh up to the limit and stale the day after", () => {
  assert.equal(researchAgeDays(research(), daysLater(0)), 0);
  assert.equal(isResearchStale(research(), daysLater(RESEARCH_MAX_AGE_DAYS)), false);
  assert.equal(isResearchStale(research(), daysLater(RESEARCH_MAX_AGE_DAYS + 1)), true);
});

test("no research is not stale research", () => {
  assert.equal(isResearchStale(null, daysLater(400)), false);
});

test("a date that cannot be read is treated as old, never as fresh", () => {
  assert.equal(isResearchStale(research({ checked_at: "not a date" }), daysLater(0)), true);
});

test("what expires and what does not", () => {
  for (const key of ["hiring", "google_ads", "recently_opened", "recently_renovated", "video", "blog"]) {
    assert.ok(isPerishableFact(key), `${key} can stop being true`);
  }
  for (const key of ["founded", "multiple_locations", "award_winning", "social:instagram"]) {
    assert.ok(!isPerishableFact(key), `${key} does not expire in a month`);
  }
});

test("a perishable fact is citable only while the research is fresh", () => {
  const old = daysLater(45);

  assert.equal(isFactCitable("hiring", research(), daysLater(3)), true);
  assert.equal(isFactCitable("hiring", research(), old), false);
  assert.equal(isFactCitable("founded", research(), old), true);
});

test("a contact expires with the research, because people change jobs", () => {
  const withContact = research({
    contact: {
      name: "Amaka Eze", first_name: "Amaka", role: "Managing Director",
      found_via: "website", source_url: "https://x.example/about", evidence: "Structured data",
    },
  });

  assert.equal(citableContact(withContact, daysLater(10))?.first_name, "Amaka");
  assert.equal(citableContact(withContact, daysLater(45)), null);
  assert.equal(citableContact(research(), daysLater(1)), null);
  assert.equal(citableContact(null), null);
});
