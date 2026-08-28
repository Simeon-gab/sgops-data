import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fetchFromOverpass } from "@/lib/api/overpass";

// The keyless floor of the extraction chain. It runs last, after SerpAPI and
// Google Places, so like the SerpAPI top-up it must degrade rather than throw:
// a failure here costs the extra results only, never what an earlier source
// already found.
//
// Its other job is to be honest about what OSM does not know. A record here has
// no rating and no review count, and those have to arrive as null rather than
// zero, because the scorer reads a zero as "this business has no reviews" and
// would rank every OSM lead on an absence of data.

const realFetch = globalThis.fetch;

interface Call {
  url: string;
  body: string;
}

const calls: Call[] = [];

function stubFetch(responder: (url: string, body: string) => unknown) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? String(init.body) : "";
    calls.push({ url, body });

    const result = responder(url, body);
    if (result instanceof Error) throw result;
    if (result instanceof Response) return result;

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function node(n: number, tags: Record<string, string> = {}) {
  return {
    type: "node",
    id: 1000 + n,
    lat: Number((6.5 + n / 100).toFixed(4)),
    lon: Number((3.4 + n / 100).toFixed(4)),
    tags: {
      name: `Business ${n}`,
      amenity: "restaurant",
      "addr:housenumber": String(n),
      "addr:street": "Main Street",
      "addr:city": "Lagos",
      phone: `+23480000000${n}`,
      website: `https://business${n}.example`,
      ...tags,
    },
  };
}

function elements(...items: unknown[]) {
  return { elements: items };
}

const LAGOS = { lat: 6.5244, lng: 3.3792 };

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

// ── Mapping ──────────────────────────────────────────────────────────────────

test("maps an element onto the shared record shape", async () => {
  stubFetch(() => elements(node(1)));

  const [record] = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 1
  );

  assert.equal(record.source, "openstreetmap");
  assert.equal(record.name, "Business 1");
  assert.equal(record.address_raw, "1 Main Street, Lagos");
  assert.equal(record.phone_raw, "+234800000001");
  assert.equal(record.website, "https://business1.example");
  assert.equal(record.category, "restaurant");
  assert.equal(record.place_id, "osm:node/1001");
  assert.equal(record.latitude, 6.51);
  assert.equal(record.longitude, 3.41);
  assert.equal(record.photos_count, 0);
  assert.ok(record.extracted_at);
});

test("unknown reputation arrives as null, never as zero", async () => {
  // The distinction the scorer depends on. A zero here would fire
  // low_review_count on every OSM lead in the workspace.
  stubFetch(() => elements(node(1)));

  const [record] = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 1
  );

  assert.equal(record.rating, null);
  assert.equal(record.review_count, null);
});

test("reads the contact: prefixed tags when the plain ones are absent", async () => {
  stubFetch(() =>
    elements(
      node(1, {
        phone: "",
        website: "",
        "contact:phone": "+2348099999999",
        "contact:website": "https://contact.example",
      })
    )
  );

  const [record] = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 1
  );

  assert.equal(record.phone_raw, "+2348099999999");
  assert.equal(record.website, "https://contact.example");
});

test("a bare domain is given a scheme", async () => {
  // Contributors write both forms, and the cleaner reads a missing scheme as a
  // missing SSL certificate.
  stubFetch(() => elements(node(1, { website: "business1.example" })));

  const [record] = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 1
  );

  assert.equal(record.website, "https://business1.example");
});

test("a way reports the centre of its footprint", async () => {
  stubFetch(() =>
    elements({
      type: "way",
      id: 55,
      center: { lat: 6.6, lon: 3.5 },
      tags: { name: "Warehouse Grill", amenity: "restaurant" },
    })
  );

  const [record] = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 1
  );

  assert.equal(record.latitude, 6.6);
  assert.equal(record.longitude, 3.5);
  assert.equal(record.place_id, "osm:way/55");
});

test("the matched tag is the category, falling back to the niche", async () => {
  stubFetch(() =>
    elements(
      node(1, { amenity: "fast_food" }),
      { type: "node", id: 9, lat: 1, lon: 1, tags: { name: "Untagged Place" } }
    )
  );

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 2
  );

  assert.equal(records[0].category, "fast food");
  assert.equal(records[1].category, "Restaurants");
});

