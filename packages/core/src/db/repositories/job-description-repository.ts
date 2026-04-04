/**
 * JobDescriptionRepository -- CRUD operations for the job_descriptions table.
 *
 * All functions take a `Database` instance as the first parameter,
 * keeping the repository stateless and testable.
 */

import type { Database } from 'bun:sqlite'
import type {
  JobDescription,
  JobDescriptionWithOrg,
  CreateJobDescription,
  UpdateJobDescription,
  JobDescriptionStatus,
} from '../../types'

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface JobDescriptionFilter {
  status?: JobDescriptionStatus
  organization_id?: string
}

// ---------------------------------------------------------------------------
// Internal: base SELECT with organization JOIN
// ---------------------------------------------------------------------------

const SELECT_WITH_ORG = `
  SELECT jd.*,
         o.name AS organization_name
  FROM job_descriptions jd
  LEFT JOIN organizations o ON o.id = jd.organization_id
`

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/** Insert a new job description and return the created row with org name. */
export function create(
  db: Database,
  input: CreateJobDescription,
): JobDescriptionWithOrg {
  const id = crypto.randomUUID()
  db.query(
    `INSERT INTO job_descriptions (id, organization_id, title, url, raw_text, status, salary_range, location, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.organization_id ?? null,
    input.title,
    input.url ?? null,
    input.raw_text,
    input.status ?? 'interested',
    input.salary_range ?? null,
    input.location ?? null,
    input.notes ?? null,
  )

  return get(db, id)!
}

/** Retrieve a job description by ID with org name, or null if not found. */
export function get(
  db: Database,
  id: string,
): JobDescriptionWithOrg | null {
  return (
    (db
      .query(`${SELECT_WITH_ORG} WHERE jd.id = ?`)
      .get(id) as JobDescriptionWithOrg | null) ?? null
  )
}

/**
 * List job descriptions with optional filters: status, organization_id.
 * Returns data array and total count (before pagination).
 * Results are ordered by created_at DESC (newest first).
 */
export function list(
  db: Database,
  filter?: JobDescriptionFilter,
  offset = 0,
  limit = 50,
): { data: JobDescriptionWithOrg[]; total: number } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter?.status !== undefined) {
    conditions.push('jd.status = ?')
    params.push(filter.status)
  }
  if (filter?.organization_id !== undefined) {
    conditions.push('jd.organization_id = ?')
    params.push(filter.organization_id)
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = db
    .query(
      `SELECT COUNT(*) AS total FROM job_descriptions jd ${where}`,
    )
    .get(...params) as { total: number }

  const dataParams = [...params, limit, offset]
  const rows = db
    .query(
      `${SELECT_WITH_ORG} ${where} ORDER BY jd.updated_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...dataParams) as JobDescriptionWithOrg[]

  return { data: rows, total: countRow.total }
}

/**
 * Partially update a job description.
 * Only the fields present in `input` are changed. `updated_at` is
 * always refreshed. Returns null if the job description does not exist.
 */
export function update(
  db: Database,
  id: string,
  input: UpdateJobDescription,
): JobDescriptionWithOrg | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.title !== undefined) {
    sets.push('title = ?')
    params.push(input.title)
  }
  if (input.organization_id !== undefined) {
    sets.push('organization_id = ?')
    params.push(input.organization_id)
  }
  if (input.url !== undefined) {
    sets.push('url = ?')
    params.push(input.url)
  }
  if (input.raw_text !== undefined) {
    sets.push('raw_text = ?')
    params.push(input.raw_text)
  }
  if (input.status !== undefined) {
    sets.push('status = ?')
    params.push(input.status)
  }
  if (input.salary_range !== undefined) {
    sets.push('salary_range = ?')
    params.push(input.salary_range)
  }
  if (input.location !== undefined) {
    sets.push('location = ?')
    params.push(input.location)
  }
  if (input.notes !== undefined) {
    sets.push('notes = ?')
    params.push(input.notes)
  }

  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
  params.push(id)

  db.query(
    `UPDATE job_descriptions SET ${sets.join(', ')} WHERE id = ?`,
  ).run(...params)

  return get(db, id)
}

/** Delete a job description by ID. Returns true if a row was deleted. */
export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM job_descriptions WHERE id = ?', [id])
  return result.changes > 0
}
