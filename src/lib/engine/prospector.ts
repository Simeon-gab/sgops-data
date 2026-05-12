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

  if (isDemoMode) {
    const raw = generateMockBusinesses(
      req.niche_id,
      req.city,
      req.state,
      country?.name ?? req.country,
      countryCode,
      dialCode,
      coords.lat,
      coords.lng,
      req.result_count
    );
    return {
      records: cleanBusinessRecords(raw, cleanerCtx),
      demo_mode: true,
    };
  }

  // Real API mode
  let raw = await fetchFromGooglePlaces(
    niche.label,
    req.city,
    req.state,
    country?.name ?? req.country,
    req.result_count
  );

  // Supplement with SerpAPI if we got fewer than requested
  if (raw.length < req.result_count) {
    const serpResults = await fetchFromSerpAPI(
      niche.label,
      req.city,
      req.state,
      country?.name ?? req.country,
      req.result_count - raw.length
    );
    raw = [...raw, ...serpResults];
  }

  return {
    records: cleanBusinessRecords(raw, cleanerCtx),
    demo_mode: false,
  };
}
