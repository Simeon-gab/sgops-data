-- Sending identities
--
-- Until now the sender was the platform: one Resend account, one API key, and
-- a from-address typed onto each campaign. That works while the platform owner
-- is the only user. It stops working the moment there are many, because one
-- person mailing a scraped list damages deliverability for everyone else on
-- the shared account.
--
-- A sending identity is "this mailbox, sending on this workspace's behalf".
-- The transport behind it is pluggable: today only the platform's own Resend
-- account, later the user's SMTP credentials or an OAuth-connected mailbox.
-- Nothing here changes how existing campaigns send. A workspace with no
-- identity falls back to exactly the previous behaviour.

CREATE TABLE IF NOT EXISTS sending_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,

  -- Which transport delivers for this identity.
  --   resend = the platform's account, or the workspace's own Resend key
  --   smtp   = credentials the user supplied
  --   gmail | outlook = an OAuth-connected mailbox
  kind TEXT NOT NULL DEFAULT 'resend',

  label TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  reply_to TEXT,

  is_default BOOLEAN NOT NULL DEFAULT false,

  -- unverified | verified | failed
  status TEXT NOT NULL DEFAULT 'unverified',
  verified_at TIMESTAMPTZ,
  last_error TEXT,

  -- Ciphertext, encrypted by the application before it is ever sent to
  -- Postgres, so the database never holds a usable credential. NULL means the
  -- identity carries no credentials of its own and uses the platform's.
  secrets TEXT,

  -- What this mailbox can send in a day, which is a property of the mailbox
  -- rather than of any one campaign: a Gmail account has a hard ceiling no
  -- matter how many campaigns are pointed at it. Reserved. Enforcement lands
  -- with the first per-mailbox transport; today nothing reads it.
  daily_limit INTEGER,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One address per workspace. Two identities for the same mailbox would race
-- each other's daily budget once limits are enforced.
CREATE UNIQUE INDEX IF NOT EXISTS sending_identities_workspace_email
  ON sending_identities(workspace_id, lower(from_email));

-- At most one default per workspace, enforced rather than assumed, so
-- resolution never has to pick between two.
CREATE UNIQUE INDEX IF NOT EXISTS sending_identities_one_default
  ON sending_identities(workspace_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_sending_identities_workspace
  ON sending_identities(workspace_id);

DROP TRIGGER IF EXISTS sending_identities_updated_at ON sending_identities;
CREATE TRIGGER sending_identities_updated_at
  BEFORE UPDATE ON sending_identities
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ━━━ RLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE sending_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sending_identities_workspace" ON sending_identities;
CREATE POLICY "sending_identities_workspace" ON sending_identities
  FOR ALL USING (workspace_id IN (SELECT public.current_workspace_ids()));

-- Defence in depth on top of the application-side encryption: even holding a
-- valid session for the workspace, the browser cannot read the column back.
-- Only the service role, which bypasses these grants, ever sees it.
--
-- A column-level REVOKE alone does nothing here. Postgres treats table and
-- column privileges separately, and Supabase grants table-level SELECT to
-- these roles by default, which keeps every column readable. So the table
-- grants come off first and the columns go back on one by one.
REVOKE ALL ON sending_identities FROM anon;
REVOKE SELECT, INSERT, UPDATE ON sending_identities FROM authenticated;

GRANT SELECT (
  id, workspace_id, kind, label, from_email, from_name, reply_to,
  is_default, status, verified_at, last_error, daily_limit,
  created_at, updated_at
) ON sending_identities TO authenticated;

GRANT INSERT (
  workspace_id, kind, label, from_email, from_name, reply_to,
  is_default, daily_limit
) ON sending_identities TO authenticated;

GRANT UPDATE (
  label, from_name, reply_to, is_default, daily_limit
) ON sending_identities TO authenticated;

GRANT DELETE ON sending_identities TO authenticated;

-- ━━━ Campaigns ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Which mailbox this campaign sends from. NULL keeps the old behaviour: the
-- from_email typed onto the campaign, delivered by the platform.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS sending_identity_id UUID
  REFERENCES sending_identities(id) ON DELETE SET NULL;
