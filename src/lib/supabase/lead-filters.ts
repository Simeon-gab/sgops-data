// Applies shared filter params to any Supabase leads query builder.
// Used by both GET /api/leads and GET /api/leads/export to guarantee identical filtering.
export function applyLeadFilters(
  // biome-ignore lint: Supabase query builder has no exported type we can use
  query: ReturnType<typeof Object.assign>,
  params: URLSearchParams
) {
  const q       = params.get("q")?.trim();
  const niche   = params.get("niche")?.trim();
  const country = params.get("country")?.trim();
  const state   = params.get("state")?.trim();
  const city    = params.get("city")?.trim();
  const tier    = params.get("tier")?.trim();
  const stage   = params.get("stage")?.trim();
  const quality = params.get("quality")?.trim();

  if (q)       query = query.ilike("name", `%${q}%`);
  if (niche)   query = query.eq("niche_id", niche);
  if (country) query = query.ilike("country", `%${country}%`);
  if (state)   query = query.ilike("state", `%${state}%`);
  if (city)    query = query.ilike("city", `%${city}%`);
  if (tier)    query = query.eq("tier", tier);
  if (stage)   query = query.eq("stage", stage);
  if (quality) query = query.eq("data_quality", quality);

  return query;
}
