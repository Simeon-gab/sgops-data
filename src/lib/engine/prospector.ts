import type { CleanBusinessRecord, ProspectRequest } from "@/lib/utils/types";
import { NICHES } from "@/lib/utils/constants";
import { getCountry, getCityCoords } from "@/lib/utils/locations";
import { generateMockBusinesses } from "@/lib/api/mock-data";
import { fetchFromGooglePlaces } from "@/lib/api/google-places";
import { fetchFromSerpAPI } from "@/lib/api/serpapi";
import { cleanBusinessRecords } from "./cleaner";

export interface ProspectResult {
  records: CleanBusinessRecord[];
  demo_mode: boolean;
}

export async function runProspector(req: ProspectRequest): Promise<ProspectResult> {
  const niche = NICHES.find((n) => n.id === req.niche_id);
  if (!niche) throw new Error(`Unknown niche: ${req.niche_id}`);

  const country = getCountry(req.country);
  const countryCode = country?.code ?? req.country;
  const dialCode = country?.dialCode ?? "+1";

  // Resolve city coords from static data or fall back to (0, 0)
  const coords = getCityCoords(req.country, req.state, req.city) ?? { lat: 0, lng: 0 };

  const isDemoMode = !process.env.GOOGLE_PLACES_API_KEY;

  const cleanerCtx = {
    city: req.city,
    state: req.state,
    country: country?.name ?? req.country,
    country_code: countryCode,
  };

  // Composite score for top-10 ranking: favours high rating with meaningful review volume
  const topScore = (r: { rating: number | null; review_count: number | null }) =>
    (r.rating ?? 0) * Math.log((r.review_count ?? 0) + 2);

  if (isDemoMode) {
    // Generate extra candidates in top10 mode so ranking has material to work with
    const genCount = req.top10_mode ? Math.max(req.result_count * 2, 20) : req.result_count;
    const raw = generateMockBusinesses(
      req.niche_id,
      req.city,
      req.state,
      country?.name ?? req.country,
      countryCode,
      dialCode,
      coords.lat,
      coords.lng,
      genCount
    );
    let records = cleanBusinessRecords(raw, cleanerCtx);
    if (req.top10_mode) {
      records = records
        .sort((a, b) => topScore(b) - topScore(a))
        .slice(0, 10);
    }
    return { records, demo_mode: true };
  }

  // Real API mode — fetch extra candidates for top10 so ranking is meaningful
  const fetchCount = req.top10_mode ? Math.max(req.result_count * 2, 20) : req.result_count;
  let raw = await fetchFromGooglePlaces(
    niche.label,
    req.city,
    req.state,
    country?.name ?? req.country,
    fetchCount,
    { top10Mode: req.top10_mode }
  );

  // Supplement with SerpAPI if we got fewer than requested (only for standard mode)
  if (!req.top10_mode && raw.length < req.result_count) {
    const serpResults = await fetchFromSerpAPI(
      niche.label,
      req.city,
      req.state,
      country?.name ?? req.country,
      req.result_count - raw.length
    );
    raw = [...raw, ...serpResults];
  }

  let records = cleanBusinessRecords(raw, cleanerCtx);
  if (req.top10_mode) {
    records = records
      .sort((a, b) => topScore(b) - topScore(a))
      .slice(0, 10);
  }

  return { records, demo_mode: false };
}
