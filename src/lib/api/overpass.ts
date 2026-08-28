import type { RawBusinessRecord } from "@/lib/utils/types";

// OpenStreetMap businesses, read through the public Overpass API.
//
// This is the source that cannot be switched off by a billing problem. It needs
// no key, no account and no card, which is the whole reason it exists in the
// chain: Google Places refuses every request until a Cloud project has billing
// attached, and SerpAPI's free tier runs out. Overpass keeps a workspace
// prospecting when both of those are unavailable.
//
// What it gives up is reputation data. OSM records carry no rating and no
// review count, and their phone and website tags are filled in unevenly, so a
// search answered by Overpass alone is thinner than one answered by Maps. It
// runs last in the chain for that reason, as a top-up rather than a preference.
//
// Like the SerpAPI wrapper, this returns an empty array rather than throwing.
// It is the last source tried, and a failure here must leave whatever the
// earlier sources found intact.

// Public instances, tried in order. These are volunteer-run and they cut you
// off readily: a couple of dozen queries inside a few minutes was enough, while
// building this, to have the main instance stop accepting connections and the
// mirrors answer 500 to a query they had served moments before. A serverless
// deployment shares its outbound IP with other tenants, so expect the same in
// production. Hence three mirrors, and hence Overpass being the last source
// tried rather than anything the product depends on.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

// Overpass asks that clients identify themselves, and Nominatim rejects
// requests that do not.
const USER_AGENT = "SgOpsData/1.0 (business prospecting)";

// Metres around the city centre. Large enough to cover a metro area and its
// suburbs, small enough that the query stays inside Overpass's time budget.
const SEARCH_RADIUS_M = 25_000;

// Overpass counts its own timeout in seconds, inside the query. The fetch
// timeout sits above it so a hung connection cannot outlast the server's own
// limit by much.
const QUERY_TIMEOUT_S = 25;
const REQUEST_TIMEOUT_MS = 30_000;
const GEOCODE_TIMEOUT_MS = 10_000;

// -- Niche to OSM tags --------------------------------------------------------
// OSM has no single "category" field: a business is described by whichever
// key/value pair fits it, and the same trade can be tagged more than one way.
// Each niche therefore maps to every tag combination that plausibly means it,
// and the union of those is what gets queried.

// One filter is a set of tags an element must carry all of. Most niches need a
// single tag to identify them, but a few only separate from their neighbours on
// a second one: every food wholesaler is a `shop=wholesale`, and so is every
// sanitary-ware and electrical wholesaler, so the trade is in `wholesale=*`.
type TagFilter = Readonly<Record<string, string>>;

const NICHE_TAGS: Record<string, readonly TagFilter[]> = {
  restaurant:       [{ amenity: "restaurant" }, { amenity: "fast_food" }],
  hotel:            [{ tourism: "hotel" }, { tourism: "guest_house" }, { tourism: "motel" }, { tourism: "hostel" }],
  salon:            [{ shop: "hairdresser" }, { shop: "beauty" }],
  gym:              [{ leisure: "fitness_centre" }, { leisure: "sports_centre" }],
  dental:           [{ amenity: "dentist" }, { healthcare: "dentist" }],
  real_estate:      [{ office: "estate_agent" }],
  law_firm:         [{ office: "lawyer" }],
  auto_dealer:      [{ shop: "car" }],
  wedding_venue:    [{ amenity: "events_venue" }, { shop: "wedding" }],
  event_planner:    [{ office: "event_management" }, { shop: "party" }],
  contractor:       [{ craft: "builder" }, { craft: "carpenter" }, { craft: "electrician" }, { craft: "plumber" }, { office: "construction_company" }],
  retail:           [{ shop: "department_store" }, { shop: "general" }, { shop: "variety_store" }],
  medical:          [{ amenity: "clinic" }, { amenity: "doctors" }, { healthcare: "centre" }],
  nightclub:        [{ amenity: "nightclub" }, { amenity: "bar" }, { amenity: "pub" }],
  photography:      [{ shop: "photo" }, { craft: "photographer" }],
  spa_wellness:     [{ leisure: "spa" }, { shop: "massage" }, { leisure: "sauna" }],
  bakery_cafe:      [{ shop: "bakery" }, { amenity: "cafe" }],
  pet_services:     [{ amenity: "veterinary" }, { shop: "pet_grooming" }, { shop: "pet" }],
  fashion_clothing: [{ shop: "clothes" }, { shop: "boutique" }, { shop: "shoes" }],
  jewelry:          [{ shop: "jewelry" }],
  barbershop:       [{ shop: "hairdresser" }],
  car_wash:         [{ amenity: "car_wash" }],
  printing_signage: [{ shop: "copyshop" }, { craft: "printer" }, { craft: "signmaker" }],
  florist:          [{ shop: "florist" }],
  furniture:        [{ shop: "furniture" }, { shop: "interior_decoration" }],
  pharmacy:         [{ amenity: "pharmacy" }, { shop: "chemist" }],
  grocery:          [{ shop: "supermarket" }, { shop: "convenience" }, { shop: "greengrocer" }],

  // shop=trade is the trade counter or builders' merchant, and it is the
  // best-mapped of the three: a few hundred in London, dozens in Berlin.
  distributor:      [{ shop: "trade" }, { shop: "wholesale" }, { office: "logistics" }],
  // Narrowed by trade, because the bare shop=wholesale above is just as often
  // sanitary ware or electrical parts. Fewer results, but they are the right
  // businesses, which is the trade this whole mapping makes.
  food_wholesale:   [
    { shop: "wholesale", wholesale: "food" },
    { shop: "wholesale", wholesale: "beverages" },
    { shop: "wholesale", wholesale: "alcohol" },
    { shop: "wholesale", wholesale: "meat" },
    { shop: "wholesale", wholesale: "gastronomy" },
    { shop: "wholesale", wholesale: "supermarket" },
  ],
  // The one tag of the three B2B niches with real coverage in the markets this
  // is aimed at: 54 named labs across Lagos, Nairobi and Mumbai. Blood banks
  // and hospital pathology departments are deliberately not in here, since
  // neither is a business anyone can pitch.
  diagnostic_centre: [{ healthcare: "laboratory" }],
};

