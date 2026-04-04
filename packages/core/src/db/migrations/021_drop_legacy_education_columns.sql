-- Drop Legacy Education Columns
-- Migration: 021_drop_legacy_education_columns
-- Date: 2026-04-04
-- Removes deprecated institution and issuing_body columns from source_education.
-- These were replaced by organization_id FK in migration 010.
-- Stale text values were cleaned in migration 020.
-- Uses table rebuild pattern (SQLite cannot ALTER TABLE DROP COLUMN on STRICT tables).

PRAGMA foreign_keys = OFF;

-- **Note:** The migration runner wraps each migration in BEGIN/COMMIT.
-- PRAGMA foreign_keys = OFF is silently ignored inside an active transaction.
-- The PRAGMA calls are defensive only -- the actual FK protection comes from
-- the runner's transaction ensuring all statements execute atomically.
-- This is consistent with how migrations 002, 007, and 012 handle table rebuilds.

CREATE TABLE source_education_new (
  source_id TEXT PRIMARY KEY CHECK(typeof(source_id) = 'text' AND length(source_id) = 36)
    REFERENCES sources(id) ON DELETE CASCADE,
  education_type TEXT NOT NULL CHECK (education_type IN ('degree', 'certificate', 'course', 'self_taught')),
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  campus_id TEXT REFERENCES org_campuses(id) ON DELETE SET NULL,
  field TEXT,
  start_date TEXT,
  end_date TEXT,
  is_in_progress INTEGER NOT NULL DEFAULT 0,
  credential_id TEXT,
  expiration_date TEXT,
  url TEXT,
  degree_level TEXT CHECK (degree_level IS NULL OR degree_level IN (
    'associate', 'bachelors', 'masters', 'doctoral', 'graduate_certificate'
  )),
  degree_type TEXT,
  certificate_subtype TEXT CHECK (certificate_subtype IS NULL OR certificate_subtype IN (
    'professional', 'vendor', 'completion'
  )),
  gpa TEXT,
  location TEXT,
  edu_description TEXT
) STRICT;

INSERT INTO source_education_new (
  source_id, education_type, organization_id, campus_id, field,
  start_date, end_date, is_in_progress, credential_id, expiration_date,
  url, degree_level, degree_type, certificate_subtype, gpa,
  location, edu_description
)
SELECT
  source_id, education_type, organization_id, campus_id, field,
  start_date, end_date, is_in_progress, credential_id, expiration_date,
  url, degree_level, degree_type, certificate_subtype, gpa,
  location, edu_description
FROM source_education;

DROP TABLE source_education;
ALTER TABLE source_education_new RENAME TO source_education;

-- Recreate index on organization_id (from migration 010)
CREATE INDEX idx_source_education_org ON source_education(organization_id);

PRAGMA foreign_keys = ON;

INSERT INTO _migrations (name) VALUES ('021_drop_legacy_education_columns');
