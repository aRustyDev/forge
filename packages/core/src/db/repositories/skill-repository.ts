/**
 * SkillRepository — CRUD operations for the skills table.
 *
 * All functions take a `Database` instance as the first parameter,
 * keeping the repository stateless and testable.
 */

import type { Database } from 'bun:sqlite'
import type { Skill } from '../../types'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSkillInput {
  name: string
  category?: string | null
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface SkillFilter {
  category?: string
}

// ---------------------------------------------------------------------------
// Internal row type (includes created_at from schema)
// ---------------------------------------------------------------------------

interface SkillRow {
  id: string
  name: string
  category: string | null
  created_at: string
}

/** Map a database row to a Skill entity. */
function toSkill(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
  }
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/** Insert a new skill and return the created row. */
export function create(db: Database, input: CreateSkillInput): Skill {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO skills (id, name, category)
       VALUES (?, ?, ?)
       RETURNING *`,
    )
    .get(id, input.name, input.category ?? null) as SkillRow

  return toSkill(row)
}

/** Retrieve a skill by ID, or null if not found. */
export function get(db: Database, id: string): Skill | null {
  const row = db.query('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow | null
  return row ? toSkill(row) : null
}

/**
 * List skills, optionally filtered by category.
 * Results are ordered by name ascending.
 */
export function list(db: Database, filter?: SkillFilter): Skill[] {
  if (filter?.category) {
    return (
      db
        .query('SELECT * FROM skills WHERE category = ? ORDER BY name ASC')
        .all(filter.category) as SkillRow[]
    ).map(toSkill)
  }

  return (
    db.query('SELECT * FROM skills ORDER BY name ASC').all() as SkillRow[]
  ).map(toSkill)
}

/**
 * Get an existing skill by name, or create it if it doesn't exist.
 *
 * This is idempotent: calling with the same name multiple times returns
 * the same skill (same ID). Uses INSERT OR IGNORE to handle the UNIQUE
 * constraint on the name column, then SELECTs to return the row.
 */
export function getOrCreate(
  db: Database,
  input: CreateSkillInput,
): Skill {
  const id = crypto.randomUUID()

  // INSERT OR IGNORE will silently skip if name already exists (UNIQUE).
  db.run(
    `INSERT OR IGNORE INTO skills (id, name, category) VALUES (?, ?, ?)`,
    [id, input.name, input.category ?? null],
  )

  // Always SELECT by name to get the canonical row (whether just-inserted or pre-existing).
  const row = db
    .query('SELECT * FROM skills WHERE name = ?')
    .get(input.name) as SkillRow

  return toSkill(row)
}

/** Update a skill's name, category, or both. Returns the updated skill or null if not found. */
export function update(db: Database, id: string, input: { name?: string; category?: string | null }): Skill | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name) }
  if (input.category !== undefined) { sets.push('category = ?'); params.push(input.category) }

  if (sets.length === 0) return existing

  params.push(id)
  const row = db
    .query(`UPDATE skills SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as SkillRow | null

  return row ? toSkill(row) : null
}

/** Delete a skill by ID. */
export function del(db: Database, id: string): void {
  db.run('DELETE FROM skills WHERE id = ?', [id])
}
