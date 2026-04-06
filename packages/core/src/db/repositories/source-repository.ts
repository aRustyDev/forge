/**
 * SourceRepository — pure data access for the `sources` table and
 * polymorphic extension tables (source_roles, source_projects,
 * source_education).
 *
 * All functions take a `db: Database` as the first parameter (dependency
 * injection). No business logic lives here; services handle status
 * transition validation, derivation eligibility, etc.
 *
 * As of migration 037 (Phase 84), clearance is no longer a source_type.
 * Clearance data lives in the `credentials` entity, managed by
 * CredentialRepository/Service.
 */

import type { Database } from 'bun:sqlite'
import type {
  Source,
  CreateSource,
  UpdateSource,
  SourceStatus,
  SourceType,
  SourceRole,
  SourceProject,
  SourceEducation,
  SourcePresentation,
  SourceWithExtension,
} from '../../types'

/** Filter options for listing sources. */
export interface SourceFilter {
  source_type?: SourceType
  organization_id?: string
  status?: SourceStatus
  /**
   * Filter education-type sources by their extension subtype.
   * Values match `source_education.education_type` (e.g. `'degree'`,
   * `'certificate'`, `'course'`). Only meaningful when combined with
   * `source_type: 'education'`; on other source types it is ignored.
   */
  education_type?: string
}

/** Paginated list result. */
export interface SourceListResult {
  data: Source[]
  total: number
}

// ── Extension helpers ─────────────────────────────────────────────────

/** Retrieve the extension row for a source based on its source_type. */
export function getExtension(
  db: Database,
  sourceId: string,
  sourceType: string,
): SourceRole | SourceProject | SourceEducation | SourcePresentation | null {
  switch (sourceType) {
    case 'role':
      return db.query('SELECT * FROM source_roles WHERE source_id = ?').get(sourceId) as SourceRole | null
    case 'project':
      return db.query('SELECT * FROM source_projects WHERE source_id = ?').get(sourceId) as SourceProject | null
    case 'education':
      return db.query('SELECT * FROM source_education WHERE source_id = ?').get(sourceId) as SourceEducation | null
    case 'presentation':
      return db.query('SELECT * FROM source_presentations WHERE source_id = ?').get(sourceId) as SourcePresentation | null
    default:
      return null
  }
}

/** Update extension table fields for a source. */
function updateExtension(
  db: Database,
  sourceId: string,
  sourceType: string,
  input: UpdateSource,
): void {
  if (sourceType === 'role') {
    const sets: string[] = []
    const params: unknown[] = []

    if ('organization_id' in input) { sets.push('organization_id = ?'); params.push(input.organization_id ?? null) }
    if ('is_current' in input) { sets.push('is_current = ?'); params.push(input.is_current ?? 0) }
    if ('work_arrangement' in input) { sets.push('work_arrangement = ?'); params.push(input.work_arrangement ?? null) }
    if ('base_salary' in input) { sets.push('base_salary = ?'); params.push(input.base_salary ?? null) }
    if ('total_comp_notes' in input) { sets.push('total_comp_notes = ?'); params.push(input.total_comp_notes ?? null) }
    if ('start_date' in input) { sets.push('start_date = ?'); params.push(input.start_date ?? null) }
    if ('end_date' in input) { sets.push('end_date = ?'); params.push(input.end_date ?? null) }

    if (sets.length > 0) {
      params.push(sourceId)
      db.run(`UPDATE source_roles SET ${sets.join(', ')} WHERE source_id = ?`, params)
    }
  } else if (sourceType === 'project') {
    const sets: string[] = []
    const params: unknown[] = []

    if ('organization_id' in input) { sets.push('organization_id = ?'); params.push(input.organization_id ?? null) }
    if ('is_personal' in input) { sets.push('is_personal = ?'); params.push(input.is_personal ?? 0) }
    if ('url' in input) { sets.push('url = ?'); params.push(input.url ?? null) }
    if ('start_date' in input) { sets.push('start_date = ?'); params.push(input.start_date ?? null) }
    if ('end_date' in input) { sets.push('end_date = ?'); params.push(input.end_date ?? null) }

    if (sets.length > 0) {
      params.push(sourceId)
      db.run(`UPDATE source_projects SET ${sets.join(', ')} WHERE source_id = ?`, params)
    }
  } else if (sourceType === 'education') {
    const sets: string[] = []
    const params: unknown[] = []

    if ('education_type' in input) { sets.push('education_type = ?'); params.push(input.education_type) }
    if ('education_organization_id' in input) { sets.push('organization_id = ?'); params.push(input.education_organization_id ?? null) }
    if ('campus_id' in input) { sets.push('campus_id = ?'); params.push(input.campus_id ?? null) }
    if ('field' in input) { sets.push('field = ?'); params.push(input.field ?? null) }
    if ('is_in_progress' in input) { sets.push('is_in_progress = ?'); params.push(input.is_in_progress ?? 0) }
    if ('credential_id' in input) { sets.push('credential_id = ?'); params.push(input.credential_id ?? null) }
    if ('expiration_date' in input) { sets.push('expiration_date = ?'); params.push(input.expiration_date ?? null) }
    if ('url' in input) { sets.push('url = ?'); params.push(input.url ?? null) }
    if ('start_date' in input) { sets.push('start_date = ?'); params.push(input.start_date ?? null) }
    if ('end_date' in input) { sets.push('end_date = ?'); params.push(input.end_date ?? null) }
    if ('degree_level' in input) { sets.push('degree_level = ?'); params.push(input.degree_level ?? null) }
    if ('degree_type' in input) { sets.push('degree_type = ?'); params.push(input.degree_type ?? null) }
    if ('certificate_subtype' in input) { sets.push('certificate_subtype = ?'); params.push(input.certificate_subtype ?? null) }
    if ('gpa' in input) { sets.push('gpa = ?'); params.push(input.gpa ?? null) }
    if ('location' in input) { sets.push('location = ?'); params.push(input.location ?? null) }
    if ('edu_description' in input) { sets.push('edu_description = ?'); params.push(input.edu_description ?? null) }

    if (sets.length > 0) {
      params.push(sourceId)
      db.run(`UPDATE source_education SET ${sets.join(', ')} WHERE source_id = ?`, params)
    }
  } else if (sourceType === 'presentation') {
    const sets: string[] = []
    const params: unknown[] = []
    if ('venue' in input) { sets.push('venue = ?'); params.push(input.venue ?? null) }
    if ('presentation_type' in input) { sets.push('presentation_type = ?'); params.push(input.presentation_type) }
    if ('url' in input) { sets.push('url = ?'); params.push(input.url ?? null) }
    if ('coauthors' in input) { sets.push('coauthors = ?'); params.push(input.coauthors ?? null) }
    if (sets.length > 0) {
      params.push(sourceId)
      db.run(`UPDATE source_presentations SET ${sets.join(', ')} WHERE source_id = ?`, params)
    }
  }
}

