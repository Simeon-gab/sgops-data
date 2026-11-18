import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { enrichLead, nameMatches, visibleText } from "@/lib/engine/enricher";
import { scoreLead } from "@/lib/engine/scorer";
import type { CleanBusinessRecord } from "@/lib/utils/types";

// Enrichment is the research behind every cold email. What it reports gets
// quoted to the business itself, so each of these guards a way it used to say
// something untrue: a website that never loaded reported as "has no video", a
// competitor's ad reported as the business's own, somebody else's Instagram
// attached to the lead, and a footer copyright year reported as the age of the
// company.

const realFetch = globalThis.fetch;

interface Stub {
  site?: string | Error | number; // HTML, a network failure, or an HTTP status
  serp?: (query: string) => unknown;
}

function stubFetch({ site, serp }: Stub) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.startsWith("https://serpapi.com/")) {
      const query = new URL(url).searchParams.get("q") ?? "";
      return new Response(JSON.stringify(serp ? serp(query) : {}), { status: 200 });
    }

    if (site instanceof Error) throw site;
    if (typeof site === "number") return new Response("", { status: site });
    return new Response(site ?? "", { status: 200, headers: { "content-type": "text/html" } });
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

function record(over: Partial<CleanBusinessRecord> = {}): CleanBusinessRecord {
  return {
    source: "google_places",
    name: "Harvest Table Foods",
    address: {
      street: "", city: "Lagos", state: "Lagos", zip: "", country: "Nigeria",
      country_code: "NG", full: "",
    },
    phone: { raw: "", formatted: "", country_code: "", is_valid: false },
    email: { address: null, source: null, is_verified: false, confidence: 0 },
    website: { url: "https://harvesttable.example", is_active: true, has_ssl: true },
    rating: 4.4,
    review_count: 60,
    category: "Food & Beverage Manufacturers",
    place_id: null,
    coordinates: null,
    data_quality: "partial",
    quality_issues: [],
    duplicate_hash: "",
    ...over,
  } as CleanBusinessRecord;
}

// Enough readable text that an empty finding means something.
const FILLER = "<p>" + "We make packaged foods for retailers across the region. ".repeat(8) + "</p>";

function page(body: string): string {
  return `<html><head><script>var jobs = ["careers"]; // established 1990</script></head><body>${FILLER}${body}</body></html>`;
}

const fact = (result: Awaited<ReturnType<typeof enrichLead>>, key: string) =>
  result.research?.facts.find((f) => f.key === key);

// ── A website that could not be read ─────────────────────────────────────────

test("a website that times out is unknown, not a business with nothing", async () => {
  stubFetch({ site: new Error("timeout") });

  const result = await enrichLead(record());

  assert.equal(result.research?.website_read, false);
  assert.equal(result.website_quality, null, "no verdict on a page nobody read");
  assert.deepEqual(result.research?.facts, []);
});

test("an error page is not read either", async () => {
  stubFetch({ site: 403 });
  const result = await enrichLead(record());
  assert.equal(result.research?.website_read, false);
});

test("a page that draws itself with scripts is not treated as an empty website", async () => {
  stubFetch({ site: `<html><body><div id="__next"></div><script src="/app.js"></script></body></html>` });

  const result = await enrichLead(record());

  assert.equal(result.research?.website_read, false, "there was nothing to read");
});

test("an unread website does not score as a business missing video", async () => {
  stubFetch({ site: new Error("timeout") });
  const unread = await enrichLead(record());
  const { breakdown } = scoreLead(record(), unread, "digital_presence");

  assert.ok(
    !breakdown.some((s) => s.signal === "no_video_content"),
    "a failed request must not make a lead hotter"
  );

  stubFetch({ site: page("") });
  const read = await enrichLead(record());
  const scored = scoreLead(record(), read, "digital_presence");

  assert.ok(
    scored.breakdown.some((s) => s.signal === "no_video_content"),
    "a website that was read and has no video still counts"
  );
});

// ── Findings carry their proof ───────────────────────────────────────────────

test("a careers link is reported with the link that proves it", async () => {
  stubFetch({ site: page(`<a href="/careers">Careers</a>`) });

  const result = await enrichLead(record());
  const hiring = fact(result, "hiring");

  assert.ok(result.business_signals.includes("hiring"));
  assert.ok(hiring);
  assert.match(hiring.evidence, /Careers/);
  assert.match(hiring.evidence, /https:\/\/harvesttable\.example\/careers/);
  assert.equal(hiring.source_url, "https://harvesttable.example");
});

