-- Batch 2: bulk email foundation
--
-- Three concerns:
--   1. Make the lead list safe to send to (email trust, junk quarantine)
--   2. Add the campaign primitive that bulk sending needs
--   3. Database hygiene flagged by the Supabase advisors

-- ━━━ 1. Lead data integrity ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Arbitrary columns from an imported CSV, used as merge fields in campaigns.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- How much we trust this address. The cleaner guesses info@<domain> when a
-- business has a website but no published email, which is fine for research and
-- dangerous for bulk sending. Campaigns gate on this column rather than
-- treating every address as equally real.
--   guessed  = derived from a domain, never confirmed to exist
--   verified = confirmed by a verification provider
--   invalid  = confirmed not to exist
--   unknown  = scraped or imported, never checked
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'unknown';

UPDATE leads SET email_status = CASE
  WHEN email IS NULL          THEN 'unknown'
  WHEN email_verified          THEN 'verified'
  WHEN email_source = 'pattern' THEN 'guessed'
  ELSE 'unknown'
END
WHERE email_status = 'unknown';

-- Quarantine addresses derived from a domain that is not the business.
-- Google Places often returns an Instagram, Linktree, or Google Sites page as a
-- business "website", and guessing info@ off that produces info@instagram.com.
-- Mailing those addresses is how a sending domain gets blacklisted.
UPDATE leads
SET email = NULL,
    email_source = NULL,
    email_confidence = 0,
    email_status = 'unknown',
    quality_issues = CASE
      WHEN quality_issues @> '["missing_email"]'::jsonb THEN quality_issues
      ELSE quality_issues || '["missing_email"]'::jsonb
    END
WHERE email IS NOT NULL
  AND split_part(email, '@', 2) IN (
    'instagram.com','facebook.com','fb.com','m.facebook.com','twitter.com','x.com','tiktok.com',
    'youtube.com','youtu.be','linkedin.com','wa.me','whatsapp.com','api.whatsapp.com','t.me','m.me',
    'linktr.ee','beacons.ai','taplink.cc','solo.to','campsite.bio','about.me','carrd.co','msha.ke',
    'sites.google.com','business.site','google.com','maps.google.com','goo.gl','bit.ly',
    'wixsite.com','wordpress.com','blogspot.com','weebly.com','godaddysites.com','webflow.io',
    'netlify.app','vercel.app','github.io','shopify.com','myshopify.com','square.site','squareup.com',
    'yelp.com','tripadvisor.com','booking.com','opentable.com','zomato.com','ubereats.com',
    'doordash.com','toasttab.com','chownow.com','glovoapp.com','jumia.com.ng','etsy.com',
    'amazon.com','ebay.com','medium.com','substack.com','calendly.com','zoom.us',
    'gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','protonmail.com',
    'mail.com','yandex.com','gmx.com','live.com','msn.com'
  );

-- Concurrent prospect runs could both pass the dedupe check and insert the same
-- business. Verified clean before adding: zero existing collisions.
CREATE UNIQUE INDEX IF NOT EXISTS leads_workspace_duplicate_unique
  ON leads(workspace_id, duplicate_hash)
  WHERE duplicate_hash IS NOT NULL;

DROP INDEX IF EXISTS idx_leads_duplicate;

CREATE INDEX IF NOT EXISTS idx_leads_email_status ON leads(workspace_id, email_status);

-- ━━━ 2. Campaigns ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  -- draft | scheduled | sending | paused | completed | cancelled
  status TEXT NOT NULL DEFAULT 'draft',
  subject_template TEXT,
  body_template TEXT,
  from_name TEXT,
  from_email TEXT,
  -- Drip controls. Bulk sending a thousand messages at once looks like spam to
  -- every inbox provider, so campaigns pace themselves.
  daily_limit INTEGER NOT NULL DEFAULT 50,
  throttle_seconds INTEGER NOT NULL DEFAULT 90,
  send_window_start TIME DEFAULT '08:00',
  send_window_end TIME DEFAULT '18:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id, status);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  -- pending | sending | sent | failed | skipped
  status TEXT NOT NULL DEFAULT 'pending',
  skip_reason TEXT,
  send_id UUID REFERENCES outreach_sends(id) ON DELETE SET NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- One message per address per campaign. Deduped by address rather than by
  -- lead, because distinct businesses legitimately share a contact address and
  -- mailing the same inbox twice in one campaign reads as spam.
  UNIQUE (campaign_id, to_email)
);

CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_recipients_workspace ON campaign_recipients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recipients_due
  ON campaign_recipients(status, scheduled_for)
  WHERE status = 'pending';

-- ━━━ 3. Suppressions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Addresses that must never be mailed again. A NULL workspace_id is a global
-- suppression that applies to every workspace, used for hard bounces and
-- complaints, which damage the shared sending reputation.

CREATE TABLE IF NOT EXISTS suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  -- unsubscribed | bounced | complained | invalid | manual
  reason TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS suppressions_scope_email
  ON suppressions(COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(email));

CREATE INDEX IF NOT EXISTS idx_suppressions_email ON suppressions(lower(email));

-- ━━━ 4. RLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- The existing policies re-evaluate auth.uid() and re-run the workspace lookup
-- for every row, which the advisor flags on all seven tables. Hoisting the
-- lookup into one STABLE function evaluates it once per query instead.
CREATE OR REPLACE FUNCTION public.current_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM workspaces WHERE owner_id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.current_workspace_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_workspace_ids() TO authenticated;

DROP POLICY IF EXISTS "workspace_owner"     ON workspaces;
DROP POLICY IF EXISTS "leads_workspace"     ON leads;
DROP POLICY IF EXISTS "outreach_workspace"  ON outreach_templates;
DROP POLICY IF EXISTS "sends_workspace"     ON outreach_sends;
DROP POLICY IF EXISTS "activities_workspace" ON pipeline_activities;
DROP POLICY IF EXISTS "playbooks_workspace" ON niche_playbooks;
DROP POLICY IF EXISTS "searches_workspace"  ON prospect_searches;

CREATE POLICY "workspace_owner" ON workspaces
  FOR ALL USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "leads_workspace" ON leads
  FOR ALL USING (workspace_id IN (SELECT public.current_workspace_ids()));

CREATE POLICY "outreach_workspace" ON outreach_templates
  FOR ALL USING (workspace_id IN (SELECT public.current_workspace_ids()));

CREATE POLICY "sends_workspace" ON outreach_sends
  FOR ALL USING (workspace_id IN (SELECT public.current_workspace_ids()));

CREATE POLICY "activities_workspace" ON pipeline_activities
  FOR ALL USING (workspace_id IN (SELECT public.current_workspace_ids()));

CREATE POLICY "playbooks_workspace" ON niche_playbooks
  FOR ALL USING (workspace_id IN (SELECT public.current_workspace_ids()));

CREATE POLICY "searches_workspace" ON prospect_searches
  FOR ALL USING (workspace_id IN (SELECT public.current_workspace_ids()));

ALTER TABLE campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppressions         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_workspace" ON campaigns
  FOR ALL USING (workspace_id IN (SELECT public.current_workspace_ids()));

CREATE POLICY "recipients_workspace" ON campaign_recipients
  FOR ALL USING (workspace_id IN (SELECT public.current_workspace_ids()));

-- Global suppressions (NULL workspace) are readable by everyone so a client can
-- see why an address was skipped, but only the service role writes them.
CREATE POLICY "suppressions_workspace" ON suppressions
  FOR ALL USING (
    workspace_id IS NULL OR workspace_id IN (SELECT public.current_workspace_ids())
  );

-- ━━━ 5. Advisor fixes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Mutable search_path on a SECURITY DEFINER-adjacent trigger function.
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Foreign keys without a covering index.
CREATE INDEX IF NOT EXISTS idx_outreach_templates_workspace ON outreach_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activities_workspace         ON pipeline_activities(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_created_by        ON pipeline_activities(created_by);
CREATE INDEX IF NOT EXISTS idx_searches_workspace           ON prospect_searches(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sends_template               ON outreach_sends(template_id);

-- Keyset pagination on the leads list sorts by score then id.
CREATE INDEX IF NOT EXISTS idx_leads_workspace_score_id ON leads(workspace_id, score DESC, id DESC);

-- Foreign keys on the tables added above.
CREATE INDEX IF NOT EXISTS idx_recipients_lead      ON campaign_recipients(lead_id);
CREATE INDEX IF NOT EXISTS idx_recipients_send      ON campaign_recipients(send_id);
CREATE INDEX IF NOT EXISTS idx_suppressions_workspace ON suppressions(workspace_id);
