import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { enrichLead, nameMatches, structuredContact, visibleText } from "@/lib/engine/enricher";
import { pickHunterContact } from "@/lib/api/hunter";
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
  // Other pages on the site, by path. A path not listed here gets the homepage.
  pages?: Record<string, string | number>;
  hunter?: unknown;
}

// Every URL asked for, so a test can assert on what was never requested.
let requested: string[] = [];

function stubFetch({ site, serp, pages, hunter }: Stub) {
  requested = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);

    if (url.startsWith("https://api.hunter.io/")) {
      return new Response(JSON.stringify(hunter ?? {}), { status: hunter ? 200 : 429 });
    }

    const path = new URL(url).pathname;
    if (pages && path in pages) {
      const body = pages[path];
      if (typeof body === "number") return new Response("", { status: body });
      return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    }

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

// ── The second page ──────────────────────────────────────────────────────────
// A careers link in a footer outlives the last vacancy by years. The page it
// points to is read before anyone is told the business is hiring.

const careersLink = page(`<a href="/careers">Careers</a>`);

test("a careers page that is recruiting is reported from that page", async () => {
  stubFetch({
    site: careersLink,
    pages: { "/careers": page(`<h1>Join us</h1><p>We have three open positions on the line. Apply now.</p>`) },
  });

  const result = await enrichLead(record());
  const hiring = fact(result, "hiring");

  assert.equal(hiring?.statement, "Their careers page is advertising open roles");
  assert.equal(hiring?.source_url, "https://harvesttable.example/careers");
  assert.match(hiring!.evidence, /open positions/);
  assert.deepEqual(result.research?.pages_read, ["https://harvesttable.example/careers"]);
});

test("a careers page with no openings means the business is not reported as hiring", async () => {
  stubFetch({
    site: careersLink,
    pages: { "/careers": page(`<p>There are no current vacancies. Apply now for future roles.</p>`) },
  });

  const result = await enrichLead(record());

  assert.equal(fact(result, "hiring"), undefined);
  assert.ok(!result.business_signals.includes("hiring"));
});

test("a careers page that cannot be read leaves the link reported as only a link", async () => {
  stubFetch({ site: careersLink, pages: { "/careers": 500 } });

  const result = await enrichLead(record());

  assert.equal(fact(result, "hiring")?.statement, "Their website links to a careers or jobs page");
  assert.deepEqual(result.research?.pages_read, []);
});

test("a careers link to another site is never followed", async () => {
  stubFetch({ site: page(`<a href="https://jobs.elsewhere.example/harvest">Careers</a>`) });

  const result = await enrichLead(record());

  assert.ok(!requested.some((u) => u.includes("elsewhere.example")));
  assert.equal(fact(result, "hiring")?.statement, "Their website links to a careers or jobs page");
});

test("the about page supplies what the homepage did not say, with itself as the source", async () => {
  stubFetch({
    site: page(`<a href="/about-us">About us</a>`),
    pages: { "/about-us": page(`<p>Family owned and established in 1998.</p>`) },
  });

  const result = await enrichLead(record());

  assert.equal(result.years_in_business, new Date().getFullYear() - 1998);
  assert.equal(fact(result, "founded")?.source_url, "https://harvesttable.example/about-us");
});

// ── A named contact ──────────────────────────────────────────────────────────
// A wrong first name in a greeting is worse than "Hi team", so a person is
// only named when the business's own site, or a page that still shows them,
// says who they are.

const ld = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

test("a founder named in the site's structured data becomes the contact", async () => {
  stubFetch({
    site: page(ld({ "@type": "Organization", name: "Harvest Table Foods", founder: { "@type": "Person", name: "Mrs. Ngozi Adeyemi" } })),
    hunter: { data: { emails: [] } },
  });

  const result = await enrichLead(record(), { hunterApiKey: "h" });
  const contact = result.research?.contact;

  assert.equal(contact?.name, "Ngozi Adeyemi");
  assert.equal(contact?.first_name, "Ngozi");
  assert.equal(contact?.role, "Founder");
  assert.equal(contact?.found_via, "website");
  assert.ok(
    !requested.some((u) => u.includes("hunter.io")),
    "no credit is spent when the website already named someone"
  );
});

test("structured data only yields a person with a usable name and a role", () => {
  const from = (data: unknown) => structuredContact(ld(data), "Harvest Table Foods", "https://x.example");

  assert.equal(from({ founder: "Harvest Table Foods" }), null, "the business is not a person");
  assert.equal(from({ founder: { name: "J. Okafor" } }), null, "an initial is not a first name");
  assert.equal(from({ employee: [{ name: "Tunde Bello" }] }), null, "staff with no stated role");
  assert.equal(from({ author: { "@type": "Person", name: "Sam Writer", jobTitle: "Editor" } }), null,
    "an article author is not the business's contact");
  assert.equal(structuredContact(`<script type="application/ld+json">{ broken</script>`, "X", "u"), null);

  const picked = from({
    "@graph": [
      { employee: [
        { name: "Tunde Bello", jobTitle: "Driver" },
        { name: "Amaka Eze", jobTitle: "Managing Director" },
      ] },
    ],
  });
  assert.equal(picked?.name, "Amaka Eze");
});

const hunterPerson = (over: Record<string, unknown> = {}) => ({
  value: "amaka@harvesttable.example",
  type: "personal",
  confidence: 94,
  first_name: "Amaka",
  last_name: "Eze",
  position: "Operations Director",
  seniority: "executive",
  sources: [{ uri: "https://harvesttable.example/team", still_on_page: true }],
  ...over,
});

test("Hunter is asked only when the website named nobody, and its answer carries proof", async () => {
  stubFetch({ site: page(""), hunter: { data: { emails: [hunterPerson()] } } });

  const result = await enrichLead(record(), { hunterApiKey: "h" });
  const contact = result.research?.contact;

  assert.equal(contact?.first_name, "Amaka");
  assert.equal(contact?.found_via, "hunter");
  assert.equal(contact?.source_url, "https://harvesttable.example/team");
});

test("a Hunter result is refused unless every check holds", () => {
  const pick = (over: Record<string, unknown>) =>
    pickHunterContact({ data: { emails: [hunterPerson(over)] } }, "harvesttable.example");

  assert.ok(pick({}));
  assert.equal(pick({ type: "generic" }), null);
  assert.equal(pick({ last_name: null }), null);
  assert.equal(pick({ position: "" }), null);
  assert.equal(pick({ confidence: 60 }), null);
  assert.equal(pick({ value: "amaka@gmail.com" }), null, "not on their domain");
  assert.equal(
    pick({ sources: [{ uri: "https://old.example", still_on_page: false }] }),
    null,
    "a page that no longer shows them proves nothing"
  );
});

test("a social profile used as a website is never looked up as if it were their domain", async () => {
  stubFetch({ site: page(""), hunter: { data: { emails: [hunterPerson({ value: "x@instagram.com" })] } } });

  const result = await enrichLead(
    record({ website: { url: "https://instagram.com/harvesttable", is_active: true, has_ssl: true } }),
    { hunterApiKey: "h" }
  );

  assert.equal(result.research?.contact, null);
  assert.ok(!requested.some((u) => u.includes("hunter.io")));
});

test("with no contact source configured the contact is simply absent", async () => {
  stubFetch({ site: page("") });
  const result = await enrichLead(record());
  assert.equal(result.research?.contact, null);
});
