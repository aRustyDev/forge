/**
 * NoteRepository — CRUD operations for the user_notes and note_references tables.
 *
 * All functions take a `Database` instance as the first parameter,
 * keeping the repository stateless and testable.
 */

import type { Database } from 'bun:sqlite'
import type { UserNote, NoteReference } from '../../types'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateNoteInput {
  title?: string
  content: string
}

// ---------------------------------------------------------------------------
// Rich response types
// ---------------------------------------------------------------------------

export interface UserNoteWithReferences extends UserNote {
  references: NoteReference[]
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/** Insert a new user note and return the created row. */
export function create(db: Database, input: CreateNoteInput): UserNote {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO user_notes (id, title, content)
       VALUES (?, ?, ?)
       RETURNING *`,
    )
    .get(id, input.title ?? null, input.content) as UserNote

  return row
}

/** Retrieve a user note by ID, or null if not found. */
export function get(db: Database, id: string): UserNote | null {
  return (
    (db.query('SELECT * FROM user_notes WHERE id = ?').get(id) as UserNote | null) ??
    null
  )
}

/** Retrieve a user note with all its references, or null if not found. */
export function getWithReferences(db: Database, id: string): UserNoteWithReferences | null {
  const note = get(db, id)
  if (!note) return null

  const refs = db
    .query('SELECT * FROM note_references WHERE note_id = ?')
    .all(id) as NoteReference[]

  return { ...note, references: refs }
}

/**
 * List user notes with optional full-text search on title and content.
 * Returns data array and total count (before pagination).
 */
export function list(
  db: Database,
  search?: string,
  offset = 0,
  limit = 50,
): { data: UserNote[]; total: number } {
  if (search) {
    const pattern = `%${search}%`
    const countRow = db
      .query(
        `SELECT COUNT(*) AS total FROM user_notes
         WHERE content LIKE ? OR title LIKE ?`,
      )
      .get(pattern, pattern) as { total: number }

    const rows = db
      .query(
        `SELECT * FROM user_notes
         WHERE content LIKE ? OR title LIKE ?
         ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      )
      .all(pattern, pattern, limit, offset) as UserNote[]

    return { data: rows, total: countRow.total }
  }

  const countRow = db
    .query('SELECT COUNT(*) AS total FROM user_notes')
    .get() as { total: number }

  const rows = db
    .query('SELECT * FROM user_notes ORDER BY updated_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as UserNote[]

  return { data: rows, total: countRow.total }
}

/**
 * Partially update a user note.
 * Only the fields present in `input` are changed. `updated_at` is
 * always refreshed. Returns null if the note does not exist.
 */
export function update(
  db: Database,
  id: string,
  input: Partial<CreateNoteInput>,
): UserNote | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title) }
  if (input.content !== undefined) { sets.push('content = ?'); params.push(input.content) }

  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")

  params.push(id)

  const row = db
    .query(`UPDATE user_notes SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as UserNote | null

  return row ?? null
}

/** Delete a user note by ID. Returns true if a row was deleted. */
export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM user_notes WHERE id = ?', [id])
  return result.changes > 0
}

/** Add a reference linking a note to an entity. */
export function addReference(
  db: Database,
  noteId: string,
  entityType: string,
  entityId: string,
): void {
  db.run(
    `INSERT INTO note_references (note_id, entity_type, entity_id)
     VALUES (?, ?, ?)`,
    [noteId, entityType, entityId],
  )
}

/**
 * Remove a reference linking a note to an entity.
 * Returns true if a row was deleted, false if not found.
 */
export function removeReference(
  db: Database,
  noteId: string,
  entityType: string,
  entityId: string,
): boolean {
  const result = db.run(
    'DELETE FROM note_references WHERE note_id = ? AND entity_type = ? AND entity_id = ?',
    [noteId, entityType, entityId],
  )
  return result.changes > 0
}

/**
 * Find all notes linked to a given entity.
 * Returns notes ordered by updated_at descending.
 */
export function getByEntity(
  db: Database,
  entityType: string,
  entityId: string,
): UserNote[] {
  return db
    .query(
      `SELECT un.* FROM user_notes un
       JOIN note_references nr ON un.id = nr.note_id
       WHERE nr.entity_type = ? AND nr.entity_id = ?
       ORDER BY un.updated_at DESC`,
    )
    .all(entityType, entityId) as UserNote[]
}
