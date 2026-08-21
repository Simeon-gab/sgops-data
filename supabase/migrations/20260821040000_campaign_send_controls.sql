-- Campaign send controls
--
-- Two switches the send worker needs and one index it queries on.

-- A guessed info@ address is a research artifact, not a confirmed contact.
-- Campaigns skip them by default; the user opts in per campaign, having been
-- told what it costs in deliverability.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS allow_guessed_emails BOOLEAN NOT NULL DEFAULT false;

-- Bulk mail without a working opt-out is how a sending domain gets blacklisted,
-- so this defaults on and is only turned off for genuinely transactional sends.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS include_unsubscribe BOOLEAN NOT NULL DEFAULT true;

-- Set when a recipient row is claimed by the worker, so a claim left behind by
-- a crashed invocation can be told from one that is actively sending.
ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- The worker's hot path: the oldest due recipient for one campaign.
CREATE INDEX IF NOT EXISTS idx_recipients_campaign_due
  ON campaign_recipients(campaign_id, scheduled_for)
  WHERE status = 'pending';

-- Reclaiming stuck rows scans by claim age.
CREATE INDEX IF NOT EXISTS idx_recipients_claimed
  ON campaign_recipients(claimed_at)
  WHERE status = 'sending';
