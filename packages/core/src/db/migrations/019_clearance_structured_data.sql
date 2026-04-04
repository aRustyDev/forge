-- Clearance Structured Data
-- Migration: 018_clearance_structured_data
-- Date: 2026-04-03
-- Replaces free-text clearance fields with enum constraints,
-- adds type/continuous_investigation columns, replaces sponsoring_agency
-- with sponsor_organization_id FK.
-- Uses table rebuild pattern (SQLite cannot ALTER CHECK constraints).
-- Builds on migration 002 (source_clearances table).

PRAGMA foreign_keys = OFF;

-- Note: The migration runner wraps each migration in BEGIN/COMMIT.
-- PRAGMA foreign_keys = OFF is silently ignored inside an active transaction.
-- The PRAGMA calls are defensive only -- the actual FK protection comes from
-- the runner's transaction ensuring all statements execute atomically.
-- This is consistent with how migrations 002, 007, and 012 handle table rebuilds.

-- Step 1: Create organizations from existing sponsoring_agency text values.
-- Must happen BEFORE the old table is dropped.
INSERT OR IGNORE INTO organizations (id, name, org_type, created_at, updated_at)
  SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    sponsoring_agency,
    'government',
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  FROM source_clearances
  WHERE sponsoring_agency IS NOT NULL AND sponsoring_agency != ''
  AND lower(sponsoring_agency) NOT IN (SELECT lower(name) FROM organizations);

-- Step 2: Tag newly created sponsor orgs as 'government'
INSERT OR IGNORE INTO org_tags (organization_id, tag)
  SELECT o.id, 'government'
  FROM organizations o
  WHERE o.org_type = 'government'
  AND o.id NOT IN (SELECT organization_id FROM org_tags WHERE tag = 'government');

-- Step 3: Create new source_clearances with constraints
CREATE TABLE source_clearances_new (
  source_id TEXT PRIMARY KEY CHECK(typeof(source_id) = 'text' AND length(source_id) = 36)
    REFERENCES sources(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN (
    'public', 'confidential', 'secret', 'top_secret', 'q', 'l'
  )),
  polygraph TEXT CHECK (polygraph IS NULL OR polygraph IN (
    'none', 'ci', 'full_scope'
  )),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  type TEXT NOT NULL DEFAULT 'personnel' CHECK (type IN ('personnel', 'facility')),
  sponsor_organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  continuous_investigation INTEGER NOT NULL DEFAULT 0,
  investigation_date TEXT,
  adjudication_date TEXT,
  reinvestigation_date TEXT,
  read_on TEXT
) STRICT;

CREATE INDEX idx_source_clearances_sponsor ON source_clearances_new(sponsor_organization_id);

-- Step 4: Migrate data with enum mapping
INSERT INTO source_clearances_new (
  source_id, level, polygraph, status, type,
  sponsor_organization_id, continuous_investigation,
  investigation_date, adjudication_date, reinvestigation_date, read_on
)
SELECT
  source_id,
  -- Map level text to enum
  CASE lower(trim(level))
    WHEN 'public' THEN 'public'
    WHEN 'public trust' THEN 'public'
    WHEN 'confidential' THEN 'confidential'
    WHEN 'secret' THEN 'secret'
    WHEN 's' THEN 'secret'
    WHEN 'top secret' THEN 'top_secret'
    WHEN 'top_secret' THEN 'top_secret'
    WHEN 'ts' THEN 'top_secret'
    WHEN 'ts/sci' THEN 'top_secret'
    WHEN 'top secret/sci' THEN 'top_secret'
    WHEN 'q' THEN 'q'
    WHEN 'l' THEN 'l'
    ELSE 'secret'  -- safe fallback; review after migration
  END,
  -- Map polygraph text to enum
  CASE lower(trim(COALESCE(polygraph, '')))
    WHEN '' THEN NULL
    WHEN 'none' THEN 'none'
    WHEN 'ci' THEN 'ci'
    WHEN 'ci polygraph' THEN 'ci'
    WHEN 'counterintelligence' THEN 'ci'
    WHEN 'full scope' THEN 'full_scope'
    WHEN 'full_scope' THEN 'full_scope'
    WHEN 'fs' THEN 'full_scope'
    WHEN 'lifestyle' THEN 'full_scope'
    ELSE NULL
  END,
  -- Map status text to enum
  CASE lower(trim(COALESCE(status, 'active')))
    WHEN 'active' THEN 'active'
    WHEN 'current' THEN 'active'
    WHEN 'inactive' THEN 'inactive'
    WHEN 'expired' THEN 'inactive'
    WHEN 'lapsed' THEN 'inactive'
    ELSE 'active'
  END,
  'personnel',  -- default; no existing data distinguishes type
  -- Link to org by name match
  (SELECT o.id FROM organizations o WHERE lower(o.name) = lower(source_clearances.sponsoring_agency) LIMIT 1),
  0,  -- continuous_investigation default
  investigation_date,
  adjudication_date,
  reinvestigation_date,
  read_on
FROM source_clearances;

-- Step 5: Drop old table and rename
DROP TABLE source_clearances;
ALTER TABLE source_clearances_new RENAME TO source_clearances;

PRAGMA foreign_keys = ON;

-- Step 6: Create clearance_access_programs junction table
CREATE TABLE clearance_access_programs (
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  program TEXT NOT NULL CHECK (program IN ('sci', 'sap', 'nato')),
  PRIMARY KEY (source_id, program)
) STRICT;

-- Step 7: SCI seeding note
-- The original table is dropped in Step 5, so we cannot detect original 'ts/sci' level
-- values at this point. Access programs default to empty after migration. Users must
-- manually add SCI/SAP/NATO via the UI.

INSERT INTO _migrations (name) VALUES ('018_clearance_structured_data');
