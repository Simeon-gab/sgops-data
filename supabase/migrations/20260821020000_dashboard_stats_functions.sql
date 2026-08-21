-- Dashboard stats were computed by pulling every lead row into the API and
-- counting in JS, which silently truncated at PostgREST's 1000-row cap and got
-- slower with every lead. Aggregate in Postgres instead.
-- SECURITY INVOKER so RLS still scopes the rows to the caller's workspace.

CREATE OR REPLACE FUNCTION public.workspace_lead_stats(ws UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total',          count(*),
    'hot',            count(*) FILTER (WHERE tier = 'hot'),
    'warm',           count(*) FILTER (WHERE tier = 'warm'),
    'cold',           count(*) FILTER (WHERE tier = 'cold'),
    'unscored',       count(*) FILTER (WHERE tier = 'unscored'),
    'active',         count(*) FILTER (WHERE stage NOT IN ('closed', 'lost')),
    'with_email',     count(*) FILTER (WHERE email IS NOT NULL),
    'verified',       count(*) FILTER (WHERE data_quality = 'verified'),
    'partial',        count(*) FILTER (WHERE data_quality = 'partial'),
    'unverified',     count(*) FILTER (WHERE data_quality = 'unverified'),
    'email_guessed',  count(*) FILTER (WHERE email_status = 'guessed'),
    'email_verified', count(*) FILTER (WHERE email_status = 'verified'),
    'enriched',       count(*) FILTER (WHERE enriched_at IS NOT NULL),
    'by_stage', COALESCE((
      SELECT json_agg(json_build_object('stage', stage, 'count', c))
      FROM (SELECT stage, count(*) c FROM leads WHERE workspace_id = ws GROUP BY stage) t
    ), '[]'::json),
    'by_niche', COALESCE((
      SELECT json_agg(json_build_object('niche', niche_label, 'count', c))
      FROM (
        SELECT niche_label, count(*) c FROM leads WHERE workspace_id = ws
        GROUP BY niche_label ORDER BY c DESC LIMIT 6
      ) t
    ), '[]'::json)
  )
  FROM leads WHERE workspace_id = ws;
$$;

CREATE OR REPLACE FUNCTION public.workspace_send_stats(ws UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total',     count(*),
    'sent',      count(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked')),
    'delivered', count(*) FILTER (WHERE status IN ('delivered','opened','clicked')),
    'opened',    count(*) FILTER (WHERE status IN ('opened','clicked')),
    'bounced',   count(*) FILTER (WHERE status IN ('bounced','failed'))
  )
  FROM outreach_sends WHERE workspace_id = ws;
$$;

GRANT EXECUTE ON FUNCTION public.workspace_lead_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_send_stats(UUID) TO authenticated;
