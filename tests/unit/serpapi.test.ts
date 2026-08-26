import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fetchFromSerpAPI } from "@/lib/api/serpapi";

// The top-up used when Google Places returns fewer businesses than were asked
// for. Its most important property is that it degrades: this runs after a
// search that already produced results, so a provider failure must cost the
// extra results only, never the ones already in hand.

const realFetch = globalThis.fetch;
const calls: string[] = [];

function stubFetch(responder: (url: string) => unknown) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const body = responder(url);
    if (body instanceof Error) throw body;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function localResult(n: number, over: Record<string, unknown> = {}) {
  return {
    title: `Business ${n}`,
    address: `${n} Main Street, Lagos`,
    phone: `+23480000000${n}`,
    website: `https://business${n}.example`,
    rating: 4.2,
    reviews: 33,
    type: "Restaurant",
    place_id: `place-${n}`,
    gps_coordinates: { latitude: 6.5, longitude: 3.4 },
    thumbnail: "https://example.invalid/thumb.jpg",
    ...over,
  };
}

function page(count: number, offset = 0) {
  return {
    local_results: Array.from({ length: count }, (_, i) => localResult(offset + i + 1)),
  };
}

beforeEach(() => {
  calls.length = 0;
  process.env.SERPAPI_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("maps a result onto the shared record shape", async () => {
  stubFetch(() => page(1));

  const [record] = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 1);

  assert.equal(record.source, "serpapi");
  assert.equal(record.name, "Business 1");
  assert.equal(record.address_raw, "1 Main Street, Lagos");
  assert.equal(record.phone_raw, "+234800000001");
  assert.equal(record.website, "https://business1.example");
  assert.equal(record.rating, 4.2);
  assert.equal(record.review_count, 33);
  assert.equal(record.place_id, "place-1");
  assert.equal(record.latitude, 6.5);
  assert.equal(record.longitude, 3.4);
  assert.equal(record.photos_count, 1);
  assert.ok(record.extracted_at);
});

test("prefers the provider's own category, falling back to the niche", async () => {
  stubFetch((url) =>
    url.includes("start")
      ? { local_results: [] }
      : { local_results: [localResult(1), localResult(2, { type: undefined, types: undefined })] }
  );

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 2);
  assert.equal(records[0].category, "Restaurant");
  assert.equal(records[1].category, "Restaurants");
});

test("missing optional fields become null rather than undefined", async () => {
  stubFetch(() => ({
    local_results: [{ title: "Bare Business" }],
  }));

  const [record] = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 1);
  assert.equal(record.website, null);
  assert.equal(record.rating, null);
  assert.equal(record.review_count, null);
  assert.equal(record.latitude, null);
  assert.equal(record.place_id, null);
  assert.equal(record.photos_count, 0);
  assert.equal(record.address_raw, "");
});

test("a result with no name is dropped, not turned into a nameless lead", async () => {
  stubFetch(() => ({ local_results: [{ address: "Somewhere" }, localResult(1)] }));

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 5);
  assert.equal(records.length, 1);
  assert.equal(records[0].name, "Business 1");
});

test("never returns more than asked for", async () => {
  stubFetch(() => page(20));

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 3);
  assert.equal(records.length, 3);
});

test("pages until it has enough", async () => {
  stubFetch((url) => (url.includes("start=20") ? page(20, 20) : page(20)));

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 25);
  assert.equal(records.length, 25);
  assert.equal(calls.length, 2, "one page was not enough, two were");
});

test("the same business on two pages is counted once", async () => {
  // Overlapping pages are normal here, and a duplicate would otherwise make
  // the top-up look bigger than it was.
  stubFetch(() => page(20));

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 40);
  assert.equal(records.length, 20, "the second page repeated the first");
  assert.equal(new Set(records.map((r) => r.place_id)).size, 20);
});

test("falls back to name and address when the provider gives no place_id", async () => {
  stubFetch(() => ({
    local_results: [
      localResult(1, { place_id: undefined }),
      localResult(1, { place_id: undefined }),
    ],
  }));

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 5);
  assert.equal(records.length, 1);
});

test("stops early on a short page", async () => {
  stubFetch(() => page(3));

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 50);
  assert.equal(records.length, 3);
  assert.equal(calls.length, 1, "a short page means there is no more to fetch");
});

test("never fetches more than three pages", async () => {
  stubFetch(() => page(20));
  // Distinct ids per page, so dedup does not end the loop first.
  let n = 0;
  stubFetch(() => page(20, (n++) * 20));

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 500);
  assert.equal(calls.length, 3);
  assert.equal(records.length, 60);
});

// ── Degrading ────────────────────────────────────────────────────────────────

test("no API key means no top-up, not an error", async () => {
  delete process.env.SERPAPI_KEY;
  stubFetch(() => page(20));

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 10);
  assert.deepEqual(records, []);
  assert.equal(calls.length, 0, "no key means no request at all");
});

test("asking for nothing fetches nothing", async () => {
  stubFetch(() => page(20));
  assert.deepEqual(await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 0), []);
  assert.equal(calls.length, 0);
});

test("a network failure costs the top-up, not the whole search", async () => {
  stubFetch(() => new Error("socket hang up"));

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 10);
  assert.deepEqual(records, []);
});

test("a provider error message is treated as no results", async () => {
  stubFetch(() => ({ error: "Your account has run out of searches." }));

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 10);
  assert.deepEqual(records, []);
});

test("keeps the first page when a later one fails", async () => {
  stubFetch((url) => {
    if (url.includes("start=20")) return new Error("gateway timeout");
    return page(20);
  });

  const records = await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos", "Nigeria", 40);
  assert.equal(records.length, 20, "what was already fetched survives");
});

test("the query names the niche and the whole location", async () => {
  stubFetch(() => page(1));
  await fetchFromSerpAPI("Restaurants", "Lagos", "Lagos State", "Nigeria", 1);

  const url = decodeURIComponent(calls[0]).replace(/\+/g, " ");
  assert.match(url, /engine=google_maps/);
  assert.match(url, /Restaurants in Lagos, Lagos State, Nigeria/);
});

test("an empty location part does not leave a stray comma", async () => {
  stubFetch(() => page(1));
  await fetchFromSerpAPI("Hospitals", "Lagos", "", "Nigeria", 1);

  assert.match(decodeURIComponent(calls[0]).replace(/\+/g, " "), /Hospitals in Lagos, Nigeria/);
});
