/**
 * SQLite implementations of named queries.
 *
 * Each function takes a raw bun:sqlite Database and the query params,
 * and returns the shape declared in ../named-queries.ts.
 *
 * These implementations are ported from the existing repository JOIN
 * patterns (see PerspectiveRepository.getWithChain,
 * BulletRepository.list, ResumeRepository.getWithEntries).
 */

import type { Database } from 'bun:sqlite'

import type {
  GetResumeWithSectionsParams,
  GetResumeWithSectionsResult,
  ListBulletsFilteredParams,
  ListBulletsFilteredResult,
  ListDriftedBulletsResult,
  ListDriftedPerspectivesResult,
  TraceChainParams,
  TraceChainResult,
} from '../named-queries'

// ─── traceChain ────────────────────────────────────────────────────────

function traceChain(
  db: Database,
  params: TraceChainParams,
): TraceChainResult | null {
  const perspective = db
    .prepare(
      `SELECT id, bullet_id, content, bullet_content_snapshot, framing, status, created_at
       FROM perspectives WHERE id = ?`,
    )
    .get(params.perspectiveId) as Record<string, unknown> | null
  if (!perspective) return null

  const bullet = db
    .prepare(
      `SELECT id, content, source_content_snapshot, status
       FROM bullets WHERE id = ?`,
    )
    .get(perspective.bullet_id as string) as Record<string, unknown> | null
  if (!bullet) return null

  const sources = db
    .prepare(
      `SELECT s.id, s.title, s.description, s.source_type, bs.is_primary
       FROM sources s
       JOIN bullet_sources bs ON bs.source_id = s.id
       WHERE bs.bullet_id = ?
       ORDER BY bs.is_primary DESC, s.title ASC`,
    )
    .all(bullet.id as string) as Array<Record<string, unknown>>

  return {
    perspective: {
      id: perspective.id as string,
      content: perspective.content as string,
      bullet_content_snapshot: perspective.bullet_content_snapshot as string,
      framing: perspective.framing as string,
      status: perspective.status as string,
      created_at: perspective.created_at as string,
    },
    bullet: {
      id: bullet.id as string,
      content: bullet.content as string,
      source_content_snapshot: bullet.source_content_snapshot as string,
      status: bullet.status as string,
    },
    sources: sources.map((s) => ({
      id: s.id as string,
      title: s.title as string,
      description: s.description as string,
      source_type: s.source_type as string,
      is_primary: s.is_primary === 1,
    })),
  }
}

// ─── listBulletsFiltered ───────────────────────────────────────────────

