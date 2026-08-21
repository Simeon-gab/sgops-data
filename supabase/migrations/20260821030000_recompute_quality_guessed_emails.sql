-- A guessed info@ address was counted as a real contact, so records were
-- labelled "verified" when nothing about them had been confirmed. Downgrade
-- those and flag the reason on the lead.
UPDATE leads
SET data_quality = 'partial',
    quality_issues = CASE
      WHEN quality_issues @> '["guessed_email"]'::jsonb THEN quality_issues
      ELSE quality_issues || '["guessed_email"]'::jsonb
    END
WHERE email_status = 'guessed'
  AND data_quality = 'verified';

-- Flag the reason on guessed-email leads that were already below "verified".
UPDATE leads
SET quality_issues = quality_issues || '["guessed_email"]'::jsonb
WHERE email_status = 'guessed'
  AND NOT (quality_issues @> '["guessed_email"]'::jsonb);
