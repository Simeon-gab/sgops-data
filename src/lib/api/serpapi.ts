import type { RawBusinessRecord } from "@/lib/utils/types";

// Phase 1 stub — SerpAPI integration is used as a fallback when Google Places
// returns fewer results than requested. Full implementation in Phase 2.
export async function fetchFromSerpAPI(
  _nicheLabel: string,
  _city: string,
  _state: string,
  _country: string,
  _targetCount: number
): Promise<RawBusinessRecord[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  // TODO Phase 2: implement Google Maps results via SerpAPI
  // Endpoint: https://serpapi.com/search.json?engine=google_maps&q=...&api_key=...
  return [];
}