test("missing address tags produce an empty string, not the word undefined", async () => {
  stubFetch(() =>
    elements({ type: "node", id: 9, lat: 1, lon: 1, tags: { name: "Nameless Corner" } })
  );

  const [record] = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 1
  );

  assert.equal(record.address_raw, "");
  assert.equal(record.phone_raw, "");
  assert.equal(record.website, null);
});

test("an element with no name is dropped, not turned into a nameless lead", async () => {
  stubFetch(() =>
    elements({ type: "node", id: 7, lat: 1, lon: 1, tags: { amenity: "restaurant" } }, node(1))
  );

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 5
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].name, "Business 1");
});

test("the same premises mapped twice is counted once", async () => {
  // A building tagged as both a node and a way carries two ids for one
  // business, so the name and address identify it here, not the id.
  stubFetch(() =>
    elements(node(1), {
      type: "way",
      id: 4242,
      center: { lat: 6.51, lon: 3.41 },
      tags: node(1).tags,
    })
  );

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 5
  );

  assert.equal(records.length, 1);
});

test("never returns more than asked for", async () => {
  stubFetch(() => elements(...Array.from({ length: 20 }, (_, i) => node(i + 1))));

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 3
  );

  assert.equal(records.length, 3);
});

// ── The query ────────────────────────────────────────────────────────────────

function queryOf(call: Call) {
  return decodeURIComponent(call.body.replace(/^data=/, "").replace(/\+/g, " "));
}

test("queries every tag that can mean the niche, boxed around the given point", async () => {
  stubFetch(() => elements(node(1)));

  await fetchFromOverpass("restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 5);

  const query = queryOf(calls[0]);
  assert.match(query, /\["amenity"="restaurant"\]/);
  assert.match(query, /\["amenity"="fast_food"\]/, "fast food is a restaurant lead too");
  assert.match(query, /\["name"\]/, "unnamed elements are useless as leads");
  assert.match(query, /out center tags/, "ways need their centre point");

  // A box, not a radius: `around:` makes the server measure a distance per
  // candidate and this exact search times out server-side when it does.
  assert.ok(!query.includes("around:"), "a radius times out on a city this size");
  const [south, west, north, east] = query
    .match(/\(([-\d.,]+)\)/)![1]
    .split(",")
    .map(Number);
  assert.ok(south < LAGOS.lat && north > LAGOS.lat, "the city sits inside the box");
  assert.ok(west < LAGOS.lng && east > LAGOS.lng);
  // 25km north and south of the centre, in degrees.
  assert.ok(Math.abs(north - south - 0.449) < 0.01, "the box is the radius doubled");
});

test("the box narrows with longitude as it approaches a pole", async () => {
  stubFetch(() => elements(node(1)));

  await fetchFromOverpass(
    "restaurant", "Restaurants", "Tromso", "Troms", "Norway", { lat: 69.65, lng: 18.96 }, 5
  );

  const [south, west, north, east] = queryOf(calls[0])
    .match(/\(([-\d.,]+)\)/)![1]
    .split(",")
    .map(Number);

  // The same 25km spans far more degrees of longitude up here than of latitude.
  assert.ok(east - west > (north - south) * 2, "a degree of longitude is shorter this far north");
  assert.ok(Number.isFinite(east) && east < 180);
});

test("a niche that needs two tags to identify it asks for both together", async () => {
  // Every food wholesaler is a shop=wholesale, and so is every sanitary-ware
  // and electrical wholesaler. The trade is in the second tag, and asking for
  // it separately would return the whole trading estate.
  stubFetch(() => elements(node(1, { shop: "wholesale", wholesale: "food" })));

  const records = await fetchFromOverpass(
    "food_wholesale", "Food & Beverage Wholesalers", "Lagos", "Lagos", "Nigeria", LAGOS, 5
  );

  const query = queryOf(calls[0]);
  assert.match(query, /nwr\["shop"="wholesale"\]\["wholesale"="food"\]\["name"\]/);
  assert.ok(!/nwr\["shop"="wholesale"\]\["name"\]/.test(query), "never the bare shop tag on its own");
  assert.equal(records[0].category, "food wholesale", "the trade beats the fact of being a wholesaler");
});

test("a niche with no OSM equivalent asks for nothing rather than guessing", async () => {
  stubFetch(() => elements(node(1)));

  const records = await fetchFromOverpass(
    "unmapped_niche", "Something Else", "Lagos", "Lagos", "Nigeria", LAGOS, 5
  );

  assert.deepEqual(records, []);
  assert.equal(calls.length, 0, "a guess across every shop type is worse than nothing");
});

test("asking for nothing fetches nothing", async () => {
  stubFetch(() => elements(node(1)));

  assert.deepEqual(
    await fetchFromOverpass("restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 0),
    []
  );
  assert.equal(calls.length, 0);
});

// ── Geocoding ────────────────────────────────────────────────────────────────

test("a city outside the built-in list is geocoded first", async () => {
  stubFetch((url) => {
    if (url.includes("nominatim")) return [{ lat: "9.0765", lon: "7.3986" }];
    return elements(node(1));
  });

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Abuja", "FCT", "Nigeria", null, 1
  );

  assert.equal(records.length, 1);
  assert.match(decodeURIComponent(calls[0].url).replace(/\+/g, " "), /q=Abuja, FCT, Nigeria/);

  const [south, west, north, east] = queryOf(calls[1])
    .match(/\(([-\d.,]+)\)/)![1]
    .split(",")
    .map(Number);
  assert.ok(south < 9.0765 && north > 9.0765, "the box is centred on what was geocoded");
  assert.ok(west < 7.3986 && east > 7.3986);
});

test("known coordinates skip the geocode entirely", async () => {
  stubFetch(() => elements(node(1)));

  await fetchFromOverpass("restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 1);

  assert.equal(calls.length, 1);
  assert.ok(!calls[0].url.includes("nominatim"));
});

test("an unresolvable city ends the attempt without a query", async () => {
  stubFetch((url) => (url.includes("nominatim") ? [] : elements(node(1))));

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Nowheresville", "", "Atlantis", null, 5
  );

  assert.deepEqual(records, []);
  assert.equal(calls.length, 1, "no point means no query to build");
});

// ── Degrading ────────────────────────────────────────────────────────────────

test("a rate-limited instance is retried against the other one", async () => {
  stubFetch((url) => {
    if (url.includes("overpass-api.de")) return new Response("", { status: 429 });
    return elements(node(1));
  });

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 1
  );

  assert.equal(records.length, 1);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /kumi\.systems/);
});

