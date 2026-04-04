-- Unified Kanban Statuses
-- Migration: 020_unified_kanban_statuses
-- Expands status CHECK constraints for bullets, sources, resumes, perspectives.
-- Renames pending_review -> in_review in bullets and perspectives.
-- Replaces final -> approved in resumes.
-- Adds in_review, rejected, archived to sources.
-- Adds archived to bullets and perspectives.

PRAGMA foreign_keys = OFF;

-- NOTE: The migration runner wraps each migration in BEGIN/COMMIT.
-- PRAGMA foreign_keys = OFF is silently ignored inside an active transaction.
-- The PRAGMA calls are defensive only -- the actual FK protection comes from
-- the runner's transaction ensuring all statements execute atomically.
-- This is consistent with how migrations 002, 007, and 012 handle table rebuilds.

-- == Bullets =================================================================

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
  notes TEXT,
  domain TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO bullets_new (id, content, source_content_snapshot, metrics, status,
  rejection_reason, prompt_log_id, approved_at, approved_by, notes, domain, created_at)
SELECT id, content, source_content_snapshot, metrics,
  CASE status
    WHEN 'pending_review' THEN 'in_review'
    ELSE status
  END,
  rejection_reason, prompt_log_id, approved_at, approved_by, notes, domain, created_at
FROM bullets;

DROP TABLE bullets;
ALTER TABLE bullets_new RENAME TO bullets;

DROP INDEX IF EXISTS idx_bullets_status;
CREATE INDEX idx_bullets_status ON bullets(status);

-- == Perspectives ============================================================

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
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO perspectives_new (id, bullet_id, content, bullet_content_snapshot,
  target_archetype, domain, framing, status, rejection_reason, prompt_log_id,
  approved_at, approved_by, notes, created_at)
SELECT id, bullet_id, content, bullet_content_snapshot,
  target_archetype, domain, framing,
  CASE status
    WHEN 'pending_review' THEN 'in_review'
    ELSE status
  END,
  rejection_reason, prompt_log_id, approved_at, approved_by, notes, created_at
FROM perspectives;

DROP TABLE perspectives;
ALTER TABLE perspectives_new RENAME TO perspectives;

DROP INDEX IF EXISTS idx_perspectives_bullet;
CREATE INDEX idx_perspectives_bullet ON perspectives(bullet_id);
DROP INDEX IF EXISTS idx_perspectives_status;
CREATE INDEX idx_perspectives_status ON perspectives(status);
DROP INDEX IF EXISTS idx_perspectives_archetype;
CREATE INDEX idx_perspectives_archetype ON perspectives(target_archetype);
DROP INDEX IF EXISTS idx_perspectives_domain;
CREATE INDEX idx_perspectives_domain ON perspectives(domain);

-- == Sources =================================================================

CREATE TABLE sources_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'general'
    CHECK (source_type IN ('role', 'project', 'education', 'clearance', 'general')),
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

INSERT INTO sources_new (id, title, description, source_type, start_date, end_date,
  status, updated_by, last_derived_at, notes, created_at, updated_at)
SELECT id, title, description, source_type, start_date, end_date,
  status, updated_by, last_derived_at, notes, created_at, updated_at
FROM sources;

DROP TABLE sources;
ALTER TABLE sources_new RENAME TO sources;

DROP INDEX IF EXISTS idx_sources_status;
CREATE INDEX idx_sources_status ON sources(status);
DROP INDEX IF EXISTS idx_sources_source_type;
CREATE INDEX idx_sources_source_type ON sources(source_type);

-- == Resumes =================================================================

CREATE TABLE resumes_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL,
  target_role TEXT NOT NULL,
  target_employer TEXT NOT NULL,
  archetype TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
    'draft', 'in_review', 'approved', 'rejected', 'archived'
  )),
  notes TEXT,
  header TEXT,
  summary_id TEXT REFERENCES summaries(id) ON DELETE SET NULL,
  markdown_override TEXT,
  markdown_override_updated_at TEXT,
  latex_override TEXT,
  latex_override_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO resumes_new (id, name, target_role, target_employer, archetype, status,
  notes, header, summary_id, markdown_override, markdown_override_updated_at,
  latex_override, latex_override_updated_at, created_at, updated_at)
SELECT id, name, target_role, target_employer, archetype,
  CASE status
    WHEN 'final' THEN 'approved'
    ELSE status
  END,
  notes, header, summary_id, markdown_override, markdown_override_updated_at,
  latex_override, latex_override_updated_at, created_at, updated_at
FROM resumes;

DROP TABLE resumes;
ALTER TABLE resumes_new RENAME TO resumes;

-- == Rebuild junction table FKs ==============================================
-- bullet_sources: references bullets(id). Same UUIDs preserved; no action needed.
-- bullet_technologies: references bullets(id) ON DELETE CASCADE. Same IDs preserved.
-- bullet_skills: references bullets(id) ON DELETE CASCADE. Same IDs preserved.
-- perspective_skills: references perspectives(id) ON DELETE CASCADE. Same IDs preserved.
-- resume_perspectives: references resumes(id) ON DELETE CASCADE,
--   perspectives(id) ON DELETE RESTRICT. Same IDs preserved.
-- resume_sections: references resumes(id) ON DELETE CASCADE. Same IDs preserved.
-- source_roles, source_projects, source_education, source_clearances:
--   reference sources(id) ON DELETE CASCADE. Same IDs preserved.
-- source_skills: references sources(id) ON DELETE CASCADE. Same IDs preserved.

PRAGMA foreign_keys = ON;

INSERT INTO _migrations (name) VALUES ('020_unified_kanban_statuses');
