import type { CleanBusinessRecord, ProspectRequest, RawBusinessRecord } from "@/lib/utils/types";
import { NICHES } from "@/lib/utils/constants";
import { getCountry, getCityCoords } from "@/lib/utils/locations";
import { generateMockBusinesses } from "@/lib/api/mock-data";
import { fetchFromGooglePlaces } from "@/lib/api/google-places";
import { fetchFromSerpAPI } from "@/lib/api/serpapi";
import { fetchFromOverpass } from "@/lib/api/overpass";
import { cleanBusinessRecords } from "./cleaner";

export interface ProspectResult {
  records: CleanBusinessRecord[];
  demo_mode: boolean;
  // Set when the search did not run the way it normally would: a source failed,
  // or the results came from further down the chain than usual. The caller
  // shows this so a degraded search is visibly degraded rather than quietly
  // thinner than it should be.
  fallback_notice: string | null;
}

// Extraction sources, in the order they are tried. Each one only runs if the
// ones before it came up short of the requested count.
//
// SerpAPI leads because it needs nothing but an API key: Google Places refuses
// every request until the Cloud project behind the key has a billing account
// with a live card attached, which is a wall a lot of workspaces cannot get
// over. Places sits second as the upgrade for whoever has cleared it, since it
// reaches deeper on established listings than a single Maps page does.
//
// Overpass runs last and always, with no key at all. It is thinner data (no
// ratings, no review counts, patchy phone numbers) so it is a floor rather than
// a preference, but it means a workspace with no keys and no card still gets
// real businesses instead of nothing.
interface SourceRun {
  id: "serpapi" | "google_places" | "openstreetmap";
  label: string;
  fetch: (need: number) => Promise<RawBusinessRecord[]>;
}

export async function runProspector(req: ProspectRequest): Promise<ProspectResult> {
  const niche = NICHES.find((n) => n.id === req.niche_id);
  if (!niche) throw new Error(`Unknown niche: ${req.niche_id}`);

  const country = getCountry(req.country);
  const countryCode = country?.code ?? req.country;
  const dialCode = country?.dialCode ?? "+1";
  const countryName = country?.name ?? req.country;

  // Resolve city coords from static data. Null rather than (0, 0) when the city
  // is not in the built-in list, so Overpass knows to geocode it instead of
  // searching the Atlantic.
  const coords = getCityCoords(req.country, req.state, req.city);

  const cleanerCtx = {
    city: req.city,
    state: req.state,
    country: countryName,
    country_code: countryCode,
  };

  // Composite score for top-10 ranking: favours high rating with meaningful review volume
  const topScore = (r: { rating: number | null; review_count: number | null }) =>
    (r.rating ?? 0) * Math.log((r.review_count ?? 0) + 2);

  const finish = (
    raw: RawBusinessRecord[],
    demoMode: boolean,
    notice: string | null
  ): ProspectResult => {
    let records = cleanBusinessRecords(raw, cleanerCtx);
    if (req.top10_mode) {
      records = records.sort((a, b) => topScore(b) - topScore(a)).slice(0, 10);
    }
    return { records, demo_mode: demoMode, fallback_notice: notice };
  };

  const runDemo = (): ProspectResult => {
    // Generate extra candidates in top10 mode so ranking has material to work with
    const genCount = req.top10_mode ? Math.max(req.result_count * 2, 20) : req.result_count;
    const raw = generateMockBusinesses(
      req.niche_id,
      req.city,
      req.state,
      countryName,
      countryCode,
      dialCode,
      coords?.lat ?? 0,
      coords?.lng ?? 0,
      genCount
    );
    return finish(raw, true, null);
  };

  // Fetch extra candidates for top10 so ranking is meaningful.
  const fetchCount = req.top10_mode ? Math.max(req.result_count * 2, 20) : req.result_count;

  const sources: SourceRun[] = [];

  if (process.env.SERPAPI_KEY) {
    sources.push({
      id: "serpapi",
      label: "SerpAPI",
      fetch: (need) => fetchFromSerpAPI(niche.label, req.city, req.state, countryName, need),
    });
  }

  if (process.env.GOOGLE_PLACES_API_KEY) {
    sources.push({
      id: "google_places",
      label: "Google Places",
      fetch: (need) =>
        fetchFromGooglePlaces(niche.label, req.city, req.state, countryName, need, {
          top10Mode: req.top10_mode,
        }),
    });
  }

  sources.push({
    id: "openstreetmap",
    label: "OpenStreetMap",
    fetch: (need) =>
      fetchFromOverpass(req.niche_id, niche.label, req.city, req.state, countryName, coords, need),
  });

  const raw: RawBusinessRecord[] = [];
  const contributed: string[] = [];
  const failures: string[] = [];

  for (const source of sources) {
    if (raw.length >= fetchCount) break;

    try {
      const results = await source.fetch(fetchCount - raw.length);
      if (results.length > 0) {
        raw.push(...results);
        contributed.push(source.id);
      }
    } catch (err) {
      // A throw used to end the whole run, which put every later source out of
      // reach in exactly the case they exist for. Places refuses every request
      // when billing is off on its Cloud project, and that is a standing
      // condition rather than a blip: the run has to survive it and still
      // return leads.
      const reason = err instanceof Error ? err.message : `${source.label} failed`;
      failures.push(reason);
    }
  }

  // Nothing anywhere. Mock data is the honest last resort: it is clearly
  // labelled as demo in the UI, where an empty result would read as "this city
  // has no businesses of this kind in it".
  if (raw.length === 0) {
    const demo = runDemo();
    return {
      ...demo,
      fallback_notice: failures.length > 0 ? failures.join(" ") : null,
    };
  }

  return finish(raw, false, buildNotice(contributed, failures, sources));
}

// Explains anything about the run the results themselves would not show. Silent
// on the normal path, where the first configured source answered on its own.
function buildNotice(
  contributed: string[],
  failures: string[],
  sources: SourceRun[]
): string | null {
  const notes: string[] = [];

  if (failures.length > 0) {
    notes.push(`A source did not answer, so these results came from further down the chain. ${failures.join(" ")}`);
  }

  // OSM records are real businesses but thin ones: no ratings, no review
  // counts, and on a live Lagos search fewer than one in ten carried a phone
  // number or a website. Since an email address is only ever guessed from a
  // website domain, that ceiling on contactability is the thing worth saying
  // out loud. It is only said when OSM was the whole search, not when it topped
  // up the last few records of one.
  if (contributed.length === 1 && contributed[0] === "openstreetmap") {
    const hasKeys = sources.some((s) => s.id !== "openstreetmap");
    notes.push(
      "These businesses came from OpenStreetMap, which needs no API key but carries no ratings or review counts, and lists a phone number or website for only a minority of them." +
        (hasKeys ? "" : " Add SERPAPI_KEY for fuller records.")
    );
  }

  return notes.length > 0 ? notes.join(" ") : null;
}
