/**
 * SummaryRepository -- CRUD operations for the summaries table.
 *
 * All functions take a `Database` instance as the first parameter,
 * keeping the repository stateless and testable.
 *
 * As of migration 033 (Phase 91), summaries have:
 * - industry_id / role_type_id FKs (nullable)
 * - summary_skills junction for keyword tagging
 * The tagline column is preserved for now and will move to resume-level
 * in Phase 92 (Tagline Engine).
 */

import type { Database } from 'bun:sqlite'
import type {
  Summary,
  SummaryWithRelations,
  Resume,
  Industry,
  RoleType,
  Skill,
} from '../../types'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSummaryInput {
  title: string
  role?: string
  tagline?: string  // @deprecated (Phase 92 moves to resume)
  description?: string
  is_template?: number
  industry_id?: string | null
  role_type_id?: string | null
  notes?: string
}

export interface UpdateSummaryInput {
  title?: string
  role?: string | null
  tagline?: string | null  // @deprecated
  description?: string | null
  is_template?: number
  industry_id?: string | null
  role_type_id?: string | null
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Filter / sort types
// ---------------------------------------------------------------------------

export interface SummaryFilter {
  is_template?: number
  industry_id?: string
  role_type_id?: string
  skill_id?: string
}

export type SummarySortBy = 'title' | 'created_at' | 'updated_at'
export type SortDirection = 'asc' | 'desc'

export interface SummarySort {
  sort_by?: SummarySortBy
  direction?: SortDirection
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/** Insert a new summary and return the created row (with linked_resume_count = 0). */
export function create(db: Database, input: CreateSummaryInput): Summary {
  const id = crypto.randomUUID()
  db
    .query(
      `INSERT INTO summaries (id, title, role, tagline, description, is_template,
                              industry_id, role_type_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title,
      input.role ?? null,
      input.tagline ?? null,
      input.description ?? null,
      input.is_template ?? 0,
      input.industry_id ?? null,
      input.role_type_id ?? null,
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

/** Retrieve a summary by ID with industry, role_type, and linked skills hydrated. */
export function getWithRelations(
  db: Database,
  id: string,
): SummaryWithRelations | null {
  const base = get(db, id)
  if (!base) return null

  const industry = base.industry_id
    ? (db.query('SELECT * FROM industries WHERE id = ?').get(base.industry_id) as Industry | null) ?? null
    : null

  const roleType = base.role_type_id
    ? (db.query('SELECT * FROM role_types WHERE id = ?').get(base.role_type_id) as RoleType | null) ?? null
    : null

  const skills = getSkills(db, id)

  return { ...base, industry, role_type: roleType, skills }
}

/**
 * List summaries with optional filter and sort.
 * Returns data array and total count (before pagination).
 *
 * Filters:
 *  - is_template (0 or 1)
 *  - industry_id
 *  - role_type_id
 *  - skill_id (via summary_skills junction)
 *
 * Sort: 'title' | 'created_at' | 'updated_at' (default: updated_at, desc).
 * Templates always float to the top (is_template DESC) regardless of sort.
 */
export function list(
  db: Database,
  filter?: SummaryFilter,
  sort?: SummarySort,
  offset = 0,
  limit = 50,
): { data: Summary[]; total: number } {
  const conditions: string[] = []
  const params: unknown[] = []
  let fromClause = 'FROM summaries s'

  if (filter?.is_template !== undefined) {
    conditions.push('s.is_template = ?')
    params.push(filter.is_template)
  }
  if (filter?.industry_id !== undefined) {
    conditions.push('s.industry_id = ?')
    params.push(filter.industry_id)
  }
  if (filter?.role_type_id !== undefined) {
    conditions.push('s.role_type_id = ?')
    params.push(filter.role_type_id)
  }
  if (filter?.skill_id !== undefined) {
    fromClause += ' JOIN summary_skills ss ON ss.summary_id = s.id'
    conditions.push('ss.skill_id = ?')
    params.push(filter.skill_id)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = db
    .query(`SELECT COUNT(*) AS total ${fromClause} ${where}`)
    .get(...params) as { total: number }

  const sortBy: SummarySortBy = sort?.sort_by ?? 'updated_at'
  const direction: SortDirection = sort?.direction ?? (sortBy === 'title' ? 'asc' : 'desc')
  const sortColumn =
    sortBy === 'title' ? 's.title'
    : sortBy === 'created_at' ? 's.created_at'
    : 's.updated_at'
  const orderBy = `ORDER BY s.is_template DESC, ${sortColumn} ${direction.toUpperCase()}`

  const dataParams = [...params, limit, offset]
  const rows = db
    .query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM resumes WHERE summary_id = s.id) AS linked_resume_count
       ${fromClause}
       ${where}
       ${orderBy}
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
  if (input.industry_id !== undefined) { sets.push('industry_id = ?'); params.push(input.industry_id) }
  if (input.role_type_id !== undefined) { sets.push('role_type_id = ?'); params.push(input.role_type_id) }
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
 * - All other fields copied verbatim, including industry_id, role_type_id
 * - Linked skills are also duplicated into summary_skills
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
      `INSERT INTO summaries (id, title, role, tagline, description, is_template,
                              industry_id, role_type_id, notes)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .run(
      newId,
      `Copy of ${source.title}`,
      source.role,
      source.tagline,
      source.description,
      source.industry_id,
      source.role_type_id,
      source.notes,
    )

  // Copy skill links
  db.run(
    `INSERT INTO summary_skills (summary_id, skill_id)
     SELECT ?, skill_id FROM summary_skills WHERE summary_id = ?`,
    [newId, id],
  )

  return get(db, newId)!
}

// ---------------------------------------------------------------------------
// Summary ↔ Skill junction (keyword tagging) — added in migration 033
// ---------------------------------------------------------------------------

/** Link a skill to a summary as a keyword (idempotent). */
export function addSkill(db: Database, summaryId: string, skillId: string): void {
  db.run(
    'INSERT OR IGNORE INTO summary_skills (summary_id, skill_id) VALUES (?, ?)',
    [summaryId, skillId],
  )
}

/** Unlink a skill from a summary. */
export function removeSkill(db: Database, summaryId: string, skillId: string): void {
  db.run(
    'DELETE FROM summary_skills WHERE summary_id = ? AND skill_id = ?',
    [summaryId, skillId],
  )
}

/** Get all skills linked to a summary as keywords, ordered by name. */
export function getSkills(db: Database, summaryId: string): Skill[] {
  return db
    .query(
      `SELECT s.*
       FROM skills s
       JOIN summary_skills ss ON ss.skill_id = s.id
       WHERE ss.summary_id = ?
       ORDER BY s.name ASC`,
    )
    .all(summaryId) as Skill[]
}
