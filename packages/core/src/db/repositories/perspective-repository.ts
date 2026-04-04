/**
 * PerspectiveRepository — data access for the perspectives table.
 *
 * Provides CRUD operations, status updates, filtered listing with pagination,
 * and a 3-table JOIN query that returns the full derivation chain
 * (perspective -> bullet -> source).
 *
 * Does NOT enforce business rules (status transition validation, derivation
 * eligibility). That logic lives in the PerspectiveService (Phase 3).
 */

import { Database } from 'bun:sqlite'
import type {
  Perspective,
  PerspectiveWithChain,
  PerspectiveStatus,
  CreatePerspectiveInput,
  UpdatePerspectiveInput,
  PerspectiveFilter,
  PaginatedResult,
} from '../../types/index'

/** Row shape returned by SQLite for the perspectives table */
interface PerspectiveRow {
  id: string
  bullet_id: string
  content: string
  bullet_content_snapshot: string
  target_archetype: string | null
  domain: string | null
  framing: string
  status: string
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
}

/** Row shape returned by the multi-table JOIN in getWithChain */
interface ChainRow extends PerspectiveRow {
  b_id: string
  b_content: string
  b_source_content_snapshot: string
  b_status: string
  b_created_at: string
  s_id: string
  s_title: string
  s_description: string
  s_source_type: string
  s_status: string
  s_created_at: string
}

/** Convert a raw database row to a typed Perspective */
function rowToPerspective(row: PerspectiveRow): Perspective {
  return {
    id: row.id,
    bullet_id: row.bullet_id,
    content: row.content,
    bullet_content_snapshot: row.bullet_content_snapshot,
    target_archetype: row.target_archetype,
    domain: row.domain,
    framing: row.framing as Perspective['framing'],
    status: row.status as Perspective['status'],
    rejection_reason: row.rejection_reason,
    prompt_log_id: row.prompt_log_id,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    created_at: row.created_at,
  }
}

/** Convert a chain JOIN row to a PerspectiveWithChain */
function chainRowToResult(row: ChainRow): PerspectiveWithChain {
  return {
    id: row.id,
    bullet_id: row.bullet_id,
    content: row.content,
    bullet_content_snapshot: row.bullet_content_snapshot,
    target_archetype: row.target_archetype,
    domain: row.domain,
    framing: row.framing as PerspectiveWithChain['framing'],
    status: row.status as PerspectiveWithChain['status'],
    rejection_reason: row.rejection_reason,
    prompt_log_id: row.prompt_log_id,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    created_at: row.created_at,
    bullet: {
      id: row.b_id,
      content: row.b_content,
      source_content_snapshot: row.b_source_content_snapshot,
      status: row.b_status as PerspectiveWithChain['bullet']['status'],
      created_at: row.b_created_at,
    } as PerspectiveWithChain['bullet'],
    source: {
      id: row.s_id,
      title: row.s_title,
      description: row.s_description,
      source_type: row.s_source_type,
      status: row.s_status as PerspectiveWithChain['source']['status'],
      created_at: row.s_created_at,
    } as PerspectiveWithChain['source'],
  }
}

