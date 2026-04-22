-- Notes Normalization
-- Migration: 048_notes_normalization
-- Date: 2026-04-15
--
-- Moves all non-null inline `notes` columns from 8 entity tables into the
-- existing user_notes + note_references tables, then drops the `notes` columns
-- via table rebuild (STRICT tables don't support ALTER TABLE DROP COLUMN).
--
-- Affected tables:
--   sources (19 notes), bullets (74), perspectives (0), resumes (3),
--   resume_entries (37), skills (5), organizations (13 + drop reputation_notes),
--   job_descriptions (2)
-- Total: 153 inline notes to migrate.

-- Required for table rebuild — prevents FK cascade deletes on child tables
-- during the DROP TABLE + RENAME sequence.
PRAGMA foreign_keys = OFF;

-- ══════════════════════════════════════════════════════════════════════════════
-- Step 1: Create temp mapping table for UUID tracking
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TEMP TABLE _notes_map (
  note_uuid TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  content TEXT NOT NULL
);

-- ══════════════════════════════════════════════════════════════════════════════
-- Step 2: Extract inline notes into _notes_map with generated UUIDs
-- ══════════════════════════════════════════════════════════════════════════════

-- sources (19 non-null)
INSERT INTO _notes_map (note_uuid, entity_type, entity_id, content)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'source', id, notes
FROM sources WHERE notes IS NOT NULL AND notes <> '';

-- bullets (74 non-null)
INSERT INTO _notes_map (note_uuid, entity_type, entity_id, content)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'bullet', id, notes
FROM bullets WHERE notes IS NOT NULL AND notes <> '';

-- perspectives (0 non-null, but handle any that might exist)
INSERT INTO _notes_map (note_uuid, entity_type, entity_id, content)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'perspective', id, notes
FROM perspectives WHERE notes IS NOT NULL AND notes <> '';

-- resumes (3 non-null)
INSERT INTO _notes_map (note_uuid, entity_type, entity_id, content)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'resume', id, notes
FROM resumes WHERE notes IS NOT NULL AND notes <> '';

-- resume_entries (37 non-null)
INSERT INTO _notes_map (note_uuid, entity_type, entity_id, content)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'resume_entry', id, notes
FROM resume_entries WHERE notes IS NOT NULL AND notes <> '';

-- skills (5 non-null)
INSERT INTO _notes_map (note_uuid, entity_type, entity_id, content)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'skill', id, notes
FROM skills WHERE notes IS NOT NULL AND notes <> '';

-- organizations (13 non-null; reputation_notes has 0, just drop it)
INSERT INTO _notes_map (note_uuid, entity_type, entity_id, content)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'organization', id, notes
FROM organizations WHERE notes IS NOT NULL AND notes <> '';

-- job_descriptions (2 non-null)
INSERT INTO _notes_map (note_uuid, entity_type, entity_id, content)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'job_description', id, notes
FROM job_descriptions WHERE notes IS NOT NULL AND notes <> '';

-- ══════════════════════════════════════════════════════════════════════════════
-- Step 3: Insert into user_notes and note_references from _notes_map
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO user_notes (id, title, content, created_at, updated_at)
SELECT
  note_uuid,
  NULL,
  content,
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM _notes_map;

INSERT INTO note_references (note_id, entity_type, entity_id)
SELECT note_uuid, entity_type, entity_id
FROM _notes_map;

-- ══════════════════════════════════════════════════════════════════════════════
-- Step 4: Rebuild tables without notes columns
-- ══════════════════════════════════════════════════════════════════════════════

-- == sources ==================================================================

CREATE TABLE sources_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'general'
    CHECK (source_type IN ('role', 'project', 'education', 'general', 'presentation')),
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
    'draft', 'in_review', 'approved', 'rejected', 'archived', 'deriving'
  )),
  updated_by TEXT NOT NULL DEFAULT 'human' CHECK(updated_by IN ('human', 'ai')),
  last_derived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO sources_new (id, title, description, source_type, start_date, end_date,
  status, updated_by, last_derived_at, created_at, updated_at)
