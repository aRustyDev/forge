/**
 * OrganizationRepository — CRUD operations for the organizations table.
 *
 * All functions take a `Database` instance as the first parameter,
 * keeping the repository stateless and testable.
 */

import type { Database } from 'bun:sqlite'
import type { Organization, OrganizationStatus, OrgTag } from '../../types'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateOrganizationInput {
  name: string
  org_type?: string
  tags?: string[]
  industry?: string
  size?: string
  worked?: number
  employment_type?: string
  website?: string
  linkedin_url?: string
  glassdoor_url?: string
  glassdoor_rating?: number
  reputation_notes?: string
  notes?: string
  status?: OrganizationStatus | null
}

// NOTE: org_type is the "primary classification" (company, education, etc.).
// Tags (via org_tags junction table) are supplementary labels (vendor, platform, etc.).
// org_type seeds the initial tag set on create: tags default to [org_type].
// The two are intentionally not 1:1 (org_type='education' maps to tag='university').
// See spec: 2026-04-03-org-model-evolution.md, Part B item 6.

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface OrganizationFilter {
  org_type?: string
  tag?: string
  worked?: number
  search?: string
  status?: string
}

// ---------------------------------------------------------------------------
// Tag helpers
// ---------------------------------------------------------------------------

/** Read tags for a single organization. */
function getTagsForOrg(db: Database, orgId: string): OrgTag[] {
  const rows = db.query('SELECT tag FROM org_tags WHERE organization_id = ? ORDER BY tag')
    .all(orgId) as { tag: string }[]
  return rows.map(r => r.tag as OrgTag)
}

/** Replace all tags for an organization. */
function setTags(db: Database, orgId: string, tags: string[]): void {
  db.run('DELETE FROM org_tags WHERE organization_id = ?', [orgId])
  for (const tag of tags) {
    db.run('INSERT OR IGNORE INTO org_tags (organization_id, tag) VALUES (?, ?)', [orgId, tag])
  }
}

/** Attach tags to an organization row. */
function withTags(db: Database, org: Organization): Organization {
  return { ...org, tags: getTagsForOrg(db, org.id) }
}

