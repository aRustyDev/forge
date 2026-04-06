-- Forge Resume Builder — Certification Schema Rework + Per-Resume Selection
-- Migration: 043_cert_schema_rework
-- Date: 2026-04-05
--
-- Rebuilds the certifications table with:
--   - name → short_name + long_name split
--   - cert_id (exam version code, nullable)
--   - issuer → issuer_id FK to organizations
--   - credly_url
--   - in_progress flag
--   - Drops education_source_id (UI already removed)
--
-- Creates resume_certifications junction table for per-resume cert selection.
-- Cleans up orphaned resume_entries from the old SourcePicker cert flow.
--
-- PRAGMA foreign_keys = OFF

-- Step 1: Rebuild certifications table
CREATE TABLE certifications_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  short_name TEXT NOT NULL,
  long_name TEXT NOT NULL,
  cert_id TEXT,
  issuer_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  date_earned TEXT,
  expiry_date TEXT,
  credential_id TEXT,
  credential_url TEXT,
  credly_url TEXT,
  in_progress INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Migrate existing data: name → both short_name and long_name
-- issuer (free text) → best-effort org lookup → issuer_id
INSERT INTO certifications_new (
  id, short_name, long_name, cert_id, issuer_id,
  date_earned, expiry_date, credential_id, credential_url, credly_url,
  in_progress, created_at, updated_at
)
SELECT
  c.id,
  c.name,
  c.name,
  NULL,
  (SELECT o.id FROM organizations o WHERE o.name = c.issuer LIMIT 1),
  c.date_earned,
  c.expiry_date,
  c.credential_id,
  c.credential_url,
  NULL,
  0,
  c.created_at,
  c.updated_at
FROM certifications c;

DROP TABLE certifications;
ALTER TABLE certifications_new RENAME TO certifications;
CREATE INDEX idx_certifications_issuer ON certifications(issuer_id);

-- Step 2: Create resume_certifications junction table
CREATE TABLE resume_certifications (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  certification_id TEXT NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES resume_sections(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(resume_id, certification_id)
) STRICT;

CREATE INDEX idx_resume_certs_resume ON resume_certifications(resume_id);
CREATE INDEX idx_resume_certs_section ON resume_certifications(section_id);

-- Step 3: Clean up orphaned resume_entries for cert sections
DELETE FROM resume_entries
WHERE section_id IN (
  SELECT rs.id FROM resume_sections rs WHERE rs.entry_type = 'certifications'
);