SELECT id, title, description, source_type, start_date, end_date,
  status, updated_by, last_derived_at, created_at, updated_at
FROM sources;

DROP TABLE sources;
ALTER TABLE sources_new RENAME TO sources;

CREATE INDEX idx_sources_status ON sources(status);
CREATE INDEX idx_sources_source_type ON sources(source_type);

-- == bullets ==================================================================

CREATE TABLE bullets_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  content TEXT NOT NULL,
  source_content_snapshot TEXT NOT NULL,
  metrics TEXT,
  status TEXT NOT NULL DEFAULT 'in_review' CHECK(status IN (
    'draft', 'in_review', 'approved', 'rejected', 'archived'
  )),
  rejection_reason TEXT,
  prompt_log_id TEXT REFERENCES prompt_logs(id) ON DELETE SET NULL,
  approved_at TEXT,
  approved_by TEXT,
  domain TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO bullets_new (id, content, source_content_snapshot, metrics, status,
  rejection_reason, prompt_log_id, approved_at, approved_by, domain, created_at)
SELECT id, content, source_content_snapshot, metrics, status,
  rejection_reason, prompt_log_id, approved_at, approved_by, domain, created_at
FROM bullets;

DROP TABLE bullets;
ALTER TABLE bullets_new RENAME TO bullets;

CREATE INDEX idx_bullets_status ON bullets(status);

-- == perspectives =============================================================

CREATE TABLE perspectives_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  bullet_id TEXT NOT NULL REFERENCES bullets(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  bullet_content_snapshot TEXT NOT NULL,
  target_archetype TEXT,
  domain TEXT,
  framing TEXT NOT NULL CHECK(framing IN ('accomplishment', 'responsibility', 'context')),
  status TEXT NOT NULL DEFAULT 'in_review' CHECK(status IN (
    'draft', 'in_review', 'approved', 'rejected', 'archived'
  )),
  rejection_reason TEXT,
  prompt_log_id TEXT REFERENCES prompt_logs(id) ON DELETE SET NULL,
  approved_at TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO perspectives_new (id, bullet_id, content, bullet_content_snapshot,
  target_archetype, domain, framing, status, rejection_reason, prompt_log_id,
  approved_at, approved_by, created_at)
SELECT id, bullet_id, content, bullet_content_snapshot,
  target_archetype, domain, framing, status, rejection_reason, prompt_log_id,
  approved_at, approved_by, created_at
FROM perspectives;

DROP TABLE perspectives;
ALTER TABLE perspectives_new RENAME TO perspectives;

CREATE INDEX idx_perspectives_bullet ON perspectives(bullet_id);
CREATE INDEX idx_perspectives_status ON perspectives(status);
CREATE INDEX idx_perspectives_archetype ON perspectives(target_archetype);
CREATE INDEX idx_perspectives_domain ON perspectives(domain);

-- == resumes ==================================================================

CREATE TABLE resumes_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL,
  target_role TEXT NOT NULL,
  target_employer TEXT NOT NULL,
  archetype TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
    'draft', 'in_review', 'approved', 'rejected', 'archived'
  )),
  header TEXT,
  summary_id TEXT REFERENCES summaries(id) ON DELETE SET NULL,
  markdown_override TEXT,
  markdown_override_updated_at TEXT,
  latex_override TEXT,
  latex_override_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  generated_tagline TEXT,
  tagline_override TEXT,
  summary_override TEXT,
  summary_override_updated_at TEXT,
  show_clearance_in_header INTEGER NOT NULL DEFAULT 1
) STRICT;

INSERT INTO resumes_new (id, name, target_role, target_employer, archetype, status,
  header, summary_id, markdown_override, markdown_override_updated_at,
  latex_override, latex_override_updated_at, created_at, updated_at,
  generated_tagline, tagline_override, summary_override, summary_override_updated_at,
  show_clearance_in_header)
SELECT id, name, target_role, target_employer, archetype, status,
  header, summary_id, markdown_override, markdown_override_updated_at,
  latex_override, latex_override_updated_at, created_at, updated_at,
  generated_tagline, tagline_override, summary_override, summary_override_updated_at,
  show_clearance_in_header
