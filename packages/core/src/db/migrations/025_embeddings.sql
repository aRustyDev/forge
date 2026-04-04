-- Embeddings Table
-- Migration: 025_embeddings
-- Stores vector embeddings for semantic similarity search.
-- entity_type discriminates between bullets, perspectives, JD requirements, and sources.
-- content_hash enables staleness detection (SHA256 of embedded text).
-- vector stores Float32Array as BLOB (384 * 4 = 1536 bytes per row).

CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('bullet', 'perspective', 'jd_requirement', 'source')),
  entity_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  vector BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, entity_id)
) STRICT;

CREATE INDEX idx_embeddings_type ON embeddings(entity_type);
CREATE INDEX idx_embeddings_entity ON embeddings(entity_type, entity_id);

-- Migration recording handled by the runner; no manual INSERT needed.
