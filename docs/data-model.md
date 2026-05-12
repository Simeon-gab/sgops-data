# Data Model — SgOps Data

## Core Schema

### workspaces
Multi-tenant root. Every record in the system belongs to a workspace.

```sql
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
```

### leads
Core table. Stores extracted, cleaned, enriched, and scored lead data.

```sql
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
  country_code TEXT,              -- ISO 3166-1 alpha-2
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
  email_confidence INTEGER,       -- 0-100
  email_source TEXT,              -- "website" | "directory" | "pattern"
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
  website_quality TEXT,           -- "modern" | "outdated" | "minimal"
  social_profiles JSONB DEFAULT '[]',
  -- Example: [{"platform":"instagram","url":"...","followers":1200,"posts_per_week":2}]
  runs_google_ads BOOLEAN DEFAULT false,
  runs_meta_ads BOOLEAN DEFAULT false,
  competitors JSONB DEFAULT '[]',
  -- Example: [{"name":"...","has_video":true,"rating":4.5,"review_count":120}]
  years_in_business INTEGER,
  estimated_employees INTEGER,
  business_signals JSONB DEFAULT '[]',
  -- Example: ["multiple_locations","hiring","recently_renovated"]

  -- Scoring
  score INTEGER DEFAULT 0,       -- 0-100
  tier TEXT DEFAULT 'cold',      -- "hot" | "warm" | "cold"
  score_breakdown JSONB DEFAULT '[]',
  -- Example: [{"signal":"no_video","points":22,"reason":"No video content found"}]

  -- Data Quality
  data_quality TEXT DEFAULT 'unverified', -- "verified" | "partial" | "unverified"
  quality_issues JSONB DEFAULT '[]',
  -- Example: ["missing_email","no_website","low_reviews"]
  duplicate_hash TEXT,

  -- Pipeline
  stage TEXT DEFAULT 'new',      -- See STAGES constant
  last_contacted_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',

  -- Metadata
  source TEXT DEFAULT 'google_places', -- "google_places" | "serpapi" | "directory" | "manual"
  extracted_at TIMESTAMPTZ DEFAULT now(),
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_leads_workspace ON leads(workspace_id);
CREATE INDEX idx_leads_niche ON leads(workspace_id, niche_id);
CREATE INDEX idx_leads_stage ON leads(workspace_id, stage);
CREATE INDEX idx_leads_tier ON leads(workspace_id, tier);
CREATE INDEX idx_leads_score ON leads(workspace_id, score DESC);
CREATE INDEX idx_leads_location ON leads(workspace_id, country, state, city);
CREATE INDEX idx_leads_duplicate ON leads(duplicate_hash);
CREATE INDEX idx_leads_data_quality ON leads(workspace_id, data_quality);
```

### outreach_templates
AI-generated outreach content stored per lead.

```sql
CREATE TABLE outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,             -- "cold_email" | "call_script" | "follow_up_3" | "follow_up_7" | "follow_up_14" | "content_plan" | "proposal"
  subject TEXT,                   -- For emails
  body TEXT NOT NULL,
  structured_data JSONB,          -- For content plans and proposals
  model_used TEXT,                -- "claude-sonnet-4-20250514" etc.
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_outreach_lead ON outreach_templates(lead_id, type);
```

### outreach_sends
Tracking sent emails.

```sql
CREATE TABLE outreach_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES outreach_templates(id),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'queued',   -- "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed"
  resend_id TEXT,                 -- Resend API message ID
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sends_lead ON outreach_sends(lead_id);
CREATE INDEX idx_sends_status ON outreach_sends(workspace_id, status);
```

### pipeline_activities
Activity log for pipeline tracking.

```sql
CREATE TABLE pipeline_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,             -- "stage_change" | "note" | "email_sent" | "call_logged" | "meeting_scheduled"
  from_stage TEXT,
  to_stage TEXT,
  content TEXT,                   -- Note text or activity description
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activities_lead ON pipeline_activities(lead_id);
```

### niche_playbooks
Customizable per workspace. Seeded with defaults.

