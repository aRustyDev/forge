/**
 * CampusRepository — CRUD for org_campuses table.
 */

import type { Database } from 'bun:sqlite'
import type { OrgCampus } from '../../types'

export interface CreateCampusInput {
  organization_id: string
  name: string
  modality?: string
  address?: string
  city?: string
  state?: string
  zipcode?: string
  country?: string
  is_headquarters?: number
}

/** Create a campus and return it. */
export function create(db: Database, input: CreateCampusInput): OrgCampus {
  const id = crypto.randomUUID()
  return db
    .query(
      `INSERT INTO org_campuses (id, organization_id, name, modality, address, city, state, zipcode, country, is_headquarters)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      id,
      input.organization_id,
      input.name,
      input.modality ?? 'in_person',
      input.address ?? null,
      input.city ?? null,
      input.state ?? null,
      input.zipcode ?? null,
      input.country ?? null,
      input.is_headquarters ?? 0,
    ) as OrgCampus
}

/** List campuses for a given organization. */
export function listByOrg(db: Database, organizationId: string): OrgCampus[] {
  return db
    .query('SELECT * FROM org_campuses WHERE organization_id = ? ORDER BY name ASC')
    .all(organizationId) as OrgCampus[]
}

/** Get a campus by ID. */
export function get(db: Database, id: string): OrgCampus | null {
  return db.query('SELECT * FROM org_campuses WHERE id = ?').get(id) as OrgCampus | null
}

export interface UpdateCampusInput {
  name?: string
  modality?: string
  address?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
  country?: string | null
  is_headquarters?: number
}

/** Partially update a campus. Returns the updated campus or null if not found. */
export function update(db: Database, id: string, input: UpdateCampusInput): OrgCampus | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name) }
  if (input.modality !== undefined) { sets.push('modality = ?'); params.push(input.modality) }
  if (input.address !== undefined) { sets.push('address = ?'); params.push(input.address) }
  if (input.city !== undefined) { sets.push('city = ?'); params.push(input.city) }
  if (input.state !== undefined) { sets.push('state = ?'); params.push(input.state) }
  if (input.zipcode !== undefined) { sets.push('zipcode = ?'); params.push(input.zipcode) }
  if (input.country !== undefined) { sets.push('country = ?'); params.push(input.country) }
  if (input.is_headquarters !== undefined) { sets.push('is_headquarters = ?'); params.push(input.is_headquarters) }

  if (sets.length === 0) return existing

  params.push(id)

  return db
    .query(`UPDATE org_campuses SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as OrgCampus
}

/** Delete a campus by ID. */
export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM org_campuses WHERE id = ?', [id])
  return result.changes > 0
}
