/**
 * IndustryRepository — pure data access for the industries table.
 * Mirrors domain-repository pattern.
 */

import type { Database } from 'bun:sqlite'
import type { Industry } from '../../types'

interface IndustryRow {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface CreateIndustryInput {
  name: string
  description?: string
}

function rowToIndustry(row: IndustryRow): Industry {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
  }
}

export function create(db: Database, input: CreateIndustryInput): Industry {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO industries (id, name, description)
       VALUES (?, ?, ?)
       RETURNING *`,
    )
    .get(id, input.name, input.description ?? null) as IndustryRow

  return rowToIndustry(row)
}

export function get(db: Database, id: string): Industry | null {
  const row = db
    .query('SELECT * FROM industries WHERE id = ?')
    .get(id) as IndustryRow | null

  return row ? rowToIndustry(row) : null
}

export function getByName(db: Database, name: string): Industry | null {
  const row = db
    .query('SELECT * FROM industries WHERE lower(name) = lower(?)')
    .get(name) as IndustryRow | null

  return row ? rowToIndustry(row) : null
}

export function list(
  db: Database,
  offset = 0,
  limit = 50,
): { data: Industry[]; total: number } {
  const countRow = db
    .query('SELECT COUNT(*) AS total FROM industries')
    .get() as { total: number }

  const rows = db
    .query(
      `SELECT * FROM industries
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as IndustryRow[]

  return {
    data: rows.map(rowToIndustry),
    total: countRow.total,
  }
}

export function update(
  db: Database,
  id: string,
  input: Partial<CreateIndustryInput>,
): Industry | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) {
    sets.push('name = ?')
    params.push(input.name)
  }
  if (input.description !== undefined) {
    sets.push('description = ?')
    params.push(input.description)
  }

  if (sets.length === 0) return existing

  params.push(id)
  const row = db
    .query(`UPDATE industries SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as IndustryRow | null

  return row ? rowToIndustry(row) : null
}

/** Count organizations that reference this industry (for delete-protection). */
export function countReferences(db: Database, id: string): number {
  const row = db
    .query('SELECT COUNT(*) AS c FROM organizations WHERE industry_id = ?')
    .get(id) as { c: number }
  return row.c
}

export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM industries WHERE id = ?', [id])
  return result.changes > 0
}
