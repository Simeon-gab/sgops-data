-- Sender Profile
-- Generalizes the product from "creative agency client acquisition" to
-- outreach for any sender with any goal. The sender's identity and ask used to
-- be hardcoded in the AI system prompt; it now lives on the workspace.

-- ━━━ workspaces: sender profile ━━━

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS goal            TEXT,
  ADD COLUMN IF NOT EXISTS sender_name     TEXT,
  ADD COLUMN IF NOT EXISTS sender_role     TEXT,
  ADD COLUMN IF NOT EXISTS organization    TEXT,
  ADD COLUMN IF NOT EXISTS offer           TEXT,
  ADD COLUMN IF NOT EXISTS audience        TEXT,
  ADD COLUMN IF NOT EXISTS credibility     TEXT,
  ADD COLUMN IF NOT EXISTS cta             TEXT,
  ADD COLUMN IF NOT EXISTS tone            TEXT DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS scoring_profile TEXT DEFAULT 'digital_presence',
  ADD COLUMN IF NOT EXISTS onboarded_at    TIMESTAMPTZ;

-- Backfill existing workspaces from the legacy agency fields so current
-- behaviour is preserved: they keep the client-acquisition goal and weights.
UPDATE workspaces SET
  goal            = COALESCE(goal, 'win_clients'),
  sender_name     = COALESCE(sender_name, agency_name),
  organization    = COALESCE(organization, agency_name),
  tone            = COALESCE(tone, 'direct'),
  scoring_profile = COALESCE(scoring_profile, 'digital_presence')
WHERE goal IS NULL;

-- One workspace per owner. getOrCreateWorkspace relies on this to make its
-- concurrent-insert retry correct rather than merely unlikely.
-- Fails loudly if duplicate owner rows already exist, which is the right outcome.
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_owner_unique ON workspaces(owner_id);

-- ━━━ niche_playbooks: hand-written niche playbooks -> generated campaign playbooks ━━━

ALTER TABLE niche_playbooks
  ADD COLUMN IF NOT EXISTS goal             TEXT,
  ADD COLUMN IF NOT EXISTS audience_context TEXT,
  ADD COLUMN IF NOT EXISTS value_angles     JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS offer_tiers      JSONB,
  ADD COLUMN IF NOT EXISTS profile_hash     TEXT,
  ADD COLUMN IF NOT EXISTS generated_at     TIMESTAMPTZ;

-- Generated playbooks populate the new columns, so the old required ones
-- become optional.
ALTER TABLE niche_playbooks ALTER COLUMN content_angles DROP NOT NULL;
ALTER TABLE niche_playbooks ALTER COLUMN pain_points    DROP NOT NULL;
ALTER TABLE niche_playbooks ALTER COLUMN hook           DROP NOT NULL;

UPDATE niche_playbooks
SET value_angles = COALESCE(content_angles, '[]'::jsonb),
    offer_tiers  = COALESCE(offer_tiers, pricing_tiers),
    goal         = COALESCE(goal, 'win_clients')
WHERE goal IS NULL;

CREATE INDEX IF NOT EXISTS idx_playbooks_workspace ON niche_playbooks(workspace_id, niche_id);

-- ━━━ backfill: unenriched leads are unscored, not cold ━━━
-- Leads created before the "unscored" tier existed were inserted as 'cold'
-- despite never having been enriched. That reads as a confirmed judgement on a
-- lead nothing was ever checked on, which is the exact confusion the tier was
-- added to prevent. Only rows that were never enriched are touched.
UPDATE leads
SET tier = 'unscored'
WHERE enriched_at IS NULL
  AND tier = 'cold'
  AND score = 0;

