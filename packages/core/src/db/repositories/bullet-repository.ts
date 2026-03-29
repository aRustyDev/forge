/**
 * BulletRepository — pure data access for the bullets table.
 *
 * Handles CRUD, technology junction management, and status updates.
 * Does NOT enforce business rules (status transition validation lives
 * in the BulletService).
 */

import type { Database } from 'bun:sqlite'

// ── Types ────────────────────────────────────────────────────────────

export type BulletStatus = 'draft' | 'pending_review' | 'approved' | 'rejected'

export interface Bullet {
  id: string
  source_id: string
  content: string
  source_content_snapshot: string
  metrics: string | null
  status: BulletStatus
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
  technologies: string[]
}

export interface CreateBulletInput {
  source_id: string
  content: string
  source_content_snapshot: string
  technologies: string[]
  metrics: string | null
  status?: string   // default: 'pending_review'
  prompt_log_id?: string
}

export interface UpdateBulletInput {
  content?: string
  metrics?: string | null
}

export interface BulletFilter {
  source_id?: string
  status?: string
  technology?: string
}

export interface BulletListResult {
  data: Bullet[]
  total: number
}

// ── Row types (raw DB rows before hydration) ─────────────────────────

interface BulletRow {
  id: string
  source_id: string
  content: string
  source_content_snapshot: string
  metrics: string | null
  status: string
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
}

interface TechnologyRow {
  technology: string
}

// ── Helpers ──────────────────────────────────────────────────────────

function rowToBullet(row: BulletRow, technologies: string[]): Bullet {
  return {
    id: row.id,
    source_id: row.source_id,
    content: row.content,
    source_content_snapshot: row.source_content_snapshot,
    metrics: row.metrics,
    status: row.status as BulletStatus,
    rejection_reason: row.rejection_reason,
    prompt_log_id: row.prompt_log_id,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    created_at: row.created_at,
    technologies,
  }
}

function getTechnologies(db: Database, bulletId: string): string[] {
  const rows = db
    .query('SELECT technology FROM bullet_technologies WHERE bullet_id = ? ORDER BY technology')
    .all(bulletId) as TechnologyRow[]
  return rows.map(r => r.technology)
}

function insertTechnologies(db: Database, bulletId: string, technologies: string[]): void {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO bullet_technologies (bullet_id, technology) VALUES (?, ?)',
  )
  for (const tech of technologies) {
    const normalized = tech.toLowerCase().trim()
    if (normalized.length > 0) {
      stmt.run(bulletId, normalized)
    }
  }
}

// ── Repository ───────────────────────────────────────────────────────

