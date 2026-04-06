-- Forge Resume Builder — Presentations Entity
-- Migration: 039_presentations
-- Date: 2026-04-05
--
-- Adds 'presentation' to the sources.source_type CHECK constraint and
-- creates the source_presentations extension table. Requires a table
-- rebuild on sources since SQLite doesn't support ALTER CHECK.
--
-- PRAGMA foreign_keys = OFF

-- Step 1: Rebuild sources table with updated CHECK constraint
CREATE TABLE sources_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'general'
    CHECK (source_type IN ('role', 'project', 'education', 'general', 'presentation')),
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
    'draft', 'in_review', 'approved', 'rejected', 'archived', 'deriving'
  )),
  updated_by TEXT NOT NULL DEFAULT 'human' CHECK(updated_by IN ('human', 'ai')),
  last_derived_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO sources_new SELECT * FROM sources;
DROP TABLE sources;
ALTER TABLE sources_new RENAME TO sources;

-- Re-create indexes that were on the original table
CREATE INDEX idx_sources_status ON sources(status);
CREATE INDEX idx_sources_source_type ON sources(source_type);

-- Step 2: Create source_presentations extension table
CREATE TABLE source_presentations (
  source_id TEXT PRIMARY KEY
    CHECK(typeof(source_id) = 'text' AND length(source_id) = 36)
    REFERENCES sources(id) ON DELETE CASCADE,
  venue TEXT,
  presentation_type TEXT NOT NULL DEFAULT 'conference_talk'
    CHECK (presentation_type IN (
      'conference_talk', 'workshop', 'poster', 'webinar',
      'lightning_talk', 'panel', 'internal'
    )),
  url TEXT,
  coauthors TEXT
) STRICT;
