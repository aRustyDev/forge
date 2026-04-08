/**
 * PendingDerivationRepository — CRUD for the pending_derivations lock table.
 *
 * Rows are ephemeral: created by prepare, deleted by commit or stale-lock recovery.
 */

import type { Database } from 'bun:sqlite'

export interface PendingDerivation {
  id: string
  entity_type: 'source' | 'bullet'
  entity_id: string
  client_id: string
  prompt: string
  snapshot: string
  derivation_params: string | null
  locked_at: string
  expires_at: string
  created_at: string
}

export interface CreatePendingDerivationInput {
  entity_type: 'source' | 'bullet'
  entity_id: string
  client_id: string
  prompt: string
  snapshot: string
  derivation_params: string | null
  expires_at: string
}

export function create(db: Database, input: CreatePendingDerivationInput): PendingDerivation {
  const row = db
    .query(
      `INSERT INTO pending_derivations (entity_type, entity_id, client_id, prompt, snapshot, derivation_params, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      input.entity_type,
      input.entity_id,
      input.client_id,
      input.prompt,
      input.snapshot,
      input.derivation_params,
      input.expires_at,
    ) as PendingDerivation

  return row
}

export function getById(db: Database, id: string): PendingDerivation | null {
  return db
    .query('SELECT * FROM pending_derivations WHERE id = ?')
    .get(id) as PendingDerivation | null
}

/** Find an unexpired lock for the given entity. Returns null if no lock or if expired. */
export function findUnexpiredByEntity(
  db: Database,
  entityType: 'source' | 'bullet',
  entityId: string,
): PendingDerivation | null {
  return db
    .query(
      `SELECT * FROM pending_derivations
       WHERE entity_type = ? AND entity_id = ? AND datetime(expires_at) > datetime('now')`,
    )
    .get(entityType, entityId) as PendingDerivation | null
}

export function deleteById(db: Database, id: string): void {
  db.run('DELETE FROM pending_derivations WHERE id = ?', [id])
}

/** Delete all expired rows. Returns count of deleted rows. */
export function deleteExpired(db: Database): number {
  const result = db.run(
    `DELETE FROM pending_derivations WHERE datetime(expires_at) <= datetime('now')`,
  )
  return result.changes
}