export const BulletRepository = {
  /**
   * Create a new bullet with associated technologies.
   * Generates a UUID, normalizes technology names, and inserts junction rows.
   */
  create(db: Database, input: CreateBulletInput): Bullet {
    const id = crypto.randomUUID()
    const status = input.status ?? 'pending_review'

    const row = db
      .query(
        `INSERT INTO bullets (id, source_id, content, source_content_snapshot, metrics, status, prompt_log_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
      )
      .get(
        id,
        input.source_id,
        input.content,
        input.source_content_snapshot,
        input.metrics,
        status,
        input.prompt_log_id ?? null,
      ) as BulletRow

    insertTechnologies(db, id, input.technologies)
    const technologies = getTechnologies(db, id)

    return rowToBullet(row, technologies)
  },

  /**
   * Get a bullet by ID, including its technologies array.
   * Returns null if not found.
   */
  get(db: Database, id: string): Bullet | null {
    const row = db
      .query('SELECT * FROM bullets WHERE id = ?')
      .get(id) as BulletRow | null

    if (!row) return null

    const technologies = getTechnologies(db, id)
    return rowToBullet(row, technologies)
  },

  /**
   * List bullets with optional filters and pagination.
   * Technology filter uses a JOIN on bullet_technologies.
   * Returns data array and total count (before pagination).
   */
  list(
    db: Database,
    filter: BulletFilter = {},
    offset = 0,
    limit = 50,
  ): BulletListResult {
    const conditions: string[] = []
    const params: unknown[] = []
    let joinClause = ''

    if (filter.source_id) {
      conditions.push('b.source_id = ?')
      params.push(filter.source_id)
    }
    if (filter.status) {
      conditions.push('b.status = ?')
      params.push(filter.status)
    }
    if (filter.technology) {
      joinClause = 'JOIN bullet_technologies bt ON bt.bullet_id = b.id'
      conditions.push('bt.technology = ?')
      params.push(filter.technology.toLowerCase().trim())
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

    // Count query
    const countRow = db
      .query(`SELECT COUNT(DISTINCT b.id) as total FROM bullets b ${joinClause} ${whereClause}`)
      .get(...params) as { total: number }

    const total = countRow.total

    // Data query
    const rows = db
      .query(
        `SELECT DISTINCT b.* FROM bullets b ${joinClause} ${whereClause}
         ORDER BY b.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as BulletRow[]

    const data = rows.map(row => {
      const technologies = getTechnologies(db, row.id)
      return rowToBullet(row, technologies)
    })

    return { data, total }
  },

  /**
   * Update a bullet's mutable fields (content, metrics).
   * Returns the updated bullet or null if not found.
   */
  update(db: Database, id: string, input: UpdateBulletInput): Bullet | null {
    const sets: string[] = []
    const params: unknown[] = []

    if (input.content !== undefined) {
      sets.push('content = ?')
      params.push(input.content)
    }
    if (input.metrics !== undefined) {
      sets.push('metrics = ?')
      params.push(input.metrics)
    }

    if (sets.length === 0) {
      return BulletRepository.get(db, id)
    }

    params.push(id)

    const row = db
      .query(`UPDATE bullets SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
      .get(...params) as BulletRow | null

    if (!row) return null

    const technologies = getTechnologies(db, id)
    return rowToBullet(row, technologies)
  },

  /**
   * Delete a bullet by ID.
   * Throws if the bullet has perspectives (FK RESTRICT).
   * Cascades deletion to bullet_technologies (FK CASCADE).
   * Returns true if a row was deleted, false if not found.
   */
  delete(db: Database, id: string): boolean {
    // This will throw if perspectives reference this bullet (FK RESTRICT).
    // bullet_technologies rows are automatically cascaded.
    const result = db.run('DELETE FROM bullets WHERE id = ?', [id])
    return result.changes > 0
  },

  /**
   * Update a bullet's status and related fields.
   *
   * Sets approved_at/approved_by when status becomes 'approved'.
   * Sets rejection_reason when status becomes 'rejected'.
   * Clears approved_at/approved_by when moving away from 'approved'.
   *
   * Does NOT validate status transitions — the BulletService handles that.
   */
  updateStatus(
    db: Database,
    id: string,
    status: BulletStatus,
    opts?: { rejection_reason?: string },
  ): Bullet | null {
    let row: BulletRow | null

    if (status === 'approved') {
      row = db
        .query(
          `UPDATE bullets
           SET status = ?, approved_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), approved_by = 'human'
           WHERE id = ?
           RETURNING *`,
        )
        .get(status, id) as BulletRow | null
    } else if (status === 'rejected') {
      row = db
        .query(
          `UPDATE bullets
           SET status = ?, rejection_reason = ?
           WHERE id = ?
           RETURNING *`,
        )
        .get(status, opts?.rejection_reason ?? null, id) as BulletRow | null
    } else {
      row = db
        .query(
          `UPDATE bullets SET status = ? WHERE id = ? RETURNING *`,
        )
        .get(status, id) as BulletRow | null
    }

    if (!row) return null

    const technologies = getTechnologies(db, id)
    return rowToBullet(row, technologies)
  },
}
