/**
 * DomainRepository — pure data access for the domains table.
 */

import type { Database } from 'bun:sqlite'
import type { Domain } from '../../types'

interface DomainRow {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface DomainWithUsage extends Domain {
  perspective_count: number
  archetype_count: number
}

export interface CreateDomainInput {
  name: string
  description?: string
}

function rowToDomain(row: DomainRow): Domain {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
  }
}

export function create(db: Database, input: CreateDomainInput): Domain {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO domains (id, name, description)
       VALUES (?, ?, ?)
       RETURNING *`,
    )
    .get(id, input.name, input.description ?? null) as DomainRow

  return rowToDomain(row)
}

export function get(db: Database, id: string): Domain | null {
  const row = db
    .query('SELECT * FROM domains WHERE id = ?')
    .get(id) as DomainRow | null

  return row ? rowToDomain(row) : null
}

export function getByName(db: Database, name: string): Domain | null {
  const row = db
    .query('SELECT * FROM domains WHERE name = ?')
    .get(name) as DomainRow | null

  return row ? rowToDomain(row) : null
}

export function list(
  db: Database,
  offset = 0,
  limit = 50,
): { data: DomainWithUsage[]; total: number } {
  const countRow = db
    .query('SELECT COUNT(*) AS total FROM domains')
    .get() as { total: number }

  const rows = db
    .query(
      `SELECT d.*,
              (SELECT COUNT(*) FROM perspectives p WHERE p.domain = d.name) AS perspective_count,
              (SELECT COUNT(*) FROM archetype_domains ad WHERE ad.domain_id = d.id) AS archetype_count
       FROM domains d
       ORDER BY d.name ASC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Array<DomainRow & { perspective_count: number; archetype_count: number }>

  return {
    data: rows.map((row) => ({
      ...rowToDomain(row),
      perspective_count: row.perspective_count,
      archetype_count: row.archetype_count,
    })),
    total: countRow.total,
  }
}

export function update(
  db: Database,
  id: string,
  input: Partial<CreateDomainInput>,
): Domain | null {
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
    .query(`UPDATE domains SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as DomainRow | null

  return row ? rowToDomain(row) : null
}

/**
 * Count references to this domain from perspectives and archetype_domains.
 * Used to prevent deletion of referenced domains.
 */
export function countReferences(
  db: Database,
  id: string,
): { perspective_count: number; archetype_count: number } {
  const domain = get(db, id)
  if (!domain) return { perspective_count: 0, archetype_count: 0 }

  const perspCount = db
    .query('SELECT COUNT(*) AS c FROM perspectives WHERE domain = ?')
    .get(domain.name) as { c: number }

  const archCount = db
    .query('SELECT COUNT(*) AS c FROM archetype_domains WHERE domain_id = ?')
    .get(id) as { c: number }

  return {
    perspective_count: perspCount.c,
    archetype_count: archCount.c,
  }
}

export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM domains WHERE id = ?', [id])
  return result.changes > 0
}
