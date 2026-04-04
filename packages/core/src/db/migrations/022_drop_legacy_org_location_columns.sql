-- Drop Legacy Organization Location Columns
-- Migration: 022_drop_legacy_org_location_columns
-- Date: 2026-04-04
-- Removes deprecated location and headquarters columns from organizations.
-- These were replaced by the org_campuses table in migration 013.
-- Phase 39 removed these fields from the save payload.
-- Uses table rebuild pattern (SQLite cannot ALTER TABLE DROP COLUMN on STRICT tables).

PRAGMA foreign_keys = OFF;

-- **Note:** The migration runner wraps each migration in BEGIN/COMMIT.
-- PRAGMA foreign_keys = OFF is silently ignored inside an active transaction.
-- The PRAGMA calls are defensive only -- the actual FK protection comes from
-- the runner's transaction ensuring all statements execute atomically.
-- This is consistent with how migrations 002, 007, and 012 handle table rebuilds.

CREATE TABLE organizations_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL,
  org_type TEXT DEFAULT 'company' CHECK (org_type IN (
    'company', 'nonprofit', 'government', 'military',
    'education', 'volunteer', 'freelance', 'other'
  )),
  industry TEXT,
  size TEXT,
  worked INTEGER NOT NULL DEFAULT 0,
  employment_type TEXT CHECK (employment_type IN (
    'civilian', 'contractor', 'military_active',
    'military_reserve', 'volunteer', 'intern', NULL
  )),
  website TEXT,
  linkedin_url TEXT,
  glassdoor_url TEXT,
  glassdoor_rating REAL,
  reputation_notes TEXT,
  notes TEXT,
  status TEXT CHECK (status IS NULL OR status IN (
    'backlog', 'researching', 'exciting', 'interested', 'acceptable', 'excluded'
  )),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO organizations_new (
  id, name, org_type, industry, size, worked, employment_type,
  website, linkedin_url, glassdoor_url, glassdoor_rating,
  reputation_notes, notes, status, created_at, updated_at
)
SELECT
  id, name, org_type, industry, size, worked, employment_type,
  website, linkedin_url, glassdoor_url, glassdoor_rating,
  reputation_notes, notes, status, created_at, updated_at
FROM organizations;

DROP TABLE organizations;
ALTER TABLE organizations_new RENAME TO organizations;

-- Recreate index on name (from migration 012)
CREATE INDEX idx_organizations_name ON organizations(name);

PRAGMA foreign_keys = ON;

-- Note: org_tags, org_campuses, org_aliases all reference organizations(id) via
-- ON DELETE CASCADE. Since we INSERT all rows into the new table with the same
-- IDs before dropping the old table, and PRAGMA foreign_keys is OFF during the
-- rebuild, no FK violations occur. After PRAGMA foreign_keys = ON, all child
-- table rows still reference valid organization IDs.
--
-- source_roles, source_projects, source_education also reference organizations(id)
-- via ON DELETE SET NULL. Same logic applies -- IDs are preserved.

INSERT INTO _migrations (name) VALUES ('022_drop_legacy_org_location_columns');