// -- Overpass response shapes -------------------------------------------------

interface OverpassElement {
  type?: "node" | "way" | "relation";
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
  // Overpass answers a query it could not finish with HTTP 200, an empty
  // element list, and the reason in here. Ignoring it would turn a server-side
  // timeout into the claim that the city has no businesses of this kind.
  remark?: string;
}

// -- Geocoding ----------------------------------------------------------------
// Overpass needs a point to search around. The built-in city list covers the
// common cases; anything outside it is looked up once, here.

async function geocodeCity(
  city: string,
  state: string,
  country: string
): Promise<{ lat: number; lng: number } | null> {
  const q = [city, state, country].filter(Boolean).join(", ");
  if (!q) return null;

  const params = new URLSearchParams({ q, format: "json", limit: "1" });

  try {
    const res = await fetch(`${NOMINATIM}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const body = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = body[0];
    if (!hit?.lat || !hit?.lon) return null;

    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}

// -- Query --------------------------------------------------------------------

// A box around the city rather than a radius around its centre. Overpass
// answers a bounding box straight out of its spatial index, where `around:`
// makes it measure a distance per candidate element: the same Lagos search
// times out server-side as a radius and returns in about three seconds as a
// box. The corners are a degree conversion of the radius, so the area is the
// circumscribing square of the circle that was meant.
function boundingBox(lat: number, lng: number, radiusM: number) {
  const METRES_PER_DEGREE = 111_320;
  const latDelta = radiusM / METRES_PER_DEGREE;
  // Longitude degrees narrow towards the poles. The floor keeps the box finite
  // for a city close enough to one that the cosine rounds away.
  const shrink = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const lngDelta = radiusM / (METRES_PER_DEGREE * shrink);

  const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

  return [
    clamp(lat - latDelta, 90),
    clamp(lng - lngDelta, 180),
    clamp(lat + latDelta, 90),
    clamp(lng + lngDelta, 180),
  ]
    .map((v) => v.toFixed(5))
    .join(",");
}

function buildQuery(
  filters: readonly TagFilter[],
  lat: number,
  lng: number,
  limit: number
): string {
  const bbox = boundingBox(lat, lng, SEARCH_RADIUS_M);

  // Only elements that carry a name are of any use as a lead, so the filter is
  // pushed into the query rather than applied after the fact. It cuts the
  // response down substantially: a large share of OSM shop nodes are unnamed.
  const clauses = filters
    .map((filter) => {
      const tags = Object.entries(filter)
        .map(([k, v]) => `["${k}"="${v}"]`)
        .join("");
      return `nwr${tags}["name"](${bbox});`;
    })
    .join("\n  ");

  return `[out:json][timeout:${QUERY_TIMEOUT_S}];\n(\n  ${clauses}\n);\nout center tags ${limit};`;
}

async function runQuery(query: string): Promise<OverpassResponse | null> {
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });

      // 429 is the rate limit and 504 is shed load. Both are worth retrying
      // against the other instance; anything else is a query problem that the
      // second instance would answer identically.
      if (res.status === 429 || res.status === 504) continue;
      if (!res.ok) return null;

      const body = (await res.json()) as OverpassResponse;

      // A remark is how the server reports a query it gave up on, usually a
      // timeout under load, and it arrives with a 200 and no elements. The
      // other instance is worth asking, in the same way a 504 is.
      if (body.remark && !body.elements?.length) continue;

      return body;
    } catch {
      // Timeout or network failure. Try the next instance, then give up.
      continue;
    }
  }
  return null;
}

// -- Mapping ------------------------------------------------------------------

function buildAddress(tags: Record<string, string>): string {
  const line = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  return [line, tags["addr:suburb"], tags["addr:city"], tags["addr:postcode"]]
    .filter(Boolean)
    .join(", ");
}

// OSM records the same fact under several keys, and an editor that clears a
// field often leaves the tag behind with an empty value rather than removing
// it. So the first key that is actually present wins, not merely the first key
// that is defined.
function firstTag(tags: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = tags[key]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeWebsite(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  // OSM contributors write bare domains as often as full URLs, and the cleaner
  // reads a missing scheme as a missing SSL certificate.
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

// The tag that matched is a better category than the niche label, in the same
// way SerpAPI's own type is. "fast food" says more about a lead than
// "Restaurants" does.
function readCategory(tags: Record<string, string>, fallback: string): string {
  // What a wholesaler deals in says more than the fact that it is a wholesaler.
  const trade = tags.wholesale?.trim();
  if (trade && trade !== "yes") return `${trade.replace(/_/g, " ")} wholesale`;

  for (const key of ["amenity", "shop", "office", "craft", "leisure", "tourism", "healthcare"]) {
    const value = tags[key];
    if (value) return value.replace(/_/g, " ");
  }
  return fallback;
}

function toRawRecord(element: OverpassElement, nicheLabel: string): RawBusinessRecord | null {
  const tags = element.tags;
  const name = tags?.name?.trim();
  if (!tags || !name) return null;

  const lat = element.lat ?? element.center?.lat ?? null;
  const lng = element.lon ?? element.center?.lon ?? null;

  return {
    source: "openstreetmap",
    name,
    address_raw: buildAddress(tags),
    phone_raw: firstTag(tags, "phone", "contact:phone", "contact:mobile"),
    website: normalizeWebsite(firstTag(tags, "website", "contact:website", "url")),
    // OSM holds no reputation data at all. Null says "not known", which is not
    // the same claim as a zero, and the scorer reads the difference: a lead
    // with no review data must not be scored as a lead with no reviews.
    rating: null,
    review_count: null,
    category: readCategory(tags, nicheLabel),
    // Namespaced so an OSM id can never collide with a Google place id, which
    // is what the cross-source dedupe key compares.
    place_id: element.type && element.id ? `osm:${element.type}/${element.id}` : null,
    latitude: lat,
    longitude: lng,
    photos_count: 0,
    extracted_at: new Date().toISOString(),
  };
}

// -- Entry point --------------------------------------------------------------

export async function fetchFromOverpass(
  nicheId: string,
  nicheLabel: string,
  city: string,
  state: string,
  country: string,
  coords: { lat: number; lng: number } | null,
  targetCount: number
): Promise<RawBusinessRecord[]> {
  if (targetCount <= 0) return [];

  const tags = NICHE_TAGS[nicheId];
  // A niche with no tag mapping cannot be expressed as an Overpass query. A
  // guess across every shop type would return the wrong businesses, which is
  // worse than returning none.
  if (!tags?.length) return [];

  const point = coords ?? (await geocodeCity(city, state, country));
  if (!point) return [];

  // Ask for more than is needed: duplicate elements are dropped below, since
  // ways and relations frequently describe the same premises as a node that
  // has already been counted.
  const response = await runQuery(buildQuery(tags, point.lat, point.lng, targetCount * 2));
  if (!response?.elements?.length) return [];

  const records: RawBusinessRecord[] = [];
  const seen = new Set<string>();

  for (const element of response.elements) {
    if (records.length >= targetCount) break;

    const record = toRawRecord(element, nicheLabel);
    if (!record) continue;

    // A building mapped as both a node and a way appears twice under different
    // ids, so the name and address are what identify it here, not the id.
    const key = `${record.name}|${record.address_raw}`.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    records.push(record);
  }

  return records;
}
