/**
 * ArchetypeRepository — pure data access for archetypes and archetype_domains.
 */

import type { Database } from 'bun:sqlite'
import type { Archetype, Domain } from '../../types'

interface ArchetypeRow {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface ArchetypeWithDomains extends Archetype {
  domains: Domain[]
}

export interface ArchetypeWithCounts extends Archetype {
  resume_count: number
  perspective_count: number
  domain_count: number
}

export interface CreateArchetypeInput {
  name: string
  description?: string
}

function rowToArchetype(row: ArchetypeRow): Archetype {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
  }
}

export function create(db: Database, input: CreateArchetypeInput): Archetype {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO archetypes (id, name, description)
       VALUES (?, ?, ?)
       RETURNING *`,
    )
    .get(id, input.name, input.description ?? null) as ArchetypeRow

  return rowToArchetype(row)
}

export function get(db: Database, id: string): Archetype | null {
  const row = db
    .query('SELECT * FROM archetypes WHERE id = ?')
    .get(id) as ArchetypeRow | null

  return row ? rowToArchetype(row) : null
}

export function getByName(db: Database, name: string): Archetype | null {
  const row = db
    .query('SELECT * FROM archetypes WHERE name = ?')
    .get(name) as ArchetypeRow | null

  return row ? rowToArchetype(row) : null
}

export function getWithDomains(db: Database, id: string): ArchetypeWithDomains | null {
  const archetype = get(db, id)
  if (!archetype) return null

  const domains = db
    .query(
      `SELECT d.* FROM domains d
       JOIN archetype_domains ad ON d.id = ad.domain_id
       WHERE ad.archetype_id = ?
       ORDER BY d.name ASC`,
    )
    .all(id) as Array<{ id: string; name: string; description: string | null; created_at: string }>

  return {
    ...archetype,
    domains: domains.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      created_at: d.created_at,
    })),
  }
}

export function list(
  db: Database,
  offset = 0,
  limit = 50,
): { data: ArchetypeWithCounts[]; total: number } {
  const countRow = db
    .query('SELECT COUNT(*) AS total FROM archetypes')
    .get() as { total: number }

  const rows = db
    .query(
      `SELECT a.*,
              (SELECT COUNT(*) FROM resumes r WHERE r.archetype = a.name) AS resume_count,
              (SELECT COUNT(*) FROM perspectives p WHERE p.target_archetype = a.name) AS perspective_count,
              (SELECT COUNT(*) FROM archetype_domains ad WHERE ad.archetype_id = a.id) AS domain_count
       FROM archetypes a
       ORDER BY a.name ASC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Array<ArchetypeRow & { resume_count: number; perspective_count: number; domain_count: number }>

  return {
    data: rows.map((row) => ({
      ...rowToArchetype(row),
      resume_count: row.resume_count,
      perspective_count: row.perspective_count,
      domain_count: row.domain_count,
    })),
    total: countRow.total,
  }
}

export function update(
  db: Database,
  id: string,
  input: Partial<CreateArchetypeInput>,
): Archetype | null {
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
    .query(`UPDATE archetypes SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as ArchetypeRow | null

  return row ? rowToArchetype(row) : null
}

export function countReferences(
  db: Database,
  id: string,
): { resume_count: number; perspective_count: number } {
  const archetype = get(db, id)
  if (!archetype) return { resume_count: 0, perspective_count: 0 }

  const resumeCount = db
    .query('SELECT COUNT(*) AS c FROM resumes WHERE archetype = ?')
    .get(archetype.name) as { c: number }

  const perspCount = db
    .query('SELECT COUNT(*) AS c FROM perspectives WHERE target_archetype = ?')
    .get(archetype.name) as { c: number }

  return {
    resume_count: resumeCount.c,
    perspective_count: perspCount.c,
  }
}

export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM archetypes WHERE id = ?', [id])
  return result.changes > 0
}

// ── Domain association management ────────────────────────────────────

export function addDomain(db: Database, archetypeId: string, domainId: string): void {
  db.run(
    'INSERT INTO archetype_domains (archetype_id, domain_id) VALUES (?, ?)',
    [archetypeId, domainId],
  )
}

export function removeDomain(db: Database, archetypeId: string, domainId: string): boolean {
  const result = db.run(
    'DELETE FROM archetype_domains WHERE archetype_id = ? AND domain_id = ?',
    [archetypeId, domainId],
  )
  return result.changes > 0
}

export function listDomains(db: Database, archetypeId: string): Domain[] {
  return db
    .query(
      `SELECT d.* FROM domains d
       JOIN archetype_domains ad ON d.id = ad.domain_id
       WHERE ad.archetype_id = ?
       ORDER BY d.name ASC`,
    )
    .all(archetypeId) as Domain[]
}

/**
 * Get expected domain names for a given archetype name.
 * This replaces ARCHETYPE_EXPECTED_DOMAINS[archetypeName].
 */
export function getExpectedDomainNames(db: Database, archetypeName: string): string[] {
  const rows = db
    .query(
      `SELECT d.name FROM domains d
       JOIN archetype_domains ad ON d.id = ad.domain_id
       JOIN archetypes a ON a.id = ad.archetype_id
       WHERE a.name = ?`,
    )
    .all(archetypeName) as Array<{ name: string }>

  return rows.map((r) => r.name)
}
