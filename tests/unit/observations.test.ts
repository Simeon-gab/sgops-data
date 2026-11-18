import { test } from "node:test";
import assert from "node:assert/strict";
import { generateObservations, coldEmailPrompt } from "@/lib/ai/prompts";
import type { CampaignPlaybook, Lead, LeadResearch, SenderProfile } from "@/lib/utils/types";

// Observations are the only things an outreach message is allowed to say about
// a business. Each test here is a claim that must not be made without proof.

function lead(over: Partial<Lead> = {}): Lead {
  return {
    name: "Harvest Table Foods",
    niche_id: "food_bev_manufacturing",
    niche_label: "Food & Beverage Manufacturers",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    website: "https://harvesttable.example",
    rating: 4.4,
    review_count: 60,
    has_video_content: false,
    has_blog: false,
    website_quality: "minimal",
    social_profiles: [],
    runs_google_ads: false,
    runs_meta_ads: false,
    competitors: [],
    years_in_business: null,
    estimated_employees: null,
    business_signals: [],
    research: null,
    score: 0,
    tier: "unscored",
    source: "google_places",
    enriched_at: null,
    ...over,
  } as Lead;
}

function profile(goal: SenderProfile["goal"]): SenderProfile {
  return {
    goal,
    sender_name: "Ada Obi",
    sender_role: "Video producer",
    organization: null,
    offer: "Product videos for food brands",
    audience: "Food manufacturers in Lagos",
    credibility: null,
    cta: "A 15-minute call",
    tone: "direct",
    scoring_profile: "digital_presence",
    website: null,
    onboarded: true,
  };
}

const research = (over: Partial<LeadResearch> = {}): LeadResearch => ({
  website_read: true,
  checked_at: "2026-11-18T00:00:00.000Z",
  facts: [],
  ...over,
});

const texts = (l: Lead, goal: SenderProfile["goal"] = "win_clients") =>
  generateObservations(l, profile(goal)).map((o) => o.text);

test("a lead that was never enriched yields nothing about its website", () => {
  assert.deepEqual(texts(lead()), []);
});

test("a lead enriched before evidence was recorded yields nothing about its website", () => {
  // has_video_content is false and enriched_at is set, which used to be enough
  // to tell the business it had no video.
  const legacy = lead({ enriched_at: "2026-08-01T00:00:00.000Z", research: null });
  assert.deepEqual(texts(legacy), []);
});

test("missing video is only said when the website was actually read", () => {
  const unread = lead({
    enriched_at: "2026-11-18T00:00:00.000Z",
    research: research({ website_read: false }),
  });
  assert.ok(!texts(unread).some((t) => /video/i.test(t)));

  const read = lead({ enriched_at: "2026-11-18T00:00:00.000Z", research: research() });
  assert.ok(texts(read).some((t) => /^No video was found/.test(t)));
});

test("a recorded fact comes through with its source and its proof", () => {
  const l = lead({
    enriched_at: "2026-11-18T00:00:00.000Z",
    research: research({
      facts: [
        {
          key: "hiring",
          statement: "Their website links to a careers or jobs page",
          source_url: "https://harvesttable.example",
          evidence: 'Link "Careers" to https://harvesttable.example/careers',
        },
      ],
    }),
  });

  const [obs] = generateObservations(l, profile("find_job"));

  assert.equal(obs.text, "Their website links to a careers or jobs page.");
  assert.equal(obs.source_url, "https://harvesttable.example");
  assert.match(obs.evidence!, /Careers/);
});

test("observations are filtered by what the sender is doing", () => {
  const l = lead({
    enriched_at: "2026-11-18T00:00:00.000Z",
    has_video_content: true,
    research: research({
      facts: [
        { key: "video", statement: "Their website has video on the homepage", source_url: "u", evidence: "YouTube embed" },
        { key: "google_ads", statement: "They are running a Google search ad for their own website", source_url: "u", evidence: "Ad" },
        { key: "hiring", statement: "Their website says they are hiring", source_url: "u", evidence: "now hiring" },
      ],
    }),
  });

  assert.equal(texts(l, "win_clients").length, 3);
  assert.deepEqual(texts(l, "find_job"), ["Their website says they are hiring."]);
  assert.equal(texts(l, "sell_product").length, 2, "ads and hiring, not video");
});

test("reviews are stated as figures, with no verdict attached", () => {
  const busy = lead({ review_count: 1240, rating: 3.1 });
  const [text] = texts(busy);

  assert.equal(text, "Their Google listing shows 1,240 reviews and a 3.1 rating.");
  assert.ok(!/satisf|strong|great/i.test(text), "1,240 reviews at 3.1 is not customer satisfaction");
});

test("a missing website is only a finding when the listing came from Google", () => {
  assert.ok(texts(lead({ website: null })).includes("Their Google listing has no website on it."));
  assert.deepEqual(
    texts(lead({ website: null, source: "openstreetmap" })),
    [],
    "OpenStreetMap leaving a website off says nothing about the business"
  );
});

// ── The prompt built from them ───────────────────────────────────────────────

const playbook = {
  niche_id: "food_bev_manufacturing",
  niche_label: "Food & Beverage Manufacturers",
  audience_context: "",
  pain_points: "",
  value_angles: [],
  hook: "",
  objection_responses: {},
  offer_tiers: null,
} as CampaignPlaybook;

test("with nothing verified, the email is told not to claim it noticed anything", () => {
  const l = lead({ review_count: 3 });
  const prompt = coldEmailPrompt({ lead: l, profile: profile("find_job"), playbook }, []);

  assert.match(prompt, /do not claim to have noticed anything about them/);
  assert.match(prompt, /Verified observations[^\n]*\nNone\./);
});

test("an unread website is reported to the model as unknown, never as false", () => {
  const l = lead({
    enriched_at: "2026-11-18T00:00:00.000Z",
    research: research({ website_read: false }),
  });
  const prompt = coldEmailPrompt({ lead: l, profile: profile("win_clients"), playbook }, []);

  assert.match(prompt, /"has_video": "unknown"/);
  assert.match(prompt, /"website_quality": "unknown"/);
});

test("the email has no proof point to invent when the sender gave none", () => {
  const l = lead();
  const without = coldEmailPrompt({ lead: l, profile: profile("win_clients"), playbook }, []);
  assert.match(without, /make no claims about past results/);

  const withProof = coldEmailPrompt(
    { lead: l, profile: { ...profile("win_clients"), credibility: "40 brands served" }, playbook },
    []
  );
  assert.match(withProof, /one proof point from the sender's credibility/);
});
