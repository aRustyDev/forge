-- 045_pending_derivations.sql
-- Split-handshake derivation: unified locking for prepare/commit protocol.
-- Replaces source-level 'deriving' status and in-memory bullet lock Set.

CREATE TABLE pending_derivations (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  entity_type       TEXT NOT NULL CHECK (entity_type IN ('source', 'bullet')),
  entity_id         TEXT NOT NULL,
  client_id         TEXT NOT NULL,
  prompt            TEXT NOT NULL,
  snapshot          TEXT NOT NULL,
  derivation_params TEXT,
  locked_at         TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at        TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_pending_derivations_entity
  ON pending_derivations(entity_type, entity_id);
