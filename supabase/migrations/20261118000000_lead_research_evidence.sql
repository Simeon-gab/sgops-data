-- Evidence for what enrichment found about a business.
--
-- Until now enrichment stored conclusions (has_video_content, business_signals,
-- runs_google_ads) with no record of what they were based on, and no way to
-- tell "we looked and found nothing" from "the website never loaded". Both
-- ended up in cold emails as statements of fact.
--
-- research holds:
--   website_read  whether the homepage was actually readable
--   checked_at    when
--   facts         [{ key, statement, source_url, evidence }]
--
-- Null means the lead was enriched before this existed. Outreach treats such a
-- lead's website findings as unknown until it is enriched again.

alter table public.leads
  add column if not exists research jsonb;

comment on column public.leads.research is
  'What enrichment saw and the proof for each finding. Null = enriched before evidence was recorded.';