export const PerspectiveRepository = {
  /**
   * Create a new perspective. Generates a UUID and inserts into the
   * perspectives table with the given input fields.
   */
  create(db: Database, input: CreatePerspectiveInput): Perspective {
    const id = crypto.randomUUID()
    const status = input.status ?? 'in_review'

    const row = db.query(
      `INSERT INTO perspectives (id, bullet_id, content, bullet_content_snapshot, target_archetype, domain, framing, status, prompt_log_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    ).get(
      id,
      input.bullet_id,
      input.content,
      input.bullet_content_snapshot,
      input.target_archetype,
      input.domain,
      input.framing,
      status,
      input.prompt_log_id ?? null,
    ) as PerspectiveRow

    return rowToPerspective(row)
  },

  /**
   * Get a perspective by ID. Returns null if not found.
   */
  get(db: Database, id: string): Perspective | null {
    const row = db.query(
      'SELECT * FROM perspectives WHERE id = ?'
    ).get(id) as PerspectiveRow | null

    return row ? rowToPerspective(row) : null
  },

  /**
   * Get a perspective with its full derivation chain.
   *
   * Performs a 3-table JOIN: perspectives -> bullets -> sources.
   * Returns the perspective with nested bullet and source data,
   * including content snapshots at each level.
   */
  getWithChain(db: Database, id: string): PerspectiveWithChain | null {
    const row = db.query(
      `SELECT
         p.*,
         b.id AS b_id,
         b.content AS b_content,
         b.source_content_snapshot AS b_source_content_snapshot,
         b.status AS b_status,
         b.created_at AS b_created_at,
         s.id AS s_id,
         s.title AS s_title,
         s.description AS s_description,
         s.source_type AS s_source_type,
         s.status AS s_status,
         s.created_at AS s_created_at
       FROM perspectives p
       JOIN bullets b ON p.bullet_id = b.id
       JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
       JOIN sources s ON bs.source_id = s.id
       WHERE p.id = ?`
    ).get(id) as ChainRow | null

    return row ? chainRowToResult(row) : null
  },

  /** List all perspectives without pagination (for data export). */
  listAll(db: Database): Perspective[] {
    return (
      db
        .query('SELECT * FROM perspectives ORDER BY created_at DESC')
        .all() as PerspectiveRow[]
    ).map(rowToPerspective)
  },

  /**
   * List perspectives with optional filters and pagination.
   *
   * When `filter.source_id` is provided, a JOIN on `bullet_sources` is added
   * to find perspectives whose bullet is linked to the given source. DISTINCT
   * is used in this case to avoid duplicates when a bullet belongs to multiple
   * sources via the `bullet_sources` junction table.
   *
   * @note The SDK's PerspectiveFilter uses `archetype` while the core type and
   * route use `target_archetype`. This is a pre-existing inconsistency where
   * the SDK sends `?archetype=X` but the route reads `?target_archetype=X`,
   * meaning archetype filtering via the SDK is silently broken. This method
   * uses `target_archetype` consistently with the core type definition.
   */
  list(
    db: Database,
    filter: PerspectiveFilter = {},
    offset = 0,
    limit = 50,
  ): PaginatedResult<Perspective> {
    const conditions: string[] = []
    const params: unknown[] = []
    let joinClause = ''

    if (filter.bullet_id !== undefined) {
      conditions.push('perspectives.bullet_id = ?')
      params.push(filter.bullet_id)
    }
    if (filter.target_archetype !== undefined) {
      conditions.push('perspectives.target_archetype = ?')
      params.push(filter.target_archetype)
    }
    if (filter.domain !== undefined) {
      conditions.push('perspectives.domain = ?')
      params.push(filter.domain)
    }
    if (filter.framing !== undefined) {
      conditions.push('perspectives.framing = ?')
      params.push(filter.framing)
    }
    if (filter.status !== undefined) {
      conditions.push('perspectives.status = ?')
      params.push(filter.status)
    }
    if (filter.source_id !== undefined) {
      joinClause = 'JOIN bullet_sources bs ON bs.bullet_id = perspectives.bullet_id'
      conditions.push('bs.source_id = ?')
      params.push(filter.source_id)
    }

    const where = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : ''

    // When JOIN is active, use COUNT(DISTINCT) and SELECT DISTINCT to avoid
    // duplicates from multi-source bullets. When no JOIN, plain COUNT(*) is simpler.
    const countExpr = joinClause ? 'COUNT(DISTINCT perspectives.id)' : 'COUNT(*)'
    const selectPrefix = joinClause ? 'SELECT DISTINCT perspectives.*' : 'SELECT perspectives.*'

    const countRow = db.query(
      `SELECT ${countExpr} AS total FROM perspectives ${joinClause} ${where}`
    ).get(...params) as { total: number }

    const rows = db.query(
      `${selectPrefix} FROM perspectives ${joinClause} ${where} ORDER BY perspectives.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as PerspectiveRow[]

    return {
      data: rows.map(rowToPerspective),
      total: countRow.total,
    }
  },

  /**
   * Update a perspective's content fields. Returns the updated perspective
   * or null if not found.
   */
  update(db: Database, id: string, input: UpdatePerspectiveInput): Perspective | null {
    const sets: string[] = []
    const params: unknown[] = []

    if (input.content !== undefined) {
      sets.push('content = ?')
      params.push(input.content)
    }
    if (input.target_archetype !== undefined) {
      sets.push('target_archetype = ?')
      params.push(input.target_archetype)
    }
    if (input.domain !== undefined) {
      sets.push('domain = ?')
      params.push(input.domain)
    }
    if (input.framing !== undefined) {
      sets.push('framing = ?')
      params.push(input.framing)
    }

    if (sets.length === 0) {
      return this.get(db, id)
    }

    params.push(id)

    const row = db.query(
      `UPDATE perspectives SET ${sets.join(', ')} WHERE id = ? RETURNING *`
    ).get(...params) as PerspectiveRow | null

    return row ? rowToPerspective(row) : null
  },

  /**
   * Delete a perspective by ID. Returns true if deleted.
   *
   * Throws if the perspective is referenced by a resume entry
   * (resume_entries FK with ON DELETE RESTRICT).
   */
  delete(db: Database, id: string): boolean {
    // This will throw a SQLite FK constraint error if the perspective
    // is referenced by resume_entries (ON DELETE RESTRICT).
    const result = db.run(
      'DELETE FROM perspectives WHERE id = ?',
      [id]
    )
    return result.changes > 0
  },

  /**
   * Update the status of a perspective. Sets approved_at/approved_by when
   * transitioning to 'approved', and rejection_reason when provided.
   *
   * Does NOT validate status transitions — the PerspectiveService is
   * responsible for enforcing valid transition rules before calling this.
   */
  updateStatus(
    db: Database,
    id: string,
    status: PerspectiveStatus,
    opts?: { rejection_reason?: string },
  ): Perspective | null {
    let approved_at: string | null = null
    let approved_by: string | null = null
    const rejection_reason = opts?.rejection_reason ?? null

    if (status === 'approved') {
      approved_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
      approved_by = 'human'
    }

    const row = db.query(
      `UPDATE perspectives
       SET status = ?,
           approved_at = COALESCE(?, approved_at),
           approved_by = COALESCE(?, approved_by),
           rejection_reason = ?
       WHERE id = ?
       RETURNING *`
    ).get(
      status,
      approved_at,
      approved_by,
      rejection_reason,
      id,
    ) as PerspectiveRow | null

    return row ? rowToPerspective(row) : null
  },
}
