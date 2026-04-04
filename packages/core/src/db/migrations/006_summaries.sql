-- Forge Resume Builder -- Summaries as Standalone Entities
-- Migration: 006_summaries
-- Date: 2026-03-31
--
-- Extracts resume summaries from the header JSON blob into a standalone table.
-- Adds summary_id FK to resumes.
-- Data migration is handled by 006_summaries_data.ts (TypeScript helper).
-- Note: 006's DDL is schema-independent of 005_user_profile.

-- Step 1: Create summaries table
CREATE TABLE summaries (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  title TEXT NOT NULL,
  role TEXT,
  tagline TEXT,
  description TEXT,
  is_template INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_summaries_template ON summaries(is_template);

-- Step 2: Add summary_id to resumes
ALTER TABLE resumes ADD COLUMN summary_id TEXT REFERENCES summaries(id) ON DELETE SET NULL;

-- Step 3: Register migration
INSERT INTO _migrations (name) VALUES ('006_summaries');
