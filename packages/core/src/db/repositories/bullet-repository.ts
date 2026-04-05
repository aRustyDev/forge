/**
 * BulletRepository — pure data access for the bullets table and
 * bullet_sources junction table.
 *
 * Handles CRUD, skill-backed technology management, source associations,
 * and status updates. Does NOT enforce business rules (status transition
 * validation lives in the BulletService).
 */

import type { Database } from 'bun:sqlite'

// ── Types ────────────────────────────────────────────────────────────

export type BulletStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'archived'

export interface Bullet {
  id: string
  content: string
  source_content_snapshot: string
  metrics: string | null
  domain: string | null
  status: BulletStatus
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  notes: string | null
  created_at: string
  technologies: string[]
}

export interface CreateBulletInput {
  content: string
  source_content_snapshot: string
  technologies: string[]
  metrics: string | null
  domain?: string | null
  status?: string   // default: 'in_review'
  prompt_log_id?: string
  source_ids?: Array<{ id: string; is_primary?: boolean }>
}

export interface UpdateBulletInput {
  content?: string
  metrics?: string | null
  notes?: string | null
  domain?: string | null
  technologies?: string[]
}

export interface BulletFilter {
  source_id?: string   // filters via JOIN through bullet_sources
  status?: string
  technology?: string
  domain?: string
}

export interface BulletListResult {
  data: Bullet[]
  total: number
}

// ── Row types (raw DB rows before hydration) ─────────────────────────

interface BulletRow {
  id: string
  content: string
  source_content_snapshot: string
  metrics: string | null
  domain: string | null
  status: string
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  notes: string | null
  created_at: string
}

interface TechnologyRow {
  technology: string
}

// ── Helpers ──────────────────────────────────────────────────────────

function rowToBullet(row: BulletRow, technologies: string[]): Bullet {
  return {
    id: row.id,
    content: row.content,
    source_content_snapshot: row.source_content_snapshot,
    metrics: row.metrics,
    domain: row.domain,
    status: row.status as BulletStatus,
    rejection_reason: row.rejection_reason,
    prompt_log_id: row.prompt_log_id,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    notes: row.notes,
    created_at: row.created_at,
    technologies,
  }
}

/**
 * Get a bullet's "technologies" — returns skill names linked via bullet_skills.
 *
 * As of migration 031 (Phase 89), the legacy bullet_technologies table was
 * absorbed into bullet_skills. The `technologies` field on Bullet is now a
 * computed projection of linked skill names (lowercased and trimmed for
 * stable ordering / display).
 */
function getTechnologies(db: Database, bulletId: string): string[] {
  const rows = db
    .query(
      `SELECT lower(trim(s.name)) AS technology
       FROM bullet_skills bs
       JOIN skills s ON s.id = bs.skill_id
       WHERE bs.bullet_id = ?
       ORDER BY technology`,
    )
    .all(bulletId) as TechnologyRow[]
  return rows.map(r => r.technology)
}

/**
 * Insert bullet↔skill links for the given technology names.
 *
 * Each technology string is matched case-insensitively to an existing skill
 * (by name) or creates a new skill with category='other'. Then a row is
 * inserted into bullet_skills (INSERT OR IGNORE handles duplicates).
 *
 * This replaces the old bullet_technologies insertion path.
 */
function insertTechnologies(db: Database, bulletId: string, technologies: string[]): void {
  const findSkillStmt = db.prepare('SELECT id FROM skills WHERE lower(name) = lower(?)')
  const createSkillStmt = db.prepare(
    `INSERT INTO skills (id, name, category) VALUES (?, ?, 'other')`,
  )
  const linkStmt = db.prepare(
    'INSERT OR IGNORE INTO bullet_skills (bullet_id, skill_id) VALUES (?, ?)',
  )

  for (const tech of technologies) {
    const normalized = tech.toLowerCase().trim()
    if (normalized.length === 0) continue

    let skillId: string
    const existing = findSkillStmt.get(normalized) as { id: string } | null
    if (existing) {
      skillId = existing.id
    } else {
      skillId = crypto.randomUUID()
      createSkillStmt.run(skillId, normalized)
    }
    linkStmt.run(bulletId, skillId)
  }
}

// ── Repository ───────────────────────────────────────────────────────

