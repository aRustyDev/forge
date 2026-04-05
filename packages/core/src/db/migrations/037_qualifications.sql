-- Forge Resume Builder — Qualifications (Credentials & Certifications)
-- Migration: 037_qualifications
-- Date: 2026-04-05
--
-- Implements the Qualifications track (Phases 84-88) from the spec at
-- refs/specs/2026-04-05-qualifications-credentials-certifications.md.
--
-- Clearances are currently modeled as source_type='clearance' with a
-- source_clearances extension table, but that's architecturally wrong —
-- a clearance is a boolean qualifier, not a source of narrative content.
-- This migration moves clearances and other credentials (licenses, bar
-- admissions) into a new `credentials` entity, and introduces a
-- `certifications` entity for skill-validating earned credentials.
--
-- Steps:
--   1. Create new tables (credentials, certifications, certification_skills)
--   2. Migrate existing clearance data from source_clearances → credentials
--   3. Delete orphaned clearance source rows (cascades to bullet_sources etc.)
--   4. Drop clearance_access_programs + source_clearances
--   5. Rebuild sources (remove 'clearance' from source_type CHECK)
--   6. Rebuild user_profile (drop clearance column)
--   7. Rebuild note_references (add 'credential' and 'certification' to CHECK)
--
-- Table rebuilds require PRAGMA foreign_keys = OFF, auto-detected by the
-- migration runner.
--
-- PRAGMA foreign_keys = OFF

-- =========================================================================
-- Step 1: Create new tables
-- =========================================================================

CREATE TABLE credentials (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  credential_type TEXT NOT NULL CHECK (credential_type IN (
    'clearance', 'drivers_license', 'bar_admission', 'medical_license'
  )),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'inactive', 'expired'
  )),
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  details TEXT NOT NULL DEFAULT '{}',  -- JSON, type-specific structured fields
  issued_date TEXT,    -- ISO 8601 date, nullable
  expiry_date TEXT,    -- ISO 8601 date, nullable
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_credentials_type ON credentials(credential_type);
CREATE INDEX idx_credentials_org ON credentials(organization_id);

