import type { Lead } from "./types";

export interface LeadsPage {
  leads: Lead[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export const LEADS_PAGE_SIZE = 200;

export async function fetchLeadsPage(
  query: string,
  offset = 0,
  limit = LEADS_PAGE_SIZE
): Promise<LeadsPage> {
  const params = new URLSearchParams(query);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const res = await fetch(`/api/leads?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load leads");

  return {
    leads: data.leads ?? [],
    total: data.total ?? 0,
    limit: data.limit ?? limit,
    offset: data.offset ?? offset,
    has_more: Boolean(data.has_more),
  };
}

// Walks every page. For views that genuinely need the whole set in memory, such
// as the pipeline board, which groups leads by stage on the client.
// Bounded so a runaway response can never spin forever.
export async function fetchAllLeads(query = "", maxPages = 50): Promise<Lead[]> {
  const all: Lead[] = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchLeadsPage(query, offset, 1000);
    all.push(...result.leads);
    if (!result.has_more || result.leads.length === 0) break;
    offset += result.leads.length;
  }

  return all;
}
