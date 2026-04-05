/**
 * SkillRepository — CRUD operations for the skills table.
 *
 * All functions take a `Database` instance as the first parameter,
 * keeping the repository stateless and testable.
 *
 * As of migration 031:
 * - category is a structured enum (SkillCategory) with CHECK constraint
 * - Supports skill_domains junction for many-to-many skill↔domain linkage
 */

import type { Database } from 'bun:sqlite'
import type { Skill, SkillCategory, SkillWithDomains, Domain } from '../../types'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSkillInput {
  name: string
  category?: SkillCategory
  notes?: string | null
}

export interface UpdateSkillInput {
  name?: string
  category?: SkillCategory
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface SkillFilter {
  category?: SkillCategory
  domain_id?: string
}

// ---------------------------------------------------------------------------
// Internal row type (includes created_at from schema)
// ---------------------------------------------------------------------------

interface SkillRow {
  id: string
  name: string
  category: SkillCategory
  notes: string | null
  created_at: string
}

/** Map a database row to a Skill entity. */
function toSkill(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    notes: row.notes,
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
      `INSERT INTO skills (id, name, category, notes)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
    )
    .get(id, input.name, input.category ?? 'other', input.notes ?? null) as SkillRow

  return toSkill(row)
}

/** Retrieve a skill by ID, or null if not found. */
export function get(db: Database, id: string): Skill | null {
  const row = db.query('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow | null
  return row ? toSkill(row) : null
}

/** Retrieve a skill by name (case-insensitive), or null if not found. */
export function getByName(db: Database, name: string): Skill | null {
  const row = db
    .query('SELECT * FROM skills WHERE lower(name) = lower(?)')
    .get(name) as SkillRow | null
  return row ? toSkill(row) : null
}

/**
 * List skills, optionally filtered by category and/or domain.
 * Results are ordered by name ascending.
 */
export function list(db: Database, filter?: SkillFilter): Skill[] {
  const conditions: string[] = []
  const params: unknown[] = []
  let fromClause = 'FROM skills s'

  if (filter?.category) {
    conditions.push('s.category = ?')
    params.push(filter.category)
  }
  if (filter?.domain_id) {
    fromClause += ' JOIN skill_domains sd ON sd.skill_id = s.id'
    conditions.push('sd.domain_id = ?')
    params.push(filter.domain_id)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const sql = `SELECT s.* ${fromClause} ${where} ORDER BY s.name ASC`

  return (db.query(sql).all(...params) as SkillRow[]).map(toSkill)
}

/** List all skills filtered by category. */
export function findByCategory(db: Database, category: SkillCategory): Skill[] {
  return list(db, { category })
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
    `INSERT OR IGNORE INTO skills (id, name, category, notes) VALUES (?, ?, ?, ?)`,
    [id, input.name, input.category ?? 'other', input.notes ?? null],
  )

  // Always SELECT by name to get the canonical row (whether just-inserted or pre-existing).
  const row = db
    .query('SELECT * FROM skills WHERE name = ?')
    .get(input.name) as SkillRow

  return toSkill(row)
}

/** Update a skill's name, category, or notes. Returns the updated skill or null if not found. */
export function update(db: Database, id: string, input: UpdateSkillInput): Skill | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) {
    sets.push('name = ?')
    params.push(input.name)
  }
  if (input.category !== undefined) {
    sets.push('category = ?')
    params.push(input.category)
  }
  if (input.notes !== undefined) {
    sets.push('notes = ?')
    params.push(input.notes)
  }

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

// ---------------------------------------------------------------------------
// Skill ↔ Domain junction
// ---------------------------------------------------------------------------

interface DomainRow {
  id: string
  name: string
  description: string | null
  created_at: string
}

function toDomain(row: DomainRow): Domain {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
  }
}

/** Link a skill to a domain (idempotent). */
export function addDomain(db: Database, skillId: string, domainId: string): void {
  db.run(
    'INSERT OR IGNORE INTO skill_domains (skill_id, domain_id) VALUES (?, ?)',
    [skillId, domainId],
  )
}

/** Unlink a skill from a domain. */
export function removeDomain(db: Database, skillId: string, domainId: string): void {
  db.run(
    'DELETE FROM skill_domains WHERE skill_id = ? AND domain_id = ?',
    [skillId, domainId],
  )
}

/** Get all domains linked to a skill. */
export function getDomains(db: Database, skillId: string): Domain[] {
  const rows = db
    .query(
      `SELECT d.*
       FROM domains d
       JOIN skill_domains sd ON sd.domain_id = d.id
       WHERE sd.skill_id = ?
       ORDER BY d.name ASC`,
    )
    .all(skillId) as DomainRow[]
  return rows.map(toDomain)
}

/** Get a skill with its linked domains populated. */
export function getWithDomains(db: Database, skillId: string): SkillWithDomains | null {
  const skill = get(db, skillId)
  if (!skill) return null
  return { ...skill, domains: getDomains(db, skillId) }
}

/** List all skills with their linked domains populated. */
export function listWithDomains(db: Database, filter?: SkillFilter): SkillWithDomains[] {
  const skills = list(db, filter)
  return skills.map((skill) => ({
    ...skill,
    domains: getDomains(db, skill.id),
  }))
}
