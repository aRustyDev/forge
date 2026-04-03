/**
 * SummaryRepository -- CRUD operations for the summaries table.
 *
 * All functions take a `Database` instance as the first parameter,
 * keeping the repository stateless and testable.
 */

import type { Database } from 'bun:sqlite'
import type { Summary, Resume } from '../../types'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSummaryInput {
  title: string
  role?: string
  tagline?: string
  description?: string
  is_template?: number
  notes?: string
}

export interface UpdateSummaryInput {
  title?: string
  role?: string | null
  tagline?: string | null
  description?: string | null
  is_template?: number
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface SummaryFilter {
  is_template?: number
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/** Insert a new summary and return the created row (with linked_resume_count = 0). */
export function create(db: Database, input: CreateSummaryInput): Summary {
  const id = crypto.randomUUID()
  db
    .query(
      `INSERT INTO summaries (id, title, role, tagline, description, is_template, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title,
      input.role ?? null,
      input.tagline ?? null,
      input.description ?? null,
      input.is_template ?? 0,
      input.notes ?? null,
    )

  return get(db, id)!
}

/** Retrieve a summary by ID, or null if not found. Includes computed linked_resume_count. */
export function get(db: Database, id: string): Summary | null {
  return (
    db.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM resumes WHERE summary_id = s.id) AS linked_resume_count
       FROM summaries s
       WHERE s.id = ?`
    ).get(id) as Summary | null
  ) ?? null
}

/**
 * List summaries with optional is_template filter.
 * Returns data array and total count (before pagination).
 */
export function list(
  db: Database,
  filter?: SummaryFilter,
  offset = 0,
  limit = 50,
): { data: Summary[]; total: number } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter?.is_template !== undefined) {
    conditions.push('s.is_template = ?')
    params.push(filter.is_template)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = db
    .query(`SELECT COUNT(*) AS total FROM summaries s ${where}`)
    .get(...params) as { total: number }

  const dataParams = [...params, limit, offset]
  const rows = db
    .query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM resumes WHERE summary_id = s.id) AS linked_resume_count
       FROM summaries s
       ${where}
       ORDER BY s.is_template DESC, s.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...dataParams) as Summary[]

  return { data: rows, total: countRow.total }
}

/**
 * Partially update a summary.
 * Only the fields present in `input` are changed. `updated_at` is
 * always refreshed. Returns null if the summary does not exist.
 */
export function update(
  db: Database,
  id: string,
  input: UpdateSummaryInput,
): Summary | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title) }
  if (input.role !== undefined) { sets.push('role = ?'); params.push(input.role) }
  if (input.tagline !== undefined) { sets.push('tagline = ?'); params.push(input.tagline) }
  if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description) }
  if (input.is_template !== undefined) { sets.push('is_template = ?'); params.push(input.is_template) }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes) }

  // Always update updated_at
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")

  params.push(id)

  db
    .query(`UPDATE summaries SET ${sets.join(', ')} WHERE id = ?`)
    .run(...params)

  return get(db, id)
}

/** Toggle the is_template flag atomically. Returns the updated summary or null if not found. */
export function toggleTemplate(db: Database, id: string): Summary | null {
  const row = db
    .query(
      `UPDATE summaries
       SET is_template = ((is_template + 1) % 2),
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?
       RETURNING *`
    )
    .get(id) as (Omit<Summary, 'linked_resume_count'>) | null

  if (!row) return null

  // Re-fetch via get to include linked_resume_count
  return get(db, id)
}

/** Delete a summary by ID. Returns true if a row was deleted. */
export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM summaries WHERE id = ?', [id])
  return result.changes > 0
}

/** List resumes linked to a summary via summary_id, with pagination. */
export function getLinkedResumes(
  db: Database,
  summaryId: string,
  offset = 0,
  limit = 50,
): { data: Resume[]; total: number } {
  const countRow = db
    .query('SELECT COUNT(*) AS total FROM resumes WHERE summary_id = ?')
    .get(summaryId) as { total: number }

  const rows = db
    .query(
      `SELECT * FROM resumes
       WHERE summary_id = ?
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(summaryId, limit, offset) as Resume[]

  return { data: rows, total: countRow.total }
}

/**
 * Clone a summary. Creates a copy with:
 * - title = 'Copy of ' + original.title
 * - is_template = 0 (always, even if cloning a template)
 * - All other fields copied verbatim
 * - New UUID, created_at, updated_at
 *
 * Returns null if the source summary does not exist.
 */
export function clone(db: Database, id: string): Summary | null {
  const source = get(db, id)
  if (!source) return null

  const newId = crypto.randomUUID()
  db
    .query(
      `INSERT INTO summaries (id, title, role, tagline, description, is_template, notes)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      newId,
      `Copy of ${source.title}`,
      source.role,
      source.tagline,
      source.description,
      source.notes,
    )

  return get(db, newId)!
}
