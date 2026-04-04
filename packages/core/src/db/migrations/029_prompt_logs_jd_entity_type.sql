-- Expand prompt_logs entity_type CHECK to include 'job_description'
-- Migration: 029_prompt_logs_jd_entity_type
-- Required for JD skill extraction AI logging (Phase 62).
-- Uses table rebuild pattern (SQLite cannot ALTER CHECK constraints).

PRAGMA foreign_keys = OFF;

CREATE TABLE prompt_logs_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  entity_type TEXT NOT NULL CHECK(entity_type IN ('bullet', 'perspective', 'job_description')),
  entity_id TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  prompt_input TEXT NOT NULL,
  raw_response TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO prompt_logs_new SELECT * FROM prompt_logs;
DROP TABLE prompt_logs;
ALTER TABLE prompt_logs_new RENAME TO prompt_logs;

CREATE INDEX idx_prompt_logs_entity ON prompt_logs(entity_type, entity_id);

PRAGMA foreign_keys = ON;

INSERT INTO _migrations (name) VALUES ('029_prompt_logs_jd_entity_type');