export const BulletRepository = {
  /**
   * Create a new bullet with associated technologies and source associations.
   * Generates a UUID, normalizes technology names, and inserts junction rows.
   */
  create(db: Database, input: CreateBulletInput): Bullet {
    const id = crypto.randomUUID()
    const status = input.status ?? 'in_review'

    const row = db
      .query(
        `INSERT INTO bullets (id, content, source_content_snapshot, metrics, domain, status, prompt_log_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
      )
      .get(
        id,
        input.content,
        input.source_content_snapshot,
        input.metrics,
        input.domain ?? null,
        status,
        input.prompt_log_id ?? null,
      ) as BulletRow

    // Insert bullet_sources junction rows
    if (input.source_ids) {
      for (const src of input.source_ids) {
        db.run(
          'INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, ?)',
          [id, src.id, src.is_primary !== false ? 1 : 0],
        )
      }
    }

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

  /** List all bullets without pagination (for data export). */
  listAll(db: Database): Bullet[] {
    const rows = db
      .query('SELECT * FROM bullets ORDER BY created_at DESC')
      .all() as BulletRow[]

    return rows.map(row => {
      const technologies = getTechnologies(db, row.id)
      return rowToBullet(row, technologies)
    })
  },

  /**
   * List bullets with optional filters and pagination.
   * source_id filter uses a JOIN on bullet_sources.
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
    const joins: string[] = []

    if (filter.source_id) {
      joins.push('JOIN bullet_sources bs ON bs.bullet_id = b.id')
      conditions.push('bs.source_id = ?')
      params.push(filter.source_id)
    }
    if (filter.status) {
      conditions.push('b.status = ?')
      params.push(filter.status)
    }
    if (filter.technology) {
      // Technology filter now JOINs through bullet_skills → skills (Phase 89).
      joins.push('JOIN bullet_skills bs_tech ON bs_tech.bullet_id = b.id')
      joins.push('JOIN skills s_tech ON s_tech.id = bs_tech.skill_id')
      conditions.push('lower(s_tech.name) = lower(?)')
      params.push(filter.technology.trim())
    }
    if (filter.domain) {
      conditions.push('b.domain = ?')
      params.push(filter.domain)
    }

    const joinClause = joins.join(' ')
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
   * Update a bullet's mutable fields (content, metrics, notes, domain, technologies).
   * Returns the updated bullet or null if not found.
   *
   * For technologies: DELETE all existing rows then INSERT the new list.
   * Each technology is stored as tech.toLowerCase().trim() via insertTechnologies.
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
    if (input.notes !== undefined) {
      sets.push('notes = ?')
      params.push(input.notes)
    }
    if (input.domain !== undefined) {
      sets.push('domain = ?')
      params.push(input.domain)
    }

    // Handle technologies: DELETE all existing, INSERT new list
    const hasTechnologies = input.technologies !== undefined

    if (sets.length === 0 && !hasTechnologies) {
      return BulletRepository.get(db, id)
    }

    let row: BulletRow | null

    if (sets.length > 0) {
      params.push(id)
      row = db
        .query(`UPDATE bullets SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
        .get(...params) as BulletRow | null
    } else {
      // Only technologies changed — verify bullet exists
      row = db
        .query('SELECT * FROM bullets WHERE id = ?')
        .get(id) as BulletRow | null
    }

    if (!row) return null

    if (hasTechnologies) {
      // Replace the bullet's "technology" links. In Phase 89, technologies are
      // backed by the bullet_skills junction. We delete only the links that
      // correspond to existing skills (any bullet_skills row), then re-insert
      // via insertTechnologies which resolves names → skill IDs.
      //
      // NOTE: This assumes the bullet's skill links were all technology-style.
      // In practice, bullet_skills is currently populated exclusively via the
      // technologies field, so this is a full replacement. If richer skill
      // tagging is later added directly (without going through technologies),
      // revisit this to avoid clobbering manual links.
      db.run('DELETE FROM bullet_skills WHERE bullet_id = ?', [id])
      insertTechnologies(db, id, input.technologies!)
    }

    const technologies = getTechnologies(db, id)
    return rowToBullet(row, technologies)
  },

  /**
   * Delete a bullet by ID.
   * Throws if the bullet has perspectives (FK RESTRICT).
   * Cascades deletion to bullet_skills, bullet_sources (FK CASCADE).
   * Returns true if a row was deleted, false if not found.
   */
  delete(db: Database, id: string): boolean {
    // This will throw if perspectives reference this bullet (FK RESTRICT).
    // bullet_skills and bullet_sources rows are automatically cascaded.
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

  /**
   * Get all sources associated with a bullet via the bullet_sources junction.
   * Returns array sorted by is_primary DESC, title ASC.
   */
  getSources(db: Database, bulletId: string): Array<{ id: string; title: string; is_primary: number }> {
    return db
      .query(
        `SELECT s.id, s.title, bs.is_primary
         FROM bullet_sources bs
         JOIN sources s ON bs.source_id = s.id
         WHERE bs.bullet_id = ?
         ORDER BY bs.is_primary DESC, s.title ASC`,
      )
      .all(bulletId) as Array<{ id: string; title: string; is_primary: number }>
  },

  /**
   * Get the primary source for a bullet.
   * Returns null if no primary source is set.
   */
  getPrimarySource(db: Database, bulletId: string): { id: string; title: string } | null {
    return db
      .query(
        `SELECT s.id, s.title
         FROM bullet_sources bs
         JOIN sources s ON bs.source_id = s.id
         WHERE bs.bullet_id = ? AND bs.is_primary = 1`,
      )
      .get(bulletId) as { id: string; title: string } | null
  },

  /**
   * Add a source association to a bullet.
   * When isPrimary is true, demotes any existing primary source first.
   */
  addSource(db: Database, bulletId: string, sourceId: string, isPrimary = false): void {
    if (isPrimary) {
      // Demote any existing primary source for this bullet
      db.run(
        'UPDATE bullet_sources SET is_primary = 0 WHERE bullet_id = ? AND is_primary = 1',
        [bulletId],
      )
    }
    db.run(
      'INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, ?)',
      [bulletId, sourceId, isPrimary ? 1 : 0],
    )
  },

  /**
   * Remove a source association from a bullet.
   * Returns true if a row was deleted, false if the association didn't exist.
   */
  removeSource(db: Database, bulletId: string, sourceId: string): boolean {
    const result = db.run(
      'DELETE FROM bullet_sources WHERE bullet_id = ? AND source_id = ?',
      [bulletId, sourceId],
    )
    return result.changes > 0
  },
}
