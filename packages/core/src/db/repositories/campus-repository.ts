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

/** Delete a campus by ID. */
export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM org_campuses WHERE id = ?', [id])
  return result.changes > 0
}
