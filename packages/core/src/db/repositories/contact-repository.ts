/**
 * ContactRepository -- CRUD operations for the contacts table and
 * relationship management for contact junction tables.
 *
 * All functions take a `Database` instance as the first parameter,
 * keeping the repository stateless and testable.
 */

import type { Database } from 'bun:sqlite'
import type {
  ContactWithOrg,
  CreateContact,
  UpdateContact,
  ContactFilter,
  ContactLink,
  ContactOrgRelationship,
  ContactJDRelationship,
  ContactResumeRelationship,
} from '../../types'

// ---------------------------------------------------------------------------
// Internal: base SELECT with organization JOIN
// ---------------------------------------------------------------------------

const SELECT_WITH_ORG = `
  SELECT c.*,
         o.name AS organization_name
  FROM contacts c
  LEFT JOIN organizations o ON o.id = c.organization_id
`

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Insert a new contact and return the created row with org name. */
export function create(
  db: Database,
  input: CreateContact,
): ContactWithOrg {
  const id = crypto.randomUUID()
  db.query(
    `INSERT INTO contacts (id, name, title, email, phone, linkedin, team, dept, notes, organization_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.name,
    input.title ?? null,
    input.email ?? null,
    input.phone ?? null,
    input.linkedin ?? null,
    input.team ?? null,
    input.dept ?? null,
    input.notes ?? null,
    input.organization_id ?? null,
  )

  return get(db, id)!
}

/** Retrieve a contact by ID with org name, or null if not found. */
export function get(
  db: Database,
  id: string,
): ContactWithOrg | null {
  return (
    (db
      .query(`${SELECT_WITH_ORG} WHERE c.id = ?`)
      .get(id) as ContactWithOrg | null) ?? null
  )
}

/**
 * List contacts with optional filters: organization_id, search.
 * Search is case-insensitive substring match on name, title, and email.
 * Results are ordered alphabetically by name.
 */
export function list(
  db: Database,
  filter?: ContactFilter,
  offset = 0,
  limit = 50,
): { data: ContactWithOrg[]; total: number } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter?.organization_id !== undefined) {
    conditions.push('c.organization_id = ?')
    params.push(filter.organization_id)
  }
  if (filter?.search !== undefined && filter.search.trim()) {
    const searchTerm = `%${filter.search.trim()}%`
    conditions.push(
      `(c.name LIKE ? COLLATE NOCASE OR c.title LIKE ? COLLATE NOCASE OR c.email LIKE ? COLLATE NOCASE)`
    )
    params.push(searchTerm, searchTerm, searchTerm)
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = db
    .query(
      `SELECT COUNT(*) AS total FROM contacts c ${where}`,
    )
    .get(...params) as { total: number }

  const dataParams = [...params, limit, offset]
  const rows = db
    .query(
      `${SELECT_WITH_ORG} ${where} ORDER BY c.name ASC LIMIT ? OFFSET ?`,
    )
    .all(...dataParams) as ContactWithOrg[]

  return { data: rows, total: countRow.total }
}

/**
 * Partially update a contact.
 * Only the fields present in `input` are changed. `updated_at` is
 * always refreshed. Returns null if the contact does not exist.
 */
export function update(
  db: Database,
  id: string,
  input: UpdateContact,
): ContactWithOrg | null {
  const existing = get(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) {
    sets.push('name = ?')
    params.push(input.name)
  }
  if (input.title !== undefined) {
    sets.push('title = ?')
    params.push(input.title)
  }
  if (input.email !== undefined) {
    sets.push('email = ?')
    params.push(input.email)
  }
  if (input.phone !== undefined) {
    sets.push('phone = ?')
    params.push(input.phone)
  }
  if (input.linkedin !== undefined) {
    sets.push('linkedin = ?')
    params.push(input.linkedin)
  }
  if (input.team !== undefined) {
    sets.push('team = ?')
    params.push(input.team)
  }
  if (input.dept !== undefined) {
    sets.push('dept = ?')
    params.push(input.dept)
  }
  if (input.notes !== undefined) {
    sets.push('notes = ?')
    params.push(input.notes)
  }
  if (input.organization_id !== undefined) {
    sets.push('organization_id = ?')
    params.push(input.organization_id)
  }

  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
  params.push(id)

  db.query(
    `UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`,
  ).run(...params)

  return get(db, id)
}

/** Delete a contact by ID. Returns true if a row was deleted. */
export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM contacts WHERE id = ?', [id])
  return result.changes > 0
}

// ---------------------------------------------------------------------------
// Organization relationships
// ---------------------------------------------------------------------------

/** Link a contact to an organization with a typed relationship. */
export function addOrganization(
  db: Database,
  contactId: string,
  orgId: string,
  relationship: ContactOrgRelationship,
): void {
  db.run(
    'INSERT OR IGNORE INTO contact_organizations (contact_id, organization_id, relationship) VALUES (?, ?, ?)',
    [contactId, orgId, relationship],
  )
}

/** Remove a specific contact-organization link by relationship. */
export function removeOrganization(
  db: Database,
  contactId: string,
  orgId: string,
  relationship: ContactOrgRelationship,
): void {
  db.run(
    'DELETE FROM contact_organizations WHERE contact_id = ? AND organization_id = ? AND relationship = ?',
    [contactId, orgId, relationship],
  )
}

/** List organizations linked to a contact, with relationship type. */
export function listOrganizations(
  db: Database,
  contactId: string,
): Array<{ id: string; name: string; relationship: ContactOrgRelationship }> {
  return db.query(
    `SELECT o.id, o.name, co.relationship
     FROM organizations o
     JOIN contact_organizations co ON co.organization_id = o.id
     WHERE co.contact_id = ?
     ORDER BY o.name ASC`
  ).all(contactId) as Array<{ id: string; name: string; relationship: ContactOrgRelationship }>
}

// ---------------------------------------------------------------------------
// Job Description relationships
// ---------------------------------------------------------------------------

/** Link a contact to a job description with a typed relationship. */
export function addJobDescription(
  db: Database,
  contactId: string,
  jdId: string,
  relationship: ContactJDRelationship,
): void {
  db.run(
    'INSERT OR IGNORE INTO contact_job_descriptions (contact_id, job_description_id, relationship) VALUES (?, ?, ?)',
    [contactId, jdId, relationship],
  )
}

/** Remove a specific contact-job description link by relationship. */
export function removeJobDescription(
  db: Database,
  contactId: string,
  jdId: string,
  relationship: ContactJDRelationship,
): void {
  db.run(
    'DELETE FROM contact_job_descriptions WHERE contact_id = ? AND job_description_id = ? AND relationship = ?',
    [contactId, jdId, relationship],
  )
}

/** List job descriptions linked to a contact, with relationship type and org name. */
export function listJobDescriptions(
  db: Database,
  contactId: string,
): Array<{ id: string; title: string; organization_name: string | null; relationship: ContactJDRelationship }> {
  return db.query(
    `SELECT jd.id, jd.title, o.name AS organization_name, cjd.relationship
     FROM job_descriptions jd
     JOIN contact_job_descriptions cjd ON cjd.job_description_id = jd.id
     LEFT JOIN organizations o ON o.id = jd.organization_id
     WHERE cjd.contact_id = ?
     ORDER BY jd.title ASC`
  ).all(contactId) as Array<{ id: string; title: string; organization_name: string | null; relationship: ContactJDRelationship }>
}

// ---------------------------------------------------------------------------
// Resume relationships
// ---------------------------------------------------------------------------

/** Link a contact to a resume with a typed relationship. */
export function addResume(
  db: Database,
  contactId: string,
  resumeId: string,
  relationship: ContactResumeRelationship,
): void {
  db.run(
    'INSERT OR IGNORE INTO contact_resumes (contact_id, resume_id, relationship) VALUES (?, ?, ?)',
    [contactId, resumeId, relationship],
  )
}

/** Remove a specific contact-resume link by relationship. */
export function removeResume(
  db: Database,
  contactId: string,
  resumeId: string,
  relationship: ContactResumeRelationship,
): void {
  db.run(
    'DELETE FROM contact_resumes WHERE contact_id = ? AND resume_id = ? AND relationship = ?',
    [contactId, resumeId, relationship],
  )
}

/** List resumes linked to a contact, with relationship type. */
export function listResumes(
  db: Database,
  contactId: string,
): Array<{ id: string; name: string; relationship: ContactResumeRelationship }> {
  return db.query(
    `SELECT r.id, r.name, cr.relationship
     FROM resumes r
     JOIN contact_resumes cr ON cr.resume_id = r.id
     WHERE cr.contact_id = ?
     ORDER BY r.name ASC`
  ).all(contactId) as Array<{ id: string; name: string; relationship: ContactResumeRelationship }>
}

// ---------------------------------------------------------------------------
// Reverse lookups (contacts linked TO an entity)
// ---------------------------------------------------------------------------

/** List contacts linked to an organization with relationship type. */
export function listByOrganization(
  db: Database,
  orgId: string,
): ContactLink[] {
  return db.query(
    `SELECT c.id AS contact_id, c.name AS contact_name, c.title AS contact_title,
            c.email AS contact_email, co.relationship
     FROM contacts c
     JOIN contact_organizations co ON co.contact_id = c.id
     WHERE co.organization_id = ?
     ORDER BY c.name ASC`
  ).all(orgId) as ContactLink[]
}

/** List contacts linked to a job description with relationship type. */
export function listByJobDescription(
  db: Database,
  jdId: string,
): ContactLink[] {
  return db.query(
    `SELECT c.id AS contact_id, c.name AS contact_name, c.title AS contact_title,
            c.email AS contact_email, cjd.relationship
     FROM contacts c
     JOIN contact_job_descriptions cjd ON cjd.contact_id = c.id
     WHERE cjd.job_description_id = ?
     ORDER BY c.name ASC`
  ).all(jdId) as ContactLink[]
}

/** List contacts linked to a resume with relationship type. */
export function listByResume(
  db: Database,
  resumeId: string,
): ContactLink[] {
  return db.query(
    `SELECT c.id AS contact_id, c.name AS contact_name, c.title AS contact_title,
            c.email AS contact_email, cr.relationship
     FROM contacts c
     JOIN contact_resumes cr ON cr.contact_id = c.id
     WHERE cr.resume_id = ?
     ORDER BY c.name ASC`
  ).all(resumeId) as ContactLink[]
}