```sql
CREATE TABLE niche_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  niche_id TEXT NOT NULL,
  niche_label TEXT NOT NULL,
  icon TEXT,
  pain_points TEXT NOT NULL,
  content_angles JSONB NOT NULL,  -- ["Menu showcase videos", "Chef spotlights", ...]
  hook TEXT NOT NULL,
  objection_responses JSONB DEFAULT '{}',
  pricing_tiers JSONB DEFAULT '{}',
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, niche_id)
);
```

### prospect_searches
Log of all prospect searches for analytics and caching.

```sql
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
```

## Row Level Security

```sql
-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_searches ENABLE ROW LEVEL SECURITY;

-- Workspace access: owner only (expand to team members later)
CREATE POLICY "workspace_owner" ON workspaces
  FOR ALL USING (owner_id = auth.uid());

-- All other tables: workspace member access
CREATE POLICY "leads_workspace" ON leads
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- Repeat pattern for all tables with workspace_id
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
```

## TypeScript Types

```typescript
// /src/lib/utils/types.ts

export interface Lead {
  id: string;
  workspace_id: string;
  name: string;
  niche_id: string;
  niche_label: string;
  country: string;
  country_code: string | null;
  state: string;
  city: string;
  street: string | null;
  zip: string | null;
  address_full: string | null;
  latitude: number | null;
  longitude: number | null;
  email: string | null;
  email_verified: boolean;
  email_confidence: number | null;
  phone: string | null;
  phone_formatted: string | null;
  phone_valid: boolean;
  website: string | null;
  website_active: boolean;
  rating: number | null;
  review_count: number;
  has_video_content: boolean;
  has_blog: boolean;
  website_quality: "modern" | "outdated" | "minimal" | null;
  social_profiles: SocialProfile[];
  runs_google_ads: boolean;
  runs_meta_ads: boolean;
  competitors: Competitor[];
  years_in_business: number | null;
  estimated_employees: number | null;
  business_signals: string[];
  score: number;
  tier: "hot" | "warm" | "cold";
  score_breakdown: ScoreSignal[];
  data_quality: "verified" | "partial" | "unverified";
  quality_issues: string[];
  stage: PipelineStage;
  last_contacted_at: string | null;
  notes: string;
  source: "google_places" | "serpapi" | "directory" | "manual";
  created_at: string;
  updated_at: string;
}

export interface SocialProfile {
  platform: "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin";
  url: string;
  followers: number | null;
  posts_per_week: number | null;
}

export interface Competitor {
  name: string;
  has_video: boolean;
  rating: number;
  review_count: number;
}

export interface ScoreSignal {
  signal: string;
  points: number;
  reason: string;
}

export type PipelineStage = "new" | "contacted" | "responded" | "meeting" | "proposal" | "closed" | "lost";

export type DataQuality = "verified" | "partial" | "unverified";

export type LeadTier = "hot" | "warm" | "cold";

export interface ProspectRequest {
  niche_id: string;
  country: string;
  state: string;
  city: string;
  result_count: number;
}

export interface OutreachTemplate {
  id: string;
  lead_id: string;
  type: "cold_email" | "call_script" | "follow_up_3" | "follow_up_7" | "follow_up_14" | "content_plan" | "proposal";
  subject: string | null;
  body: string;
  structured_data: Record<string, unknown> | null;
  created_at: string;
}

export interface CleanedExportRecord {
  business_name: string;
  niche: string;
  country: string;
  state: string;
  city: string;
  street: string;
  zip: string;
  full_address: string;
  email: string;
  email_verified: boolean;
  phone: string;
  phone_valid: boolean;
  website: string;
  website_active: boolean;
  google_rating: number;
  google_reviews: number;
  has_video: boolean;
  social_instagram: string;
  social_facebook: string;
  social_tiktok: string;
  instagram_followers: number;
  runs_ads: boolean;
  years_in_business: number;
  estimated_employees: number;
  lead_score: number;
  lead_tier: string;
  data_quality: string;
  quality_issues: string;
}
```

The `CleanedExportRecord` type is the structured format used when exporting cleaned data as CSV. Every field is flat (no nested objects) for spreadsheet compatibility.
