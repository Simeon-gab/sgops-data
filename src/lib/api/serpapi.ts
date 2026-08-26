import type { RawBusinessRecord } from "@/lib/utils/types";

// SerpAPI's Google Maps results, used to top up a search when Google Places
// has returned fewer businesses than were asked for.
//
// The two see different slices of the same map. Places text search caps out
// around sixty results across three pages and skews to well-established
// listings; Maps results through SerpAPI reach further into thinner niches and
// smaller towns, which is exactly where the first pass comes up short.
//
// Returning an empty array is a valid outcome here. This is a supplement to a
// search that already produced something, so a missing key or a bad response
// must degrade to "no extra results" rather than failing the whole prospect
// run and losing what Places did find.

const BASE = "https://serpapi.com/search.json";

// SerpAPI pages Maps results twenty at a time.
const PAGE_SIZE = 20;
const MAX_PAGES = 3;

// A slow provider must not hold up a prospect request indefinitely.
const REQUEST_TIMEOUT_MS = 15_000;

interface SerpLocalResult {
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  place_id?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  thumbnail?: string;
}

interface SerpMapsResponse {
  local_results?: SerpLocalResult[];
  error?: string;
  search_metadata?: { status?: string };
}

async function mapsSearch(
  query: string,
  apiKey: string,
  start: number
): Promise<SerpMapsResponse | null> {
  const params = new URLSearchParams({
    engine: "google_maps",
    type: "search",
    q: query,
    api_key: apiKey,
  });
  if (start > 0) params.set("start", String(start));

  try {
    const res = await fetch(`${BASE}?${params}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // A prospect search is a live query; a cached page would quietly return
      // the same businesses every time.
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as SerpMapsResponse;
  } catch {
    // Timeout, network failure or malformed JSON. The caller keeps whatever
    // Google Places already returned.
    return null;
  }
}

function toRawRecord(result: SerpLocalResult, category: string): RawBusinessRecord | null {
  const name = result.title?.trim();
  if (!name) return null;

  return {
    source: "serpapi",
    name,
    address_raw: result.address?.trim() ?? "",
    phone_raw: result.phone?.trim() ?? "",
    website: result.website?.trim() || null,
    rating: typeof result.rating === "number" ? result.rating : null,
    review_count: typeof result.reviews === "number" ? result.reviews : null,
    // SerpAPI's own category is more specific than the niche label when it is
    // present, and the niche is the honest fallback when it is not.
    category: result.type?.trim() || result.types?.[0]?.trim() || category,
    place_id: result.place_id ?? null,
    latitude: result.gps_coordinates?.latitude ?? null,
    longitude: result.gps_coordinates?.longitude ?? null,
    // SerpAPI reports a single thumbnail rather than a photo count. Counting it
    // as one photo is closer to the truth than claiming none, and the scorer
    // reads this as presence rather than as a total.
    photos_count: result.thumbnail ? 1 : 0,
    extracted_at: new Date().toISOString(),
  };
}

export async function fetchFromSerpAPI(
  nicheLabel: string,
  city: string,
  state: string,
  country: string,
  targetCount: number
): Promise<RawBusinessRecord[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey || targetCount <= 0) return [];

  const query = `${nicheLabel} in ${[city, state, country].filter(Boolean).join(", ")}`;

  const records: RawBusinessRecord[] = [];
  // The same business often appears on more than one page. Deduping here keeps
  // the top-up honest about how many new businesses it actually added.
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES && records.length < targetCount; page++) {
    const response = await mapsSearch(query, apiKey, page * PAGE_SIZE);

    if (!response || response.error) break;

    const results = response.local_results ?? [];
    if (results.length === 0) break;

    for (const result of results) {
      if (records.length >= targetCount) break;

      const record = toRawRecord(result, nicheLabel);
      if (!record) continue;

      // place_id when the provider gives one, otherwise name and address,
      // which is what the cleaner's own duplicate hash falls back to.
      const key = (record.place_id ?? `${record.name}|${record.address_raw}`).toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      records.push(record);
    }

    // A short page means there is nothing more to fetch.
    if (results.length < PAGE_SIZE) break;
  }

  return records;
}
