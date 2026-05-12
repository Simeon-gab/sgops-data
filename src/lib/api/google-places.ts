import type { RawBusinessRecord } from "@/lib/utils/types";

const BASE = "https://maps.googleapis.com/maps/api/place";

interface PlacesTextResult {
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  place_id: string;
  photos?: unknown[];
}

interface PlacesTextResponse {
  results: PlacesTextResult[];
  next_page_token?: string;
  status: string;
  error_message?: string;
}

interface PlaceDetailsResult {
  formatted_phone_number?: string;
  website?: string;
  international_phone_number?: string;
}

interface PlaceDetailsResponse {
  result: PlaceDetailsResult;
  status: string;
}

async function textSearch(
  query: string,
  apiKey: string,
  pageToken?: string
): Promise<PlacesTextResponse> {
  const params = new URLSearchParams({ query, key: apiKey });
  if (pageToken) params.set("pagetoken", pageToken);
  const res = await fetch(`${BASE}/textsearch/json?${params}`);
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`);
  return res.json();
}

async function placeDetails(placeId: string, apiKey: string): Promise<PlaceDetailsResult | null> {
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: "formatted_phone_number,international_phone_number,website",
      key: apiKey,
    });
    const res = await fetch(`${BASE}/details/json?${params}`);
    if (!res.ok) return null;
    const data: PlaceDetailsResponse = await res.json();
    if (data.status !== "OK") return null;
    return data.result;
  } catch {
    return null;
  }
}

function toRawRecord(
  place: PlacesTextResult,
  details: PlaceDetailsResult | null,
  category: string
): RawBusinessRecord {
  return {
    source: "google_places",
    name: place.name,
    address_raw: place.formatted_address,
    phone_raw: details?.international_phone_number ?? details?.formatted_phone_number ?? "",
    website: details?.website ?? null,
    rating: place.rating ?? null,
    review_count: place.user_ratings_total ?? null,
    category,
    place_id: place.place_id,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    photos_count: (place.photos ?? []).length,
    extracted_at: new Date().toISOString(),
  };
}

export async function fetchFromGooglePlaces(
  nicheLabel: string,
  city: string,
  state: string,
  country: string,
  targetCount: number
): Promise<RawBusinessRecord[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not set");

  const query = `${nicheLabel} in ${city}, ${state}, ${country}`;
  const records: RawBusinessRecord[] = [];
  let pageToken: string | undefined;
  let page = 0;

  while (records.length < targetCount && page < 3) {
    if (page > 0) {
      // Google requires a short delay before using next_page_token
      await new Promise((r) => setTimeout(r, 2000));
    }

    const response = await textSearch(query, apiKey, pageToken);

    if (response.status === "ZERO_RESULTS") break;
    if (response.status !== "OK") {
      throw new Error(`Google Places: ${response.status} — ${response.error_message ?? ""}`);
    }

    const category = nicheLabel;
    const batch = response.results.slice(0, targetCount - records.length);

    // Fetch Place Details in parallel (max 5 concurrent) for phone/website
    const detailChunks: PlacesTextResult[][] = [];
    for (let i = 0; i < batch.length; i += 5) {
      detailChunks.push(batch.slice(i, i + 5));
    }

    for (const chunk of detailChunks) {
      const details = await Promise.all(
        chunk.map((p) => placeDetails(p.place_id, apiKey))
      );
      chunk.forEach((place, i) => {
        records.push(toRawRecord(place, details[i], category));
      });
    }

    pageToken = response.next_page_token;
    if (!pageToken) break;
    page++;
  }

  return records;
}