test("a server-side timeout is a failure, not an empty city", async () => {
  // Overpass reports a query it gave up on with a 200, no elements, and a
  // remark. Taken at face value that reads as "there are no restaurants in
  // Lagos", which is how this went wrong the first time.
  stubFetch((url) => {
    if (url.includes("overpass-api.de")) {
      return { elements: [], remark: 'runtime error: Query timed out in "query" after 33 seconds.' };
    }
    return elements(node(1));
  });

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 5
  );

  assert.equal(records.length, 1, "the other instance answered");
  assert.equal(calls.length, 2);
});

test("a remark alongside real results is not treated as a failure", async () => {
  // Overpass also remarks on queries it answered, and those results count.
  stubFetch(() => ({ elements: [node(1)], remark: "considered only part of the area" }));

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 5
  );

  assert.equal(records.length, 1);
  assert.equal(calls.length, 1);
});

test("a bad query is not retried against the second instance", async () => {
  // The other instance would answer a malformed query identically, so a second
  // request only costs someone else's rate limit.
  stubFetch(() => new Response("parse error", { status: 400 }));

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 5
  );

  assert.deepEqual(records, []);
  assert.equal(calls.length, 1);
});

test("a network failure costs the top-up, not the whole search", async () => {
  stubFetch(() => new Error("socket hang up"));

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 5
  );

  assert.deepEqual(records, [], "every instance failed and none of them threw");
  assert.equal(calls.length, 3, "each mirror gets a turn");
});

test("an empty area is an empty result, not an error", async () => {
  stubFetch(() => ({ elements: [] }));

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Lagos", "Lagos", "Nigeria", LAGOS, 5
  );

  assert.deepEqual(records, []);
});

test("a failed geocode does not throw", async () => {
  stubFetch((url) => (url.includes("nominatim") ? new Error("dns failure") : elements(node(1))));

  const records = await fetchFromOverpass(
    "restaurant", "Restaurants", "Abuja", "FCT", "Nigeria", null, 5
  );

  assert.deepEqual(records, []);
});
