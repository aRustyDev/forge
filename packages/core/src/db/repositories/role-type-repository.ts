/**
 * RoleTypeRepository — pure data access for the role_types table.
 * Mirrors industry-repository / domain-repository pattern.
 */

import type { Database } from 'bun:sqlite'
import type { RoleType } from '../../types'

interface RoleTypeRow {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface CreateRoleTypeInput {
  name: string
  description?: string
}

function rowToRoleType(row: RoleTypeRow): RoleType {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
  }
}

export function create(db: Database, input: CreateRoleTypeInput): RoleType {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO role_types (id, name, description)
       VALUES (?, ?, ?)
       RETURNING *`,
    )
    .get(id, input.name, input.description ?? null) as RoleTypeRow

  return rowToRoleType(row)
}

export function get(db: Database, id: string): RoleType | null {
  const row = db
    .query('SELECT * FROM role_types WHERE id = ?')
    .get(id) as RoleTypeRow | null

  return row ? rowToRoleType(row) : null
}

export function getByName(db: Database, name: string): RoleType | null {
  const row = db
    .query('SELECT * FROM role_types WHERE lower(name) = lower(?)')
    .get(name) as RoleTypeRow | null

  return row ? rowToRoleType(row) : null
}

export function list(
  db: Database,
  offset = 0,
  limit = 50,
): { data: RoleType[]; total: number } {
  const countRow = db
    .query('SELECT COUNT(*) AS total FROM role_types')
    .get() as { total: number }

  const rows = db
    .query(
      `SELECT * FROM role_types
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as RoleTypeRow[]

  return {
    data: rows.map(rowToRoleType),
    total: countRow.total,
  }
}

export function update(
  db: Database,
  id: string,
  input: Partial<CreateRoleTypeInput>,
): RoleType | null {
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
    .query(`UPDATE role_types SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as RoleTypeRow | null

  return row ? rowToRoleType(row) : null
}

export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM role_types WHERE id = ?', [id])
  return result.changes > 0
}
