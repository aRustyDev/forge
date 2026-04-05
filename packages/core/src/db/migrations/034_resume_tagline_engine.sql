-- Forge Resume Builder — Resume Tagline Engine
-- Migration: 034_resume_tagline_engine
-- Date: 2026-04-05
--
-- Phase 92 closes the tagline lifecycle opened in Phase 91 (which intentionally
-- preserved summaries.tagline). Tagline is conceptually a resume-level concept
-- that depends on which JDs are linked, not a summary-level label. This
-- migration:
--
-- 1. Adds `generated_tagline` and `tagline_override` columns to resumes
-- 2. Migrates existing data: copies each summary's tagline to the tagline_override
--    column of every resume linked to that summary (preserves user text where
--    it was actually rendered)
-- 3. Rebuilds the summaries table WITHOUT the tagline column
--
-- After this migration:
--  - `resume.generated_tagline` is populated by TaglineService from linked JDs
--  - `resume.tagline_override` is the user's manual override (takes precedence)
--  - The UI shows override || generated || empty
--  - Linking/unlinking a JD regenerates `generated_tagline` automatically
--
-- PRAGMA foreign_keys = OFF is required for the summaries table rebuild
-- (auto-detected by the migration runner).
--
-- PRAGMA foreign_keys = OFF

-- Step 1: Add generated_tagline and tagline_override columns to resumes.
ALTER TABLE resumes ADD COLUMN generated_tagline TEXT;
ALTER TABLE resumes ADD COLUMN tagline_override TEXT;

-- Step 2: Data migration — copy summary.tagline into linked resumes'
-- tagline_override. This preserves any tagline text the user wrote, because
-- that was the text actually rendered onto their resumes. We write to
-- tagline_override (not generated_tagline) because:
--   1. It was manually authored by the user, so it should be treated as an
--      override that survives JD-driven regeneration.
--   2. generated_tagline will be freshly computed the next time JDs are
--      linked; overwriting it here would be pointless.
-- Only resumes with no override already set receive the copy.
UPDATE resumes
SET tagline_override = (
  SELECT s.tagline
  FROM summaries s
  WHERE s.id = resumes.summary_id AND s.tagline IS NOT NULL AND trim(s.tagline) != ''
)
WHERE tagline_override IS NULL
  AND summary_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM summaries s
    WHERE s.id = resumes.summary_id AND s.tagline IS NOT NULL AND trim(s.tagline) != ''
  );

-- Step 3: Rebuild summaries table without the tagline column.
-- Preserves all other columns, including the Phase 91 structured fields.
CREATE TABLE summaries_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  title TEXT NOT NULL,
  role TEXT,
  description TEXT,
  is_template INTEGER NOT NULL DEFAULT 0,
  industry_id TEXT REFERENCES industries(id) ON DELETE SET NULL,
  role_type_id TEXT REFERENCES role_types(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO summaries_new (id, title, role, description, is_template,
  industry_id, role_type_id, notes, created_at, updated_at)
SELECT id, title, role, description, is_template,
  industry_id, role_type_id, notes, created_at, updated_at
FROM summaries;

DROP TABLE summaries;
ALTER TABLE summaries_new RENAME TO summaries;

-- Step 4: Recreate the indexes that existed on summaries (from 006 + 033).
CREATE INDEX idx_summaries_template ON summaries(is_template);
CREATE INDEX idx_summaries_industry_id ON summaries(industry_id);
CREATE INDEX idx_summaries_role_type_id ON summaries(role_type_id);