FROM resumes;

DROP TABLE resumes;
ALTER TABLE resumes_new RENAME TO resumes;

-- resumes has no custom indexes (only autoindex on PK)

-- == resume_entries ===========================================================

CREATE TABLE resume_entries_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES resume_sections(id) ON DELETE CASCADE,
  perspective_id TEXT REFERENCES perspectives(id) ON DELETE RESTRICT,
  content TEXT,
  perspective_content_snapshot TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL
) STRICT;

INSERT INTO resume_entries_new (id, resume_id, section_id, perspective_id, content,
  perspective_content_snapshot, position, created_at, updated_at, source_id)
SELECT id, resume_id, section_id, perspective_id, content,
  perspective_content_snapshot, position, created_at, updated_at, source_id
FROM resume_entries;

DROP TABLE resume_entries;
ALTER TABLE resume_entries_new RENAME TO resume_entries;

CREATE INDEX idx_resume_entries_section ON resume_entries(section_id, position);
CREATE INDEX idx_resume_entries_resume ON resume_entries(resume_id);
CREATE INDEX idx_resume_entries_source ON resume_entries(source_id);

-- == skills ===================================================================

CREATE TABLE skills_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'other' REFERENCES skill_categories(slug),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO skills_new (id, name, category, created_at)
SELECT id, name, category, created_at
FROM skills;

DROP TABLE skills;
ALTER TABLE skills_new RENAME TO skills;

CREATE INDEX idx_skills_category ON skills(category);

-- == organizations ============================================================
-- Drops both `notes` and `reputation_notes` (0 non-null values for reputation_notes)

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
  status TEXT CHECK (status IS NULL OR status IN (
    'backlog', 'researching', 'exciting', 'interested', 'acceptable', 'excluded'
  )),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  industry_id TEXT REFERENCES industries(id) ON DELETE SET NULL
) STRICT;

INSERT INTO organizations_new (id, name, org_type, industry, size, worked,
  employment_type, website, linkedin_url, glassdoor_url, glassdoor_rating,
  status, created_at, updated_at, industry_id)
SELECT id, name, org_type, industry, size, worked,
  employment_type, website, linkedin_url, glassdoor_url, glassdoor_rating,
  status, created_at, updated_at, industry_id
FROM organizations;

DROP TABLE organizations;
ALTER TABLE organizations_new RENAME TO organizations;

CREATE INDEX idx_organizations_name ON organizations(name);
CREATE INDEX idx_organizations_industry_id ON organizations(industry_id);

-- == job_descriptions =========================================================

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
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO job_descriptions_new (id, organization_id, title, url, raw_text,
  status, salary_range, salary_min, salary_max, location, created_at, updated_at)
SELECT id, organization_id, title, url, raw_text,
  status, salary_range, salary_min, salary_max, location, created_at, updated_at
FROM job_descriptions;

DROP TABLE job_descriptions;
ALTER TABLE job_descriptions_new RENAME TO job_descriptions;

CREATE INDEX idx_job_descriptions_org ON job_descriptions(organization_id);
CREATE INDEX idx_job_descriptions_status ON job_descriptions(status);

-- Recreate the updated_at trigger lost during table rebuild
CREATE TRIGGER jd_updated_at AFTER UPDATE ON job_descriptions
BEGIN
  UPDATE job_descriptions SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id;
END;

-- ══════════════════════════════════════════════════════════════════════════════
-- Step 5: Cleanup and re-enable FK checks
-- ══════════════════════════════════════════════════════════════════════════════

DROP TABLE _notes_map;

PRAGMA foreign_keys = ON;

-- FK integrity note:
-- All rebuilt tables preserve the same IDs. Child tables referencing them
-- (bullet_skills, bullet_sources, perspective_skills, source_roles,
-- source_projects, source_education, source_presentations, source_clearances,
-- resume_sections, resume_skills, resume_entries, org_tags, org_aliases,
-- job_description_skills, job_description_resumes, note_references, etc.)
-- still point at valid parent IDs. No FK violations occur.

INSERT INTO _migrations (name) VALUES ('048_notes_normalization');
