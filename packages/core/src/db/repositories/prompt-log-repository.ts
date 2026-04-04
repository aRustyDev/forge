/**
 * PromptLogRepository — Append-only log for AI prompt/response pairs.
 *
 * This repository intentionally has NO update and NO delete operations.
 * Prompt logs are immutable audit records.
 *
 * All functions take a `Database` instance as the first parameter,
 * keeping the repository stateless and testable.
 */

import type { Database } from 'bun:sqlite'
import type { PromptLog, PromptLogEntityType } from '../../types'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreatePromptLogInput {
  entity_type: PromptLogEntityType
  entity_id: string
  prompt_template: string
  prompt_input: string
  raw_response: string
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/** Insert a new prompt log entry and return the created row. */
export function create(db: Database, input: CreatePromptLogInput): PromptLog {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO prompt_logs (id, entity_type, entity_id, prompt_template, prompt_input, raw_response)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      id,
      input.entity_type,
      input.entity_id,
      input.prompt_template,
      input.prompt_input,
      input.raw_response,
    ) as PromptLog

  return row
}

/**
 * Retrieve all prompt log entries for a given entity, ordered
 * chronologically (oldest first).
 */
export function getByEntity(
  db: Database,
  entityType: PromptLogEntityType,
  entityId: string,
): PromptLog[] {
  return db
    .query(
      `SELECT * FROM prompt_logs
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY created_at ASC`,
    )
    .all(entityType, entityId) as PromptLog[]
}
