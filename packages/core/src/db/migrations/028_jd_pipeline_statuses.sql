-- JD Pipeline Statuses
-- Migration: 028_jd_pipeline_statuses
-- Expands job_descriptions.status CHECK for pipeline kanban.
-- Adds: discovered, applying
-- Renames: interested -> discovered
-- Uses table rebuild pattern (SQLite cannot ALTER CHECK constraints).
-- Preserves salary_min/salary_max from migration 027.

-- PRAGMA foreign_keys = OFF is defensive -- prevents cascade deletes on
-- junction tables (job_description_skills, job_description_resumes)
-- during the DROP TABLE + RENAME sequence.
PRAGMA foreign_keys = OFF;

CREATE TABLE job_descriptions_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT,
  raw_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'analyzing', 'applying', 'applied', 'interviewing',
    'offered', 'rejected', 'withdrawn', 'closed'
  )),
  salary_range TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  location TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Migrate data: rename 'interested' -> 'discovered', preserve all others.
INSERT INTO job_descriptions_new (id, organization_id, title, url, raw_text,
  status, salary_range, salary_min, salary_max, location, notes, created_at, updated_at)
SELECT id, organization_id, title, url, raw_text,
  CASE status
    WHEN 'interested' THEN 'discovered'
    ELSE status
  END,
  salary_range, salary_min, salary_max, location, notes, created_at, updated_at
FROM job_descriptions;

DROP TABLE job_descriptions;
ALTER TABLE job_descriptions_new RENAME TO job_descriptions;

-- Recreate indexes that were lost during table rebuild.
CREATE INDEX idx_job_descriptions_org ON job_descriptions(organization_id);
CREATE INDEX idx_job_descriptions_status ON job_descriptions(status);

-- Junction tables referencing job_descriptions(id):
-- job_description_skills: references job_descriptions(id) ON DELETE CASCADE.
-- job_description_resumes: references job_descriptions(id) ON DELETE CASCADE.
-- Same IDs preserved; no action needed.

-- Recreate the updated_at trigger after the table rebuild.
-- Without this, updating a JD will no longer auto-set updated_at.
CREATE TRIGGER jd_updated_at AFTER UPDATE ON job_descriptions
BEGIN
  UPDATE job_descriptions SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id;
END;

PRAGMA foreign_keys = ON;

INSERT INTO _migrations (name) VALUES ('028_jd_pipeline_statuses');
