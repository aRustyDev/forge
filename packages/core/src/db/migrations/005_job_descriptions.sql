-- Forge Resume Builder -- Job Descriptions Entity
-- Migration: 005_job_descriptions
-- Date: 2026-03-30
--
-- Adds a table for storing job descriptions linked to organizations.
-- Rebuilds note_references to add 'job_description' to entity_type CHECK.
-- NOTE: Numbered 005 for local dev; will rename to 007 when 005/006 land.

-- Step 1: Create job_descriptions table
CREATE TABLE job_descriptions (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT,
  raw_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN (
    'interested', 'analyzing', 'applied', 'interviewing',
    'offered', 'rejected', 'withdrawn', 'closed'
  )),
  salary_range TEXT,
  location TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_job_descriptions_org ON job_descriptions(organization_id);
CREATE INDEX idx_job_descriptions_status ON job_descriptions(status);

-- Step 2: Disable FK checks for the note_references rebuild
PRAGMA foreign_keys = OFF;

-- Step 3: Rebuild note_references to add 'job_description' to entity_type CHECK constraint
-- The original CHECK constraint (migration 002) lists:
--   'source', 'bullet', 'perspective', 'resume_entry', 'resume', 'skill', 'organization'
-- SQLite does not support ALTER CHECK, so a table rebuild is needed.
CREATE TABLE note_references_new (
  note_id TEXT NOT NULL CHECK(typeof(note_id) = 'text' AND length(note_id) = 36)
    REFERENCES user_notes(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'source', 'bullet', 'perspective', 'resume_entry',
    'resume', 'skill', 'organization', 'job_description'
  )),
  entity_id TEXT NOT NULL,
  PRIMARY KEY (note_id, entity_type, entity_id)
) STRICT;

INSERT INTO note_references_new SELECT * FROM note_references;
DROP TABLE note_references;
ALTER TABLE note_references_new RENAME TO note_references;
CREATE INDEX idx_note_refs_entity ON note_references(entity_type, entity_id);

-- Step 4: Re-enable FK checks
PRAGMA foreign_keys = ON;

-- Step 5: Register migration
INSERT INTO _migrations (name) VALUES ('005_job_descriptions');