/** Attach tags to a list of organization rows. */
function withTagsBatch(db: Database, orgs: Organization[]): Organization[] {
  if (orgs.length === 0) return orgs
  // Batch-load all tags for the given org IDs
  const ids = orgs.map(o => o.id)
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.query(`SELECT organization_id, tag FROM org_tags WHERE organization_id IN (${placeholders}) ORDER BY tag`)
    .all(...ids) as { organization_id: string; tag: string }[]
  const tagMap = new Map<string, OrgTag[]>()
  for (const row of rows) {
    if (!tagMap.has(row.organization_id)) tagMap.set(row.organization_id, [])
    tagMap.get(row.organization_id)!.push(row.tag as OrgTag)
  }
  return orgs.map(o => ({ ...o, tags: tagMap.get(o.id) ?? [] }))
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/** Insert a new organization and return the created row with tags. */
export function create(db: Database, input: CreateOrganizationInput): Organization {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO organizations (id, name, org_type, industry, size, worked, employment_type, website, linkedin_url, glassdoor_url, glassdoor_rating, reputation_notes, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      id,
      input.name,
      input.org_type ?? 'company',
      input.industry ?? null,
      input.size ?? null,
      input.worked ?? 0,
      input.employment_type ?? null,
      input.website ?? null,
      input.linkedin_url ?? null,
      input.glassdoor_url ?? null,
      input.glassdoor_rating ?? null,
      input.reputation_notes ?? null,
      input.notes ?? null,
      input.status ?? null,
    ) as Organization

  // Set tags: default to [org_type] if no tags provided
  const tags = input.tags ?? [input.org_type ?? 'company']
  setTags(db, id, tags)

  return { ...row, tags: tags as OrgTag[] }
}

/** Retrieve an organization by ID with tags, or null if not found. */
export function get(db: Database, id: string): Organization | null {
  const row = db.query('SELECT * FROM organizations WHERE id = ?').get(id) as Organization | null
  if (!row) return null
  return withTags(db, row)
}

/**
 * List organizations with optional filters: org_type, worked, and name search.
 * Returns data array and total count (before pagination).
 */
export function list(
  db: Database,
  filter?: OrganizationFilter,
  offset = 0,
  limit = 50,
): { data: Organization[]; total: number } {
  const conditions: string[] = []
  const params: unknown[] = []

  let joins = ''

  if (filter?.org_type !== undefined) {
    conditions.push('o.org_type = ?')
    params.push(filter.org_type)
  }
  if (filter?.tag !== undefined) {
    joins = 'JOIN org_tags ot ON ot.organization_id = o.id'
    conditions.push('ot.tag = ?')
    params.push(filter.tag)
  }
  if (filter?.worked !== undefined) {
    conditions.push('o.worked = ?')
    params.push(filter.worked)
  }
  if (filter?.status !== undefined) {
    conditions.push('o.status = ?')
    params.push(filter.status)
  }
  if (filter?.search !== undefined) {
    conditions.push('(o.name LIKE ? OR o.id IN (SELECT organization_id FROM org_aliases WHERE alias LIKE ?))')
    params.push(`%${filter.search}%`, `%${filter.search}%`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = db
    .query(`SELECT COUNT(DISTINCT o.id) AS total FROM organizations o ${joins} ${where}`)
    .get(...params) as { total: number }

  const dataParams = [...params, limit, offset]
  const rows = db
    .query(`SELECT DISTINCT o.* FROM organizations o ${joins} ${where} ORDER BY o.name ASC LIMIT ? OFFSET ?`)
    .all(...dataParams) as Organization[]

  return { data: withTagsBatch(db, rows), total: countRow.total }
}

/** List all organizations without pagination (for data export). */
export function listAll(db: Database): Organization[] {
  const rows = db
    .query('SELECT * FROM organizations ORDER BY name ASC')
    .all() as Organization[]
  return withTagsBatch(db, rows)
}

/**
 * Partially update an organization.
 * Only the fields present in `input` are changed. `updated_at` is
 * always refreshed. Returns null if the organization does not exist.
 */
export function update(
  db: Database,
  id: string,
  input: Partial<CreateOrganizationInput>,
): Organization | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name) }
  if (input.org_type !== undefined) { sets.push('org_type = ?'); params.push(input.org_type) }
  if (input.industry !== undefined) { sets.push('industry = ?'); params.push(input.industry) }
  if (input.size !== undefined) { sets.push('size = ?'); params.push(input.size) }
  if (input.worked !== undefined) { sets.push('worked = ?'); params.push(input.worked) }
  if (input.employment_type !== undefined) { sets.push('employment_type = ?'); params.push(input.employment_type) }
  if (input.website !== undefined) { sets.push('website = ?'); params.push(input.website) }
  if (input.linkedin_url !== undefined) { sets.push('linkedin_url = ?'); params.push(input.linkedin_url) }
  if (input.glassdoor_url !== undefined) { sets.push('glassdoor_url = ?'); params.push(input.glassdoor_url) }
  if (input.glassdoor_rating !== undefined) { sets.push('glassdoor_rating = ?'); params.push(input.glassdoor_rating) }
  if (input.reputation_notes !== undefined) { sets.push('reputation_notes = ?'); params.push(input.reputation_notes) }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes) }
  if (input.status !== undefined) { sets.push('status = ?'); params.push(input.status) }

  if (sets.length === 0) {
    // Nothing to update except updated_at
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
  } else {
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
  }

  params.push(id)

  const row = db
    .query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as Organization | null

  if (!row) return null

  // Update tags if provided
  if (input.tags !== undefined) {
    setTags(db, id, input.tags)
  }

  return withTags(db, row)
}

/** Delete an organization by ID. Returns true if a row was deleted. */
export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM organizations WHERE id = ?', [id])
  return result.changes > 0
}