test("words inside scripts are not evidence of anything", async () => {
  // The page helper puts "jobs", "careers" and "established 1990" in a script.
  stubFetch({ site: page("") });

  const result = await enrichLead(record());

  assert.equal(result.research?.website_read, true);
  assert.deepEqual(result.business_signals, []);
  assert.equal(result.years_in_business, null);
});

test("a founding year is taken only from a statement, never from the copyright line", async () => {
  stubFetch({ site: page(`<footer>&copy; 2012 Harvest Table Foods</footer>`) });
  const fromFooter = await enrichLead(record());
  assert.equal(fromFooter.years_in_business, null, "a copyright year is when the footer was edited");

  stubFetch({ site: page(`<p>Family owned and established in 1998.</p>`) });
  const stated = await enrichLead(record());

  assert.equal(stated.years_in_business, new Date().getFullYear() - 1998);
  assert.match(fact(stated, "founded")!.evidence, /established in 1998/);
  assert.match(fact(stated, "founded")!.statement, /since 1998/);
});

test("a tracking pixel is not a social profile", async () => {
  stubFetch({
    site: page(`
      <a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
      <a href="https://www.instagram.com/harvesttablefoods/">Instagram</a>
      <img src="https://www.facebook.com/tr?id=123" />
    `),
  });

  const result = await enrichLead(record());

  assert.deepEqual(result.social_profiles.map((p) => p.platform), ["instagram"]);
  assert.equal(result.social_profiles[0].url, "https://instagram.com/harvesttablefoods");
});

// ── Search results must be demonstrably theirs ───────────────────────────────

test("an ad on a search for their name only counts when it points at their site", async () => {
  stubFetch({
    site: page(""),
    serp: () => ({ ads: [{ title: "Rival Foods", link: "https://rivalfoods.example/offer" }] }),
  });
  const rival = await enrichLead(record(), { serpApiKey: "k" });
  assert.equal(rival.runs_google_ads, false, "a competitor bidding on their name is not their ad");

  stubFetch({
    site: page(""),
    serp: () => ({ ads: [{ title: "Harvest Table", link: "https://www.harvesttable.example/shop" }] }),
  });
  const own = await enrichLead(record(), { serpApiKey: "k" });

  assert.equal(own.runs_google_ads, true);
  assert.match(fact(own, "google_ads")!.evidence, /harvesttable\.example/);
});

test("a business with no website cannot have an ad attributed to it", async () => {
  stubFetch({ serp: () => ({ ads: [{ title: "Anything", link: "https://x.example" }] }) });

  const result = await enrichLead(
    record({ website: { url: null, is_active: false, has_ssl: false } }),
    { serpApiKey: "k" }
  );

  assert.equal(result.runs_google_ads, false);
});

test("a social profile found by search is kept only when it carries their name", async () => {
  stubFetch({
    site: page(""),
    serp: (q) =>
      q.endsWith("instagram")
        ? { organic_results: [{ title: "Lagos Foodie (@lagosfoodie)", link: "https://www.instagram.com/lagosfoodie/" }] }
        : q.endsWith("linkedin")
        ? { organic_results: [{ title: "Harvest Table Foods | LinkedIn", link: "https://www.linkedin.com/company/harvest-table-foods" }] }
        : {},
  });

  const result = await enrichLead(record(), { serpApiKey: "k" });

  assert.deepEqual(
    result.social_profiles.map((p) => p.platform),
    ["linkedin"],
    "somebody else's Instagram is not theirs"
  );
  assert.equal(fact(result, "social:linkedin")!.evidence, "Harvest Table Foods | LinkedIn");
});

// ── The helpers these rest on ────────────────────────────────────────────────

test("name matching needs the distinctive words, and ignores company suffixes", () => {
  assert.ok(nameMatches("Harvest Table Foods Ltd", "harvesttablefoods Harvest Table (@harvesttablefoods)"));
  assert.ok(nameMatches("Mama's Kitchen", "mamaskitchen_lagos"));
  assert.ok(!nameMatches("Harvest Table Foods", "harvest moon bakery"));
  assert.ok(!nameMatches("The Co", "thecoffeecompany"), "nothing distinctive to match on");
});

test("visible text drops scripts, styles and markup", () => {
  const text = visibleText(
    `<style>.jobs{}</style><script>hiring()</script><p>Fresh&nbsp;bread &amp; cakes</p><!-- careers -->`
  );
  assert.equal(text, "Fresh bread & cakes");
});
