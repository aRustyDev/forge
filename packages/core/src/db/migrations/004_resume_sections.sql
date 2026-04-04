-- Forge Resume Builder — Resume Sections as Entities
-- Migration: 004_resume_sections
-- Date: 2026-03-30
--
-- Promotes resume sections from hardcoded strings to first-class entities.
-- Creates resume_sections and resume_skills tables, migrates existing data,
-- and rebuilds resume_entries to replace the section string with section_id FK.
-- Builds on 003_renderer_and_entities.

-- ── New tables ──────────────────────────────────────────────────────────

-- Step 1: Create resume_sections table
CREATE TABLE resume_sections (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'experience', 'skills', 'education', 'projects',
    'clearance', 'presentations', 'certifications', 'awards', 'freeform'
  )),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_resume_sections_resume ON resume_sections(resume_id, position);

-- Step 2: Create resume_skills table
CREATE TABLE resume_skills (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  section_id TEXT NOT NULL REFERENCES resume_sections(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(section_id, skill_id)
) STRICT;

CREATE INDEX idx_resume_skills_section ON resume_skills(section_id, position);

-- ── Data migration ──────────────────────────────────────────────────────

-- Step 3: Add section_id column to resume_entries (temporary, nullable)
ALTER TABLE resume_entries ADD COLUMN section_id TEXT REFERENCES resume_sections(id) ON DELETE CASCADE;

-- Step 4: Convert summary entries to freeform (copy perspective content, null out perspective_id)
UPDATE resume_entries
SET content = (SELECT p.content FROM perspectives p WHERE p.id = resume_entries.perspective_id),
    perspective_id = NULL
WHERE section = 'summary'
  AND perspective_id IS NOT NULL;

-- Step 5: Create sections from distinct (resume_id, section) pairs
INSERT INTO resume_sections (id, resume_id, title, entry_type, position)
  SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    resume_id,
    CASE section
      WHEN 'experience' THEN 'Experience'
      WHEN 'summary' THEN 'Summary'
      WHEN 'skills' THEN 'Technical Skills'
      WHEN 'education' THEN 'Education & Certifications'
      WHEN 'projects' THEN 'Selected Projects'
      WHEN 'clearance' THEN 'Security Clearance'
      WHEN 'presentations' THEN 'Presentations'
      ELSE section
    END,
    CASE section
      WHEN 'summary' THEN 'freeform'
      ELSE section
    END,
    CASE section
      WHEN 'summary' THEN 0
      WHEN 'experience' THEN 1
      WHEN 'skills' THEN 2
      WHEN 'education' THEN 3
      WHEN 'projects' THEN 4
      WHEN 'clearance' THEN 5
      WHEN 'presentations' THEN 6
      ELSE 7
    END
  FROM (SELECT DISTINCT resume_id, section FROM resume_entries);

-- Step 6: Update entries to reference sections
UPDATE resume_entries SET section_id = (
  SELECT rs.id FROM resume_sections rs
  WHERE rs.resume_id = resume_entries.resume_id
  AND rs.entry_type = CASE resume_entries.section
    WHEN 'summary' THEN 'freeform'
    ELSE resume_entries.section
  END
);

-- Step 7: Auto-populate resume_skills from existing bullet_skills data
INSERT INTO resume_skills (id, section_id, skill_id, position)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  rs.id,
  bs.skill_id,
  ROW_NUMBER() OVER (PARTITION BY rs.id ORDER BY bs.skill_id) - 1
FROM resume_sections rs
JOIN resume_entries re ON re.section_id = rs.id
JOIN perspectives p ON p.id = re.perspective_id
JOIN bullet_skills bs ON bs.bullet_id = p.bullet_id
WHERE rs.entry_type = 'skills'
GROUP BY rs.id, bs.skill_id;

-- ── Table rebuild ───────────────────────────────────────────────────────

-- Step 8: Table rebuild — drop section column, enforce section_id NOT NULL,
-- make perspective_id nullable. MUST include perspective_content_snapshot
-- and notes columns to preserve data.

-- IMPORTANT: Must disable FK enforcement during table rebuild.
-- The migration runner's connection sets foreign_keys = ON. Table rebuilds
-- (DROP + RENAME) temporarily break FK references, so enforcement must be
-- explicitly disabled. (Same pattern as migration 002, steps 6 and 11.)
PRAGMA foreign_keys = OFF;

CREATE TABLE resume_entries_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES resume_sections(id) ON DELETE CASCADE,
  perspective_id TEXT REFERENCES perspectives(id) ON DELETE RESTRICT,
  content TEXT,
  perspective_content_snapshot TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO resume_entries_new (id, resume_id, section_id, perspective_id, content, perspective_content_snapshot, position, notes, created_at, updated_at)
  SELECT id, resume_id, section_id, perspective_id, content, perspective_content_snapshot, position, notes, created_at, updated_at
  FROM resume_entries;

DROP TABLE resume_entries;
ALTER TABLE resume_entries_new RENAME TO resume_entries;

-- Recreate indexes
CREATE INDEX idx_resume_entries_section ON resume_entries(section_id, position);
CREATE INDEX idx_resume_entries_resume ON resume_entries(resume_id);

PRAGMA foreign_keys = ON;

-- Step 9: Register migration
INSERT INTO _migrations (name) VALUES ('004_resume_sections');
