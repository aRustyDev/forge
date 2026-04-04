-- Stale Education Text Cleanup
-- Migration: 020_stale_education_text_cleanup
-- Date: 2026-04-04
-- Clears deprecated institution/issuing_body text columns on source_education
-- rows where organization_id is already set. The FK is authoritative; the text
-- columns contained stale duplicates that could diverge from the org name.
-- Must run BEFORE 021 (which drops these columns entirely).

-- Verification: log how many rows have organization_id set vs text still populated.
-- (SQLite has no RAISE for warnings, so we just do the update.)

-- Clear institution where the FK is set
UPDATE source_education
SET institution = NULL
WHERE organization_id IS NOT NULL
  AND institution IS NOT NULL;

-- Clear issuing_body where the FK is set
UPDATE source_education
SET issuing_body = NULL
WHERE organization_id IS NOT NULL
  AND issuing_body IS NOT NULL;

INSERT INTO _migrations (name) VALUES ('020_stale_education_text_cleanup');
