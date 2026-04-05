-- Forge Resume Builder — Summary Structured Fields
-- Migration: 033_summary_structured_fields
-- Date: 2026-04-05
--
-- Adds structured fields to summaries (industry_id, role_type_id FKs) and a
-- summary_skills junction table for keyword tagging. This lets summaries be
-- filtered/grouped by industry, role type, and skill keywords.
--
-- NOTE: The `tagline` column is intentionally preserved here. It is marked
-- for removal in Phase 92 (Tagline Engine), which will move tagline data to
-- resume-level `generated_tagline` / `tagline_override` fields with automatic
-- regeneration from linked JDs. Dropping tagline in this migration would
-- break the IR compiler, resume templates, latex/markdown compilers, and
-- the HeaderEditor mid-phase. Phase 92 owns the full lifecycle.

-- Step 1: Add industry_id FK to summaries (nullable, SET NULL on industry delete).
ALTER TABLE summaries ADD COLUMN industry_id TEXT
  REFERENCES industries(id) ON DELETE SET NULL;

-- Step 2: Add role_type_id FK to summaries (nullable, SET NULL on role_type delete).
ALTER TABLE summaries ADD COLUMN role_type_id TEXT
  REFERENCES role_types(id) ON DELETE SET NULL;

-- Step 3: Create summary_skills junction table (keyword tagging).
-- Composite PK prevents duplicate links. Cascade deletes from both sides.
CREATE TABLE summary_skills (
  summary_id TEXT NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (summary_id, skill_id)
) STRICT;

-- Step 4: Indexes for the new FKs and junction reverse-lookup.
CREATE INDEX idx_summaries_industry_id ON summaries(industry_id);
CREATE INDEX idx_summaries_role_type_id ON summaries(role_type_id);
CREATE INDEX idx_summary_skills_skill ON summary_skills(skill_id);
