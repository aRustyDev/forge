/**
 * ResumeEntryRepository — CRUD operations for the resume_entries table.
 *
 * All functions take a `Database` instance as the first parameter,
 * keeping the repository stateless and testable.
 */

import type { Database } from 'bun:sqlite'
import type { ResumeEntry } from '../../types'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateResumeEntryInput {
  resume_id: string
  section_id: string
  perspective_id?: string
  content?: string | null
  position?: number
  notes?: string | null
}

export interface UpdateResumeEntryInput {
  content?: string | null
  section_id?: string
  position?: number
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/**
 * Insert a new resume entry and return the created row.
 *
 * When `content` is provided (non-null) and `perspective_id` is set,
 * the current perspective content is captured in
 * `perspective_content_snapshot` (clone mode).
 * When `content` is null or omitted, the entry acts as a reference to the
 * perspective's live content.
 * When `perspective_id` is omitted (freeform entries), `content` is required.
 */
export function create(db: Database, input: CreateResumeEntryInput): ResumeEntry {
  const id = crypto.randomUUID()

  // Capture perspective content snapshot if content is being set (clone mode)
  // and we have a perspective to snapshot from
  let snapshot: string | null = null
  if (input.content != null && input.perspective_id) {
    const perspective = db
      .query('SELECT content FROM perspectives WHERE id = ?')
      .get(input.perspective_id) as { content: string } | null
    snapshot = perspective?.content ?? null
  }

  const row = db
    .query(
      `INSERT INTO resume_entries (id, resume_id, section_id, perspective_id, content, perspective_content_snapshot, position, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      id,
      input.resume_id,
      input.section_id,
      input.perspective_id ?? null,
      input.content ?? null,
      snapshot,
      input.position ?? 0,
      input.notes ?? null,
    ) as ResumeEntry

  return row
}

/** Retrieve a resume entry by ID, or null if not found. */
export function get(db: Database, id: string): ResumeEntry | null {
  return (
    (db.query('SELECT * FROM resume_entries WHERE id = ?').get(id) as ResumeEntry | null) ??
    null
  )
}

/**
 * Partially update a resume entry.
 *
 * Content snapshot behavior:
 * - When content changes from null to non-null, capture perspective_content_snapshot.
 * - When content is set to null (reset to reference mode), clear perspective_content_snapshot.
 *
 * Returns null if the entry does not exist.
 */
export function update(
  db: Database,
  id: string,
  input: UpdateResumeEntryInput,
): ResumeEntry | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if ('content' in input) {
    sets.push('content = ?')
    params.push(input.content ?? null)

    if (input.content != null && existing.perspective_id) {
      // Clone mode: capture perspective content snapshot
      const perspective = db
        .query('SELECT content FROM perspectives WHERE id = ?')
        .get(existing.perspective_id) as { content: string } | null
      sets.push('perspective_content_snapshot = ?')
      params.push(perspective?.content ?? null)
    } else {
      // Reference mode or freeform: clear snapshot
      sets.push('perspective_content_snapshot = ?')
      params.push(null)
    }
  }

  if (input.section_id !== undefined) { sets.push('section_id = ?'); params.push(input.section_id) }
  if (input.position !== undefined) { sets.push('position = ?'); params.push(input.position) }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes) }

  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")

  params.push(id)

  const row = db
    .query(`UPDATE resume_entries SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as ResumeEntry | null

  return row ?? null
}

/** Delete a resume entry by ID. Returns true if a row was deleted. */
export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM resume_entries WHERE id = ?', [id])
  return result.changes > 0
}

/**
 * List all resume entries for a given resume, ordered by section position then entry position.
 */
export function listByResume(db: Database, resumeId: string): ResumeEntry[] {
  return db
    .query(
      `SELECT re.*
       FROM resume_entries re
       JOIN resume_sections rs ON rs.id = re.section_id
       WHERE re.resume_id = ?
       ORDER BY rs.position ASC, re.position ASC`,
    )
    .all(resumeId) as ResumeEntry[]
}

/**
 * Resolve the effective content for an entry.
 *
 * If entry.content is non-null, return it (clone mode or freeform).
 * If entry.content is null, return the perspective's content (reference mode).
 * Returns null if the entry does not exist.
 */
export function resolveContent(db: Database, entryId: string): string | null {
  const row = db
    .query(
      `SELECT COALESCE(re.content, p.content) AS resolved_content
       FROM resume_entries re
       LEFT JOIN perspectives p ON re.perspective_id = p.id
       WHERE re.id = ?`,
    )
    .get(entryId) as { resolved_content: string } | null

  return row?.resolved_content ?? null
}
