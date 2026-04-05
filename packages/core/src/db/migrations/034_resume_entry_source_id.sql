-- Forge Resume Builder — Resume Entry Direct Source Link
-- Migration: 034_resume_entry_source_id
-- Date: 2026-04-05
--
-- Adds a `source_id` column to `resume_entries` so a resume entry can link
-- directly to a source (in addition to, or instead of, linking via
-- `perspective_id` → perspective → bullet → bullet_sources → source).
--
-- Motivation: certain source types (education degrees/certificates,
-- clearances, some freeform content) don't have derived perspectives yet
-- the user legitimately wants to add them to a resume. The prior
-- SourcePicker flow inserted such entries with `perspective_id = NULL`
-- and `content = <source description>`, which caused the IR compiler to
-- silently drop them (the compiler joined perspectives via INNER JOIN,
-- dropping any entry with a null perspective_id).
--
-- With a direct `source_id` link, the compiler can LEFT JOIN perspectives
-- and fall back to the direct source via COALESCE(bs.source_id, re.source_id)
-- so entries always render and always retain structured data from the
-- source's extension tables (source_education, source_clearances, etc.).
--
-- This column is nullable — existing entries linked via perspective_id only
-- stay unchanged, and content-only entries with no source (e.g. pure
-- freeform user-typed entries) stay legal. At least one of perspective_id,
-- source_id, or content must be populated, but that constraint is enforced
-- at the application layer rather than as a CHECK (to preserve migration
-- safety for any existing rows).

ALTER TABLE resume_entries ADD COLUMN source_id TEXT REFERENCES sources(id) ON DELETE SET NULL;

-- Index for the compiler's COALESCE join path so lookups by direct source
-- stay fast even on large resumes.
CREATE INDEX idx_resume_entries_source ON resume_entries(source_id);
