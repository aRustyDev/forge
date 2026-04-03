-- Organization Kanban Statuses
-- Migration: 012_org_kanban_statuses
-- Date: 2026-04-03
-- Expands organizations.status CHECK constraint for kanban pipeline.
-- Uses table rebuild pattern (SQLite cannot ALTER CHECK constraints).
-- Builds on 011_org_tags.

PRAGMA foreign_keys = OFF;

-- **Note:** The migration runner wraps each migration in BEGIN/COMMIT.
-- `PRAGMA foreign_keys = OFF` is silently ignored inside an active transaction.
-- The PRAGMA calls are defensive only — the actual FK protection comes from
-- the runner's transaction ensuring all statements execute atomically.
-- This is consistent with how migrations 002 and 007 handle table rebuilds.

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
  location TEXT,
  headquarters TEXT,
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

-- Status remapping done inline via CASE WHEN to avoid CHECK constraint violations on the source table.
INSERT INTO organizations_new (id, name, org_type, industry, size, worked, employment_type,
  location, headquarters, website, linkedin_url, glassdoor_url, glassdoor_rating,
  reputation_notes, notes, status, created_at, updated_at)
SELECT id, name, org_type, industry, size, worked, employment_type,
  location, headquarters, website, linkedin_url, glassdoor_url, glassdoor_rating,
  reputation_notes, notes,
  CASE status
    WHEN 'interested' THEN 'backlog'
    WHEN 'review' THEN 'researching'
    WHEN 'targeting' THEN 'interested'
    ELSE status
  END,
  created_at, updated_at
FROM organizations;

-- Swap tables
DROP TABLE organizations;
ALTER TABLE organizations_new RENAME TO organizations;

-- Create index on name (new — improves picker search performance)
CREATE INDEX idx_organizations_name ON organizations(name);

PRAGMA foreign_keys = ON;

-- Note: org_tags FK references organizations(id) via ON DELETE CASCADE.
-- Since we INSERT all rows into the new table with the same IDs before
-- dropping the old table, and PRAGMA foreign_keys is OFF during the
-- rebuild, no FK violations occur. After PRAGMA foreign_keys = ON,
-- the org_tags rows still reference valid organization IDs.

INSERT INTO _migrations (name) VALUES ('012_org_kanban_statuses');