// ── Repository functions ──────────────────────────────────────────────

/**
 * Insert a new source record with optional extension table row.
 *
 * Generates a UUID via `crypto.randomUUID()`, sets status to `'draft'`
 * and updated_by to `'human'`. Atomically creates base + extension row
 * in a transaction.
 */
export function create(db: Database, input: CreateSource): SourceWithExtension {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const sourceType = input.source_type ?? 'general'

  const txn = db.transaction(() => {
    // Insert base source row
    db.run(
      `INSERT INTO sources (id, title, description, source_type, start_date, end_date, status, updated_by, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', 'human', ?, ?, ?)`,
      [
        id,
        input.title,
        input.description,
        sourceType,
        input.start_date ?? null,
        input.end_date ?? null,
        input.notes ?? null,
        now,
        now,
      ],
    )

    // Insert extension row based on source_type
    if (sourceType === 'role') {
      db.run(
        `INSERT INTO source_roles (source_id, organization_id, start_date, end_date, is_current, work_arrangement, base_salary, total_comp_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.organization_id ?? null,
          input.start_date ?? null,
          input.end_date ?? null,
          input.is_current ?? 0,
          input.work_arrangement ?? null,
          input.base_salary ?? null,
          input.total_comp_notes ?? null,
        ],
      )
    } else if (sourceType === 'project') {
      db.run(
        `INSERT INTO source_projects (source_id, organization_id, is_personal, url, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.organization_id ?? null,
          input.is_personal ?? 0,
          input.url ?? null,
          input.start_date ?? null,
          input.end_date ?? null,
        ],
      )
    } else if (sourceType === 'education') {
      db.run(
        `INSERT INTO source_education (
          source_id, education_type, organization_id, campus_id, field, start_date, end_date,
          is_in_progress, credential_id, expiration_date, url,
          degree_level, degree_type, certificate_subtype, gpa, location, edu_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.education_type ?? 'certificate',
          input.education_organization_id ?? null,
          input.campus_id ?? null,
          input.field ?? null,
          input.start_date ?? null,
          input.end_date ?? null,
          input.is_in_progress ?? 0,
          input.credential_id ?? null,
          input.expiration_date ?? null,
          input.url ?? null,
          input.degree_level ?? null,
          input.degree_type ?? null,
          input.certificate_subtype ?? null,
          input.gpa ?? null,
          input.location ?? null,
          input.edu_description ?? null,
        ],
      )
    } else if (sourceType === 'presentation') {
      db.run(
        `INSERT INTO source_presentations (source_id, venue, presentation_type, url, coauthors)
         VALUES (?, ?, ?, ?, ?)`,
        [
          id,
          input.venue ?? null,
          input.presentation_type ?? 'conference_talk',
          input.url ?? null,
          input.coauthors ?? null,
        ],
      )
    }
    // 'general' type has no extension table
  })

  txn()
  return get(db, id)!
}

/**
 * Retrieve a single source by ID, including its extension data.
 *
 * Returns `null` when no row matches.
 */
export function get(db: Database, id: string): SourceWithExtension | null {
  const source = db
    .query('SELECT * FROM sources WHERE id = ?')
    .get(id) as Source | null

  if (!source) return null

  const extension = getExtension(db, source.id, source.source_type)
  return { ...source, extension }
}

/**
 * List sources with optional filters and pagination.
 *
 * Executes two queries: a COUNT for the total matching rows and a
 * SELECT with LIMIT/OFFSET for the page. Results are sorted by
 * `created_at DESC`.
 *
 * The `organization_id` filter JOINs to both source_roles and
 * source_projects to match sources belonging to an organization.
 */
export function list(
  db: Database,
  filter: SourceFilter,
  offset: number,
  limit: number,
): SourceListResult {
  const conditions: string[] = []
  const params: unknown[] = []
  const joinClauses: string[] = []

  if (filter.source_type !== undefined) {
    conditions.push('s.source_type = ?')
    params.push(filter.source_type)
  }
  if (filter.status !== undefined) {
    conditions.push('s.status = ?')
    params.push(filter.status)
  }
  if (filter.organization_id !== undefined) {
    joinClauses.push(
      'LEFT JOIN source_roles sr ON s.id = sr.source_id',
      'LEFT JOIN source_projects sp ON s.id = sp.source_id',
    )
    conditions.push('(sr.organization_id = ? OR sp.organization_id = ?)')
    params.push(filter.organization_id, filter.organization_id)
  }
  if (filter.education_type !== undefined) {
    // INNER JOIN so the education_type filter also implicitly scopes to
    // education-type sources (rows without a source_education row drop out).
    joinClauses.push('JOIN source_education se ON se.source_id = s.id')
    conditions.push('se.education_type = ?')
    params.push(filter.education_type)
  }

  const joinClause = joinClauses.join(' ')
  const where = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : ''

  const countRow = db
    .query(`SELECT COUNT(DISTINCT s.id) AS total FROM sources s ${joinClause} ${where}`)
    .get(...params) as { total: number }

  const dataParams = [...params, limit, offset]
  const data = db
    .query(`SELECT DISTINCT s.* FROM sources s ${joinClause} ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`)
    .all(...dataParams) as Source[]

  return { data, total: countRow.total }
}

/** List all sources without pagination (for data export). */
export function listAll(db: Database): Source[] {
  return db
    .query('SELECT * FROM sources ORDER BY created_at DESC')
    .all() as Source[]
}

/**
 * Partially update a source (base fields and extension fields).
 *
 * Only the fields present in `input` are changed. `updated_at` is
 * always refreshed. Returns `null` if the source does not exist.
 */
export function update(db: Database, id: string, input: UpdateSource): SourceWithExtension | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.title !== undefined) {
    sets.push('title = ?')
    params.push(input.title)
  }
  if (input.description !== undefined) {
    sets.push('description = ?')
    params.push(input.description)
  }
  if ('start_date' in input) {
    sets.push('start_date = ?')
    params.push(input.start_date ?? null)
  }
  if ('end_date' in input) {
    sets.push('end_date = ?')
    params.push(input.end_date ?? null)
  }
  if ('notes' in input) {
    sets.push('notes = ?')
    params.push(input.notes ?? null)
  }

  const now = new Date().toISOString()
  sets.push('updated_at = ?')
  params.push(now)

  params.push(id)

  db.run(
    `UPDATE sources SET ${sets.join(', ')} WHERE id = ?`,
    params,
  )

  // Update extension table if applicable
  updateExtension(db, id, existing.source_type, input)

  return get(db, id)!
}

/**
 * Delete a source by ID.
 *
 * Returns `false` if no row was found. Throws if the source still has
 * bullets (FK RESTRICT via bullet_sources). Extension rows are
 * CASCADE-deleted automatically.
 */
export function del(db: Database, id: string): boolean {
  const existing = get(db, id)
  if (!existing) return false

  db.run('DELETE FROM sources WHERE id = ?', [id])
  return true
}

/**
 * Atomically set a source's status to `'deriving'`.
 *
 * Uses `UPDATE ... WHERE status != 'deriving' RETURNING *` so that a
 * concurrent call returns `null` instead of double-locking.
 */
export function acquireDerivingLock(db: Database, id: string): Source | null {
  const row = db
    .query(
      `UPDATE sources SET status = 'deriving', updated_at = ?
       WHERE id = ? AND status != 'deriving'
       RETURNING *`,
    )
    .get(new Date().toISOString(), id) as Source | null

  return row ?? null
}

/**
 * Release the deriving lock by restoring the previous status.
 *
 * When `derived` is true, `last_derived_at` is set to now.
 */
export function releaseDerivingLock(
  db: Database,
  id: string,
  restoreStatus: SourceStatus,
  derived: boolean,
): void {
  const now = new Date().toISOString()

  if (derived) {
    db.run(
      `UPDATE sources SET status = ?, last_derived_at = ?, updated_at = ? WHERE id = ?`,
      [restoreStatus, now, now, id],
    )
  } else {
    db.run(
      `UPDATE sources SET status = ?, updated_at = ? WHERE id = ?`,
      [restoreStatus, now, id],
    )
  }
}