CREATE TABLE certifications (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL,
  issuer TEXT,
  date_earned TEXT,     -- ISO 8601 date
  expiry_date TEXT,     -- ISO 8601 date, nullable
  credential_id TEXT,   -- issuer's credential ID string
  credential_url TEXT,  -- verification URL
  education_source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_certifications_source ON certifications(education_source_id);

CREATE TABLE certification_skills (
  certification_id TEXT NOT NULL
    REFERENCES certifications(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL
    REFERENCES skills(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (certification_id, skill_id)
) STRICT;

CREATE INDEX idx_certification_skills_skill ON certification_skills(skill_id);

-- =========================================================================
-- Step 2: Data migration — source_clearances → credentials
--
-- Each source_clearances row becomes a credentials row with
-- credential_type='clearance'. The details JSON packs level, polygraph,
-- clearance_type, and the aggregated access_programs array.
-- sponsor_organization_id (from source_clearances) → organization_id.
-- issued_date comes from the parent source's start_date.
-- =========================================================================

INSERT INTO credentials (
  id, credential_type, label, status, organization_id,
  details, issued_date, created_at, updated_at
)
SELECT
  -- UUID v4 generation (same pattern as migration 010/032/033)
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  'clearance',
  -- Friendly label derived from level enum
  CASE sc.level
    WHEN 'top_secret' THEN 'Top Secret'
    WHEN 'secret' THEN 'Secret'
    WHEN 'confidential' THEN 'Confidential'
    WHEN 'public' THEN 'Public Trust'
    WHEN 'q' THEN 'DOE Q'
    WHEN 'l' THEN 'DOE L'
    ELSE sc.level
  END AS label,
  -- source_clearances.status has values ('active','inactive'); map to
  -- credentials.status which also supports 'expired' for future use.
  COALESCE(sc.status, 'active'),
  sc.sponsor_organization_id,
  -- Pack type-specific fields into the details JSON. access_programs is a
  -- nested subquery that aggregates the clearance_access_programs rows for
  -- this clearance into a JSON array, or '[]' if none.
  json_object(
    'level', sc.level,
    'polygraph', sc.polygraph,
    'clearance_type', sc.type,
    'access_programs', COALESCE(
      (
        SELECT json_group_array(cap.program)
        FROM clearance_access_programs cap
        WHERE cap.source_id = sc.source_id
      ),
      json('[]')
    )
  ),
  s.start_date,
  s.created_at,
  s.updated_at
FROM source_clearances sc
JOIN sources s ON s.id = sc.source_id;

-- =========================================================================
-- Step 3: Delete orphaned clearance source rows
--
-- After the data migration, the sources rows with source_type='clearance'
-- have no remaining purpose. Cascade deletes clean up bullet_sources,
-- source_skills, and any other FK dependents automatically.
-- =========================================================================

DELETE FROM sources WHERE source_type = 'clearance';

-- =========================================================================
-- Step 4: Drop the old clearance infrastructure
-- =========================================================================

DROP TABLE clearance_access_programs;
DROP TABLE source_clearances;

-- =========================================================================
-- Step 5: Rebuild sources — remove 'clearance' from source_type CHECK
--
-- SQLite can't ALTER a CHECK constraint, so the whole table must be
-- rebuilt. All other columns and FKs are preserved.
-- =========================================================================

CREATE TABLE sources_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'general'
    CHECK (source_type IN ('role', 'project', 'education', 'general')),
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
    'draft', 'in_review', 'approved', 'rejected', 'archived', 'deriving'
  )),
  updated_by TEXT NOT NULL DEFAULT 'human' CHECK(updated_by IN ('human', 'ai')),
  last_derived_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO sources_new (id, title, description, source_type, start_date,
  end_date, status, updated_by, last_derived_at, notes, created_at, updated_at)
SELECT id, title, description, source_type, start_date, end_date, status,
  updated_by, last_derived_at, notes, created_at, updated_at
FROM sources;

DROP TABLE sources;
ALTER TABLE sources_new RENAME TO sources;

-- Recreate the indexes that existed on sources prior to the rebuild.
CREATE INDEX idx_sources_status ON sources(status);
CREATE INDEX idx_sources_source_type ON sources(source_type);

-- =========================================================================
-- Step 6: Rebuild user_profile — drop the clearance column
--
-- Clearance belongs on the credentials table now, not on the user profile.
-- All other columns including the salary_* additions from migration 027
-- are preserved.
-- =========================================================================

CREATE TABLE user_profile_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  linkedin TEXT,
  github TEXT,
  website TEXT,
  salary_minimum INTEGER,
  salary_target INTEGER,
  salary_stretch INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO user_profile_new (id, name, email, phone, location, linkedin,
  github, website, salary_minimum, salary_target, salary_stretch,
  created_at, updated_at)
SELECT id, name, email, phone, location, linkedin, github, website,
  salary_minimum, salary_target, salary_stretch, created_at, updated_at
FROM user_profile;

DROP TABLE user_profile;
ALTER TABLE user_profile_new RENAME TO user_profile;

-- =========================================================================
-- Step 7: Rebuild note_references — add credential + certification to CHECK
-- =========================================================================

CREATE TABLE note_references_new (
  note_id TEXT NOT NULL CHECK(typeof(note_id) = 'text' AND length(note_id) = 36)
    REFERENCES user_notes(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'source', 'bullet', 'perspective', 'resume_entry',
    'resume', 'skill', 'organization', 'job_description', 'contact',
    'credential', 'certification'
  )),
  entity_id TEXT NOT NULL,
  PRIMARY KEY (note_id, entity_type, entity_id)
) STRICT;

INSERT INTO note_references_new SELECT * FROM note_references;
DROP TABLE note_references;
ALTER TABLE note_references_new RENAME TO note_references;
