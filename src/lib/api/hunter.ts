import type { ResearchContact } from "@/lib/utils/types";

// Hunter.io domain search, used for one thing: finding a named person to
// address an email to when the business's own website does not name one.
//
// Hunter returns many people per domain with varying reliability, so a person
// is only accepted when all of these hold:
//   - Hunter classes the address as personal, with a first and last name
//   - a job title is given
//   - the address is on the business's own domain
//   - Hunter has a public page that still shows them, which becomes the proof
// Anyone failing a check is skipped. No contact is a fine outcome; the email
// greets the team instead.
//
// Each call costs one Hunter search credit, so it is made only when the website
// itself named nobody. Any failure (no key, quota, timeout) returns null.

const BASE = "https://api.hunter.io/v2/domain-search";
const REQUEST_TIMEOUT_MS = 6_000;
const MIN_CONFIDENCE = 80;

interface HunterSource {
  uri?: string;
  still_on_page?: boolean;
}

interface HunterEmail {
  value?: string;
  type?: string;
  confidence?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  seniority?: string | null;
  sources?: HunterSource[];
}

interface HunterResponse {
  data?: { emails?: HunterEmail[] };
}

const SENIORITY_RANK: Record<string, number> = { executive: 0, senior: 1 };

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

// Exported for tests: picks the person from a response, or nobody.
export function pickHunterContact(
  response: HunterResponse,
  domain: string
): ResearchContact | null {
  const candidates = (response.data?.emails ?? [])
    .map((e) => {
      const first = clean(e.first_name);
      const last = clean(e.last_name);
      const role = clean(e.position);
      const address = clean(e.value).toLowerCase();
      const proof = (e.sources ?? []).find((s) => s.still_on_page && clean(s.uri));

      if (e.type !== "personal") return null;
      if (!first || !last || !role || !proof) return null;
      if ((e.confidence ?? 0) < MIN_CONFIDENCE) return null;
      if (!address.endsWith("@" + domain) && !address.endsWith("." + domain)) return null;

      return {
        rank: SENIORITY_RANK[clean(e.seniority).toLowerCase()] ?? 2,
        confidence: e.confidence ?? 0,
        contact: {
          name: `${first} ${last}`,
          first_name: first,
          role,
          found_via: "hunter" as const,
          source_url: clean(proof.uri),
          evidence: `Listed by Hunter.io as ${role}, on a public page that still shows them`,
        },
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  candidates.sort((a, b) => a.rank - b.rank || b.confidence - a.confidence);
  return candidates[0]?.contact ?? null;
}

export async function findContactByDomain(
  domain: string,
  apiKey: string
): Promise<ResearchContact | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${BASE}?domain=${encodeURIComponent(domain)}&type=personal&limit=10&api_key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return pickHunterContact((await res.json()) as HunterResponse, domain);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
