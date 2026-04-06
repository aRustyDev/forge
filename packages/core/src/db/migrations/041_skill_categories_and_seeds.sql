-- Forge Resume Builder — Expanded Skill Categories
-- Migration: 041_skill_categories_and_seeds
-- Date: 2026-04-05
--
-- Adds 4 new skill categories (ai_ml, infrastructure, data_systems, security)
-- to the skills CHECK enum via table rebuild.
--
-- Skill seeding is done via a separate one-time script on the live DB
-- (not in the migration) to avoid UNIQUE constraint collisions with
-- test fixtures.
--
-- PRAGMA foreign_keys = OFF

CREATE TABLE skills_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'language', 'framework', 'platform', 'tool', 'library',
    'methodology', 'protocol', 'concept', 'soft_skill',
    'ai_ml', 'infrastructure', 'data_systems', 'security',
    'other'
  )),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO skills_new (id, name, category, notes, created_at)
SELECT id, name, category, notes, created_at FROM skills;

DROP TABLE skills;
ALTER TABLE skills_new RENAME TO skills;

CREATE INDEX idx_skills_category ON skills(category);
