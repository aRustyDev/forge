-- Forge Resume Builder — Skills Expansion & Technology Absorption
-- Migration: 031_skills_expansion
-- Date: 2026-04-05
--
-- Expands the skills entity with:
--   1. A structured `category` CHECK enum (language, framework, platform, tool,
--      library, methodology, protocol, concept, soft_skill, other)
--   2. A `skill_domains` junction linking skills to the existing `domains` entity
--
-- Absorbs `bullet_technologies` into `bullet_skills`:
--   1. For each unique technology string, match to an existing skill by
--      case-insensitive name; if no match, create a new skill with category='other'
--   2. Convert each bullet_technologies row into a bullet_skills row (INSERT OR
--      IGNORE to dedup with any existing bullet_skills link)
--   3. DROP TABLE bullet_technologies
--
-- This requires a table rebuild on `skills` to add the CHECK constraint, so
-- PRAGMA foreign_keys = OFF is needed (auto-detected by migrate.ts).
--
-- PRAGMA foreign_keys = OFF

-- Step 1: Rebuild skills table with structured category CHECK
CREATE TABLE skills_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'language', 'framework', 'platform', 'tool', 'library',
    'methodology', 'protocol', 'concept', 'soft_skill', 'other'
  )),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Copy existing skills data, normalizing category to the new enum.
-- Anything that doesn't match a known category becomes 'other'.
INSERT INTO skills_new (id, name, category, notes, created_at)
SELECT
  id,
  name,
  CASE lower(COALESCE(category, ''))
    WHEN 'language' THEN 'language'
    WHEN 'framework' THEN 'framework'
    WHEN 'platform' THEN 'platform'
    WHEN 'tool' THEN 'tool'
    WHEN 'library' THEN 'library'
    WHEN 'methodology' THEN 'methodology'
    WHEN 'protocol' THEN 'protocol'
    WHEN 'concept' THEN 'concept'
    WHEN 'soft_skill' THEN 'soft_skill'
    WHEN 'soft skill' THEN 'soft_skill'
    ELSE 'other'
  END,
  notes,
  created_at
FROM skills;

DROP TABLE skills;
ALTER TABLE skills_new RENAME TO skills;

CREATE INDEX idx_skills_category ON skills(category);

-- Step 2: Create skill_domains junction table
CREATE TABLE skill_domains (
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (skill_id, domain_id)
) STRICT;

CREATE INDEX idx_skill_domains_domain ON skill_domains(domain_id);

-- Step 3: Absorb bullet_technologies into bullet_skills.
-- First, ensure every distinct technology string exists as a skill (case-insensitive match).
-- Skills created here get category='other' since we don't know their real category.
INSERT OR IGNORE INTO skills (id, name, category)
SELECT DISTINCT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  bt.technology,
  'other'
FROM bullet_technologies bt
WHERE NOT EXISTS (
  SELECT 1 FROM skills s WHERE lower(s.name) = lower(bt.technology)
);

-- Step 4: Convert bullet_technologies rows to bullet_skills rows.
-- INSERT OR IGNORE handles the case where the same (bullet, skill) pair already
-- exists in bullet_skills from a prior source_skills → bullet_skills sync.
INSERT OR IGNORE INTO bullet_skills (bullet_id, skill_id)
SELECT
  bt.bullet_id,
  s.id
FROM bullet_technologies bt
JOIN skills s ON lower(s.name) = lower(bt.technology);

-- Step 5: Drop bullet_technologies table
DROP TABLE bullet_technologies;
