-- SgOps Data — Initial Schema
-- Run: supabase db push

-- ━━━ workspaces ━━━
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  agency_name TEXT,
  agency_email TEXT,
  agency_phone TEXT,
  agency_website TEXT,
  agency_portfolio_url TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ━━━ leads ━━━
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,

  -- Identity
  name TEXT NOT NULL,
  niche_id TEXT NOT NULL,
  niche_label TEXT NOT NULL,
  place_id TEXT,

  -- Location (structured)
  country TEXT NOT NULL,
  country_code TEXT,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  street TEXT,
  zip TEXT,
  address_full TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  -- Contact
  email TEXT,
  email_verified BOOLEAN DEFAULT false,
  email_confidence INTEGER,
  email_source TEXT,
  phone TEXT,
  phone_formatted TEXT,
  phone_valid BOOLEAN DEFAULT false,
  website TEXT,
  website_active BOOLEAN DEFAULT false,
  website_has_ssl BOOLEAN DEFAULT false,

  -- Google Business
  rating DECIMAL(2,1),
  review_count INTEGER DEFAULT 0,

  -- Enrichment
  has_video_content BOOLEAN DEFAULT false,
  has_blog BOOLEAN DEFAULT false,
  website_quality TEXT,
  social_profiles JSONB DEFAULT '[]',
  runs_google_ads BOOLEAN DEFAULT false,
  runs_meta_ads BOOLEAN DEFAULT false,
  competitors JSONB DEFAULT '[]',
  years_in_business INTEGER,
  estimated_employees INTEGER,
  business_signals JSONB DEFAULT '[]',

  -- Scoring
  score INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'cold',
  score_breakdown JSONB DEFAULT '[]',

  -- Data Quality
  data_quality TEXT DEFAULT 'unverified',
  quality_issues JSONB DEFAULT '[]',
  duplicate_hash TEXT,

  -- Pipeline
  stage TEXT DEFAULT 'new',
  last_contacted_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',

  -- Metadata
  source TEXT DEFAULT 'google_places',
  extracted_at TIMESTAMPTZ DEFAULT now(),
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_leads_workspace ON leads(workspace_id);
CREATE INDEX idx_leads_niche ON leads(workspace_id, niche_id);
CREATE INDEX idx_leads_stage ON leads(workspace_id, stage);
CREATE INDEX idx_leads_tier ON leads(workspace_id, tier);
CREATE INDEX idx_leads_score ON leads(workspace_id, score DESC);
CREATE INDEX idx_leads_location ON leads(workspace_id, country, state, city);
CREATE INDEX idx_leads_duplicate ON leads(duplicate_hash);
CREATE INDEX idx_leads_data_quality ON leads(workspace_id, data_quality);

-- ━━━ outreach_templates ━━━
CREATE TABLE outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  structured_data JSONB,
  model_used TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_outreach_lead ON outreach_templates(lead_id, type);

-- ━━━ outreach_sends ━━━
CREATE TABLE outreach_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES outreach_templates(id),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  resend_id TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sends_lead ON outreach_sends(lead_id);
CREATE INDEX idx_sends_status ON outreach_sends(workspace_id, status);

-- ━━━ pipeline_activities ━━━
CREATE TABLE pipeline_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT,
  content TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activities_lead ON pipeline_activities(lead_id);

-- ━━━ niche_playbooks ━━━
CREATE TABLE niche_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  niche_id TEXT NOT NULL,
  niche_label TEXT NOT NULL,
  icon TEXT,
  pain_points TEXT NOT NULL,
  content_angles JSONB NOT NULL,
  hook TEXT NOT NULL,
  objection_responses JSONB DEFAULT '{}',
  pricing_tiers JSONB DEFAULT '{}',
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, niche_id)
);

-- ━━━ prospect_searches ━━━
CREATE TABLE prospect_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  niche_id TEXT NOT NULL,
  country TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  result_count INTEGER,
  leads_created INTEGER,
  cached_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ━━━ Row Level Security ━━━
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner" ON workspaces
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "leads_workspace" ON leads
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "outreach_workspace" ON outreach_templates
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "sends_workspace" ON outreach_sends
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "activities_workspace" ON pipeline_activities
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "playbooks_workspace" ON niche_playbooks
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "searches_workspace" ON prospect_searches
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- ━━━ updated_at trigger ━━━
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER niche_playbooks_updated_at BEFORE UPDATE ON niche_playbooks
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
