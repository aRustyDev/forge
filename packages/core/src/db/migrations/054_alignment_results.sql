-- Migration 054: alignment_results
--
-- Persists computed AlignmentResult rows for history. Mirrors the OSS browser
-- (wa-sqlite) and SaaS server (rusqlite + future D1) by virtue of using only
-- STRICT-compatible types.
--
-- result_json stores the full serialized AlignmentResult; the surrounding
-- columns are summary projections for fast list/scan queries that don't need
-- to decode the JSON.

CREATE TABLE alignment_results (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL,
  jd_id TEXT NOT NULL,
  computed_at INTEGER NOT NULL,
  overall_score REAL NOT NULL,
  gap_count INTEGER NOT NULL,
  result_json TEXT NOT NULL
) STRICT;

CREATE INDEX idx_alignment_results_resume_jd
  ON alignment_results(resume_id, jd_id, computed_at DESC);
