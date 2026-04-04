-- Forge Resume Builder — Schema Evolution
-- Migration: 002_schema_evolution
-- Date: 2026-03-29
--
-- Evolves schema from v1 (employers/projects/source_id) to v2
-- (organizations/polymorphic sources/bullet_sources junction/resume_entries).
-- Follows DDL order from spec section 4 (20 steps).
--
-- IMPORTANT: Steps 6 and 11 use PRAGMA foreign_keys = OFF/ON around table
-- rebuilds. The migration runner's connection sets foreign_keys = ON, so we
-- must explicitly disable it when DROP/RENAME would temporarily break FKs.

-- Step 1: Create organizations table (replaces employers)
CREATE TABLE organizations (
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
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Step 2: Migrate employers -> organizations
INSERT INTO organizations (id, name, worked, org_type, created_at, updated_at)
  SELECT id, name, 1, 'company', created_at, created_at
  FROM employers;

-- Step 3: Add source_type and notes to sources
ALTER TABLE sources ADD COLUMN source_type TEXT NOT NULL DEFAULT 'general'
  CHECK (source_type IN ('role', 'project', 'education', 'clearance', 'general'));
ALTER TABLE sources ADD COLUMN notes TEXT;

-- Step 4: Create source extension tables
CREATE TABLE source_roles (
  source_id TEXT PRIMARY KEY CHECK(typeof(source_id) = 'text' AND length(source_id) = 36)
    REFERENCES sources(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  start_date TEXT,
  end_date TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  work_arrangement TEXT,
  base_salary INTEGER,
  total_comp_notes TEXT
) STRICT;

CREATE TABLE source_projects (
  source_id TEXT PRIMARY KEY CHECK(typeof(source_id) = 'text' AND length(source_id) = 36)
    REFERENCES sources(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  is_personal INTEGER NOT NULL DEFAULT 0,
  url TEXT,
  start_date TEXT,
  end_date TEXT
) STRICT;

CREATE TABLE source_education (
  source_id TEXT PRIMARY KEY CHECK(typeof(source_id) = 'text' AND length(source_id) = 36)
    REFERENCES sources(id) ON DELETE CASCADE,
  education_type TEXT NOT NULL CHECK (education_type IN ('degree', 'certificate', 'course', 'self_taught')),
  institution TEXT,
  field TEXT,
  start_date TEXT,
  end_date TEXT,
  is_in_progress INTEGER NOT NULL DEFAULT 0,
  credential_id TEXT,
  expiration_date TEXT,
  issuing_body TEXT,
  url TEXT
) STRICT;

CREATE TABLE source_clearances (
  source_id TEXT PRIMARY KEY CHECK(typeof(source_id) = 'text' AND length(source_id) = 36)
    REFERENCES sources(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  polygraph TEXT,
  status TEXT,
  sponsoring_agency TEXT,
  investigation_date TEXT,
  adjudication_date TEXT,
  reinvestigation_date TEXT,
  read_on TEXT
) STRICT;

-- Step 5: Migrate sources with employer_id to source_roles
UPDATE sources SET source_type = 'role' WHERE employer_id IS NOT NULL;

INSERT INTO source_roles (source_id, organization_id, start_date, end_date)
  SELECT id, employer_id, start_date, end_date
  FROM sources
  WHERE employer_id IS NOT NULL;

-- Step 6: Drop employer_id and project_id from sources (table rebuild)
-- IMPORTANT: Must disable FK enforcement during rebuild
PRAGMA foreign_keys = OFF;

CREATE TABLE sources_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'general'
    CHECK (source_type IN ('role', 'project', 'education', 'clearance', 'general')),
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'deriving')),
  updated_by TEXT NOT NULL DEFAULT 'human' CHECK(updated_by IN ('human', 'ai')),
  last_derived_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO sources_new (id, title, description, source_type, start_date, end_date, status, updated_by, last_derived_at, notes, created_at, updated_at)
  SELECT id, title, description, source_type, start_date, end_date, status, updated_by, last_derived_at, notes, created_at, updated_at
  FROM sources;

DROP TABLE sources;
ALTER TABLE sources_new RENAME TO sources;

CREATE INDEX idx_sources_status ON sources(status);
CREATE INDEX idx_sources_type ON sources(source_type);

PRAGMA foreign_keys = ON;

-- Step 7: Drop employers table (data migrated to organizations in step 2)
DROP TABLE employers;

-- Step 8: Drop projects table (subsumed by source_projects)
DROP INDEX IF EXISTS idx_projects_employer;
DROP TABLE projects;

-- Step 9: Create bullet_sources junction table
CREATE TABLE bullet_sources (
  bullet_id TEXT NOT NULL CHECK(typeof(bullet_id) = 'text' AND length(bullet_id) = 36)
    REFERENCES bullets(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL CHECK(typeof(source_id) = 'text' AND length(source_id) = 36)
    REFERENCES sources(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bullet_id, source_id)
) STRICT;

CREATE INDEX idx_bullet_sources_source ON bullet_sources(source_id);

-- Step 10: Migrate bullets.source_id -> bullet_sources
INSERT INTO bullet_sources (bullet_id, source_id, is_primary)
  SELECT id, source_id, 1
  FROM bullets;

-- Step 11: Drop source_id from bullets (table rebuild)
-- IMPORTANT: Must disable FK enforcement during rebuild
PRAGMA foreign_keys = OFF;

CREATE TABLE bullets_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  content TEXT NOT NULL,
  source_content_snapshot TEXT NOT NULL,
  metrics TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('draft', 'pending_review', 'approved', 'rejected')),
  rejection_reason TEXT,
  prompt_log_id TEXT REFERENCES prompt_logs(id) ON DELETE SET NULL,
  approved_at TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO bullets_new (id, content, source_content_snapshot, metrics, status, rejection_reason, prompt_log_id, approved_at, approved_by, created_at)
  SELECT id, content, source_content_snapshot, metrics, status, rejection_reason, prompt_log_id, approved_at, approved_by, created_at
  FROM bullets;

DROP TABLE bullets;
ALTER TABLE bullets_new RENAME TO bullets;

CREATE INDEX idx_bullets_status ON bullets(status);

PRAGMA foreign_keys = ON;

-- Step 12: Add notes to bullets
ALTER TABLE bullets ADD COLUMN notes TEXT;

-- Step 13: Add domain to bullets (for v1 framing import)
ALTER TABLE bullets ADD COLUMN domain TEXT;

-- Step 14: Add notes to perspectives, resumes
ALTER TABLE perspectives ADD COLUMN notes TEXT;
ALTER TABLE resumes ADD COLUMN notes TEXT;

-- Step 15: Create resume_entries table (replaces resume_perspectives)
CREATE TABLE resume_entries (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  perspective_id TEXT NOT NULL REFERENCES perspectives(id) ON DELETE RESTRICT,
  content TEXT,
  perspective_content_snapshot TEXT,
  section TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_resume_entries_resume ON resume_entries(resume_id, section, position);

-- Step 16: Migrate resume_perspectives -> resume_entries
INSERT INTO resume_entries (id, resume_id, perspective_id, content, section, position)
  SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    resume_id,
    perspective_id,
    NULL,
    section,
    position
  FROM resume_perspectives;

-- Step 17: Drop resume_perspectives (data migrated to resume_entries)
DROP INDEX IF EXISTS idx_resume_perspectives_resume;
DROP TABLE resume_perspectives;

-- Step 18: Create user_notes and note_references
CREATE TABLE user_notes (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  title TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE TABLE note_references (
  note_id TEXT NOT NULL CHECK(typeof(note_id) = 'text' AND length(note_id) = 36)
    REFERENCES user_notes(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'source', 'bullet', 'perspective', 'resume_entry',
    'resume', 'skill', 'organization'
  )),
  entity_id TEXT NOT NULL,
  PRIMARY KEY (note_id, entity_type, entity_id)
) STRICT;

CREATE INDEX idx_note_refs_entity ON note_references(entity_type, entity_id);

-- Step 19: Create v1_import_map for idempotent v1 data import
CREATE TABLE v1_import_map (
  v1_entity_type TEXT NOT NULL,
  v1_id INTEGER NOT NULL,
  forge_id TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (v1_entity_type, v1_id)
) STRICT;

-- Step 20: Add notes to skills
ALTER TABLE skills ADD COLUMN notes TEXT;

-- Register this migration
INSERT INTO _migrations (name) VALUES ('002_schema_evolution');
