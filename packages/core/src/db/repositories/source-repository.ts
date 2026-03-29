/**
 * SourceRepository — pure data access for the `sources` table.
 *
 * All functions take a `db: Database` as the first parameter (dependency
 * injection). No business logic lives here; services handle status
 * transition validation, derivation eligibility, etc.
 */

import type { Database } from 'bun:sqlite'
import type { Source, CreateSource, UpdateSource, SourceStatus } from '../../types'

/** Filter options for listing sources. */
export interface SourceFilter {
  employer_id?: string
  project_id?: string
  status?: SourceStatus
}

/** Paginated list result. */
export interface SourceListResult {
  data: Source[]
  total: number
}

/**
 * Insert a new source record.
 *
 * Generates a UUID via `crypto.randomUUID()`, sets status to `'draft'`
 * and updated_by to `'human'`.
 */
export function create(db: Database, input: CreateSource): Source {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO sources (id, title, description, employer_id, project_id, start_date, end_date, status, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'human', ?, ?)`,
    [
      id,
      input.title,
      input.description,
      input.employer_id ?? null,
      input.project_id ?? null,
      input.start_date ?? null,
      input.end_date ?? null,
      now,
      now,
    ],
  )

  return get(db, id)!
}

/**
 * Retrieve a single source by ID.
 *
 * Returns `null` when no row matches.
 */
export function get(db: Database, id: string): Source | null {
  const row = db
    .query('SELECT * FROM sources WHERE id = ?')
    .get(id) as Source | null

  return row ?? null
}

/**
 * List sources with optional filters and pagination.
 *
 * Executes two queries: a COUNT for the total matching rows and a
 * SELECT with LIMIT/OFFSET for the page. Results are sorted by
 * `created_at DESC`.
 */
export function list(
  db: Database,
  filter: SourceFilter,
  offset: number,
  limit: number,
): SourceListResult {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter.employer_id !== undefined) {
    conditions.push('employer_id = ?')
    params.push(filter.employer_id)
  }
  if (filter.project_id !== undefined) {
    conditions.push('project_id = ?')
    params.push(filter.project_id)
  }
  if (filter.status !== undefined) {
    conditions.push('status = ?')
    params.push(filter.status)
  }

  const where = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : ''

  const countRow = db
    .query(`SELECT COUNT(*) AS total FROM sources ${where}`)
    .get(...params) as { total: number }

  const dataParams = [...params, limit, offset]
  const data = db
    .query(`SELECT * FROM sources ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...dataParams) as Source[]

  return { data, total: countRow.total }
}

/**
 * Partially update a source.
 *
 * Only the fields present in `input` are changed. `updated_at` is
 * always refreshed. Returns `null` if the source does not exist.
 */
export function update(db: Database, id: string, input: UpdateSource): Source | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.title !== undefined) {
    sets.push('title = ?')
    params.push(input.title)
  }
  if (input.description !== undefined) {
    sets.push('description = ?')
    params.push(input.description)
  }
  if ('employer_id' in input) {
    sets.push('employer_id = ?')
    params.push(input.employer_id ?? null)
  }
  if ('project_id' in input) {
    sets.push('project_id = ?')
    params.push(input.project_id ?? null)
  }
  if ('start_date' in input) {
    sets.push('start_date = ?')
    params.push(input.start_date ?? null)
  }
  if ('end_date' in input) {
    sets.push('end_date = ?')
    params.push(input.end_date ?? null)
  }

  const now = new Date().toISOString()
  sets.push('updated_at = ?')
  params.push(now)

  params.push(id)

  db.run(
    `UPDATE sources SET ${sets.join(', ')} WHERE id = ?`,
    params,
  )

  return get(db, id)!
}

/**
 * Delete a source by ID.
 *
 * Returns `false` if no row was found. Throws if the source still has
 * bullets (FK RESTRICT).
 */
export function del(db: Database, id: string): boolean {
  const existing = get(db, id)
  if (!existing) return false

  // This will throw if bullets reference this source (ON DELETE RESTRICT).
  db.run('DELETE FROM sources WHERE id = ?', [id])
  return true
}

/**
 * Atomically set a source's status to `'deriving'`.
 *
 * Uses `UPDATE ... WHERE status != 'deriving' RETURNING *` so that a
 * concurrent call returns `null` instead of double-locking.
 */
export function acquireDerivingLock(db: Database, id: string): Source | null {
  const row = db
    .query(
      `UPDATE sources SET status = 'deriving', updated_at = ?
       WHERE id = ? AND status != 'deriving'
       RETURNING *`,
    )
    .get(new Date().toISOString(), id) as Source | null

  return row ?? null
}

/**
 * Release the deriving lock by restoring the previous status.
 *
 * When `derived` is true, `last_derived_at` is set to now.
 */
export function releaseDerivingLock(
  db: Database,
  id: string,
  restoreStatus: SourceStatus,
  derived: boolean,
): void {
  const now = new Date().toISOString()

  if (derived) {
    db.run(
      `UPDATE sources SET status = ?, last_derived_at = ?, updated_at = ? WHERE id = ?`,
      [restoreStatus, now, now, id],
    )
  } else {
    db.run(
      `UPDATE sources SET status = ?, updated_at = ? WHERE id = ?`,
      [restoreStatus, now, id],
    )
  }
}