function listBulletsFiltered(
  db: Database,
  params: ListBulletsFilteredParams,
): ListBulletsFilteredResult {
  const joins: string[] = []
  const conditions: string[] = []
  const values: unknown[] = []

  if (params.sourceId) {
    joins.push('JOIN bullet_sources bs ON bs.bullet_id = b.id')
    conditions.push('bs.source_id = ?')
    values.push(params.sourceId)
  }
  if (params.skillId) {
    joins.push('JOIN bullet_skills bk ON bk.bullet_id = b.id')
    conditions.push('bk.skill_id = ?')
    values.push(params.skillId)
  }
  if (params.status) {
    conditions.push('b.status = ?')
    values.push(params.status)
  }
  if (params.domain) {
    conditions.push('b.domain = ?')
    values.push(params.domain)
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  const joinClause = joins.join(' ')
  const distinct = joins.length > 0 ? 'DISTINCT ' : ''

  const countSql = `SELECT COUNT(${distinct}b.id) as total FROM bullets b ${joinClause} ${whereClause}`
  const totalRow = db.prepare(countSql).get(...(values as never[])) as {
    total: number
  } | null
  const total = totalRow?.total ?? 0

  let sql = `SELECT ${distinct}b.id, b.content, b.status, b.domain, b.created_at
             FROM bullets b ${joinClause} ${whereClause}
             ORDER BY b.created_at DESC`
  const pageValues: unknown[] = []
  if (params.limit != null) {
    sql += ' LIMIT ?'
    pageValues.push(params.limit)
    if (params.offset != null) {
      sql += ' OFFSET ?'
      pageValues.push(params.offset)
    }
  }

  const rows = db
    .prepare(sql)
    .all(...(values as never[]), ...(pageValues as never[])) as Array<
      Record<string, unknown>
    >

  return {
    rows: rows.map((r) => ({
      id: r.id as string,
      content: r.content as string,
      status: r.status as string,
      domain: (r.domain as string | null) ?? null,
      created_at: r.created_at as string,
    })),
    total,
  }
}

// ─── getResumeWithSections ─────────────────────────────────────────────

function getResumeWithSections(
  db: Database,
  params: GetResumeWithSectionsParams,
): GetResumeWithSectionsResult | null {
  const resume = db
    .prepare(`SELECT * FROM resumes WHERE id = ?`)
    .get(params.resumeId) as Record<string, unknown> | null
  if (!resume) return null

  const sections = db
    .prepare(
      `SELECT id, title, entry_type, position
       FROM resume_sections WHERE resume_id = ?
       ORDER BY position ASC`,
    )
    .all(params.resumeId) as Array<Record<string, unknown>>

  const entriesStmt = db.prepare(
    `SELECT id, perspective_id, source_id, content, perspective_content_snapshot, position
     FROM resume_entries WHERE section_id = ?
     ORDER BY position ASC`,
  )

  return {
    resume,
    sections: sections.map((s) => {
      const entries = entriesStmt.all(s.id as string) as Array<
        Record<string, unknown>
      >
      return {
        id: s.id as string,
        title: s.title as string,
        entry_type: s.entry_type as string,
        position: s.position as number,
        entries: entries.map((e) => ({
          id: e.id as string,
          perspective_id: (e.perspective_id as string | null) ?? null,
          source_id: (e.source_id as string | null) ?? null,
          content: (e.content as string | null) ?? null,
          perspective_content_snapshot:
            (e.perspective_content_snapshot as string | null) ?? null,
          position: e.position as number,
        })),
      }
    }),
  }
}

// ─── listDriftedBullets ────────────────────────────────────────────────

function listDriftedBullets(
  db: Database,
  _params: Record<string, unknown>,
): ListDriftedBulletsResult {
  const rows = db
    .prepare(
      `SELECT b.id AS bullet_id, b.source_content_snapshot, s.description AS current_description
       FROM bullets b
       JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
       JOIN sources s ON bs.source_id = s.id
       WHERE b.source_content_snapshot != s.description`,
    )
    .all() as Array<{
    bullet_id: string
    source_content_snapshot: string
    current_description: string
  }>

  return { rows }
}

// ─── listDriftedPerspectives ──────────────────────────────────────────

function listDriftedPerspectives(
  db: Database,
  _params: Record<string, unknown>,
): ListDriftedPerspectivesResult {
  const rows = db
    .prepare(
      `SELECT p.id AS perspective_id, p.bullet_content_snapshot, b.content AS current_content
       FROM perspectives p
       JOIN bullets b ON p.bullet_id = b.id
       WHERE p.bullet_content_snapshot != b.content`,
    )
    .all() as Array<{
    perspective_id: string
    bullet_content_snapshot: string
    current_content: string
  }>

  return { rows }
}

// ─── Handler registry ──────────────────────────────────────────────────

/**
 * Map of named query names to SQLite implementations. Pass this to the
 * SqliteAdapter constructor.
 */
export const SQLITE_NAMED_QUERIES = {
  traceChain,
  listBulletsFiltered,
  getResumeWithSections,
  listDriftedBullets,
  listDriftedPerspectives,
} as const satisfies Record<
  string,
  (db: Database, params: Record<string, unknown>) => unknown
>
