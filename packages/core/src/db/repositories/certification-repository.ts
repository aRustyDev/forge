/**
 * CertificationRepository — pure data access for the `certifications` table
 * and the `certification_skills` junction.
 *
 * Introduced by migration 037 (Phase 84, Qualifications track). A
 * certification is an earned credential that validates skills (PMP, CISSP,
 * AWS SA Pro, etc.). Unlike credentials, certifications link to skills via
 * the `certification_skills` junction — the linkage is what makes them
 * participate in JD skill matching.
 *
 * This repository is stateless: all functions take a `Database` as the
 * first parameter. Validation lives in certification-service.ts.
 */

import type { Database } from 'bun:sqlite'
import type {
  Certification,
  CertificationWithSkills,
  CreateCertification,
  UpdateCertification,
  Skill,
} from '../../types'

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface CertificationRow {
  id: string
  name: string
  issuer: string | null
  date_earned: string | null
  expiry_date: string | null
  credential_id: string | null
  credential_url: string | null
  education_source_id: string | null
  created_at: string
  updated_at: string
}

function rowToCertification(row: CertificationRow): Certification {
  return {
    id: row.id,
    name: row.name,
    issuer: row.issuer,
    date_earned: row.date_earned,
    expiry_date: row.expiry_date,
    credential_id: row.credential_id,
    credential_url: row.credential_url,
    education_source_id: row.education_source_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Basic CRUD
// ---------------------------------------------------------------------------

/** Insert a new certification. */
export function create(db: Database, input: CreateCertification): Certification {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO certifications
         (id, name, issuer, date_earned, expiry_date, credential_id, credential_url, education_source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      id,
      input.name,
      input.issuer ?? null,
      input.date_earned ?? null,
      input.expiry_date ?? null,
      input.credential_id ?? null,
      input.credential_url ?? null,
      input.education_source_id ?? null,
    ) as CertificationRow

  return rowToCertification(row)
}

/** Retrieve a certification by ID, or null if not found. */
export function findById(db: Database, id: string): Certification | null {
  const row = db
    .query('SELECT * FROM certifications WHERE id = ?')
    .get(id) as CertificationRow | null
  return row ? rowToCertification(row) : null
}

/** List all certifications ordered by name. */
export function findAll(db: Database): Certification[] {
  const rows = db
    .query('SELECT * FROM certifications ORDER BY name ASC')
    .all() as CertificationRow[]
  return rows.map(rowToCertification)
}

/**
 * Partially update a certification. Always refreshes `updated_at`.
 * Returns null if the certification does not exist.
 */
export function update(
  db: Database,
  id: string,
  input: UpdateCertification,
): Certification | null {
  const existing = findById(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name) }
  if (input.issuer !== undefined) { sets.push('issuer = ?'); params.push(input.issuer) }
  if (input.date_earned !== undefined) { sets.push('date_earned = ?'); params.push(input.date_earned) }
  if (input.expiry_date !== undefined) { sets.push('expiry_date = ?'); params.push(input.expiry_date) }
  if (input.credential_id !== undefined) { sets.push('credential_id = ?'); params.push(input.credential_id) }
  if (input.credential_url !== undefined) { sets.push('credential_url = ?'); params.push(input.credential_url) }
  if (input.education_source_id !== undefined) {
    sets.push('education_source_id = ?')
    params.push(input.education_source_id)
  }

  // Always refresh updated_at
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")

  params.push(id)
  const row = db
    .query(`UPDATE certifications SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as CertificationRow | null

  return row ? rowToCertification(row) : null
}

/** Delete a certification. Cascades to certification_skills via FK. */
export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM certifications WHERE id = ?', [id])
  return result.changes > 0
}

// ---------------------------------------------------------------------------
// Skill junction management
// ---------------------------------------------------------------------------

/**
 * Link a skill to a certification. Idempotent — re-linking the same pair
 * is a no-op (INSERT OR IGNORE).
 */
export function addSkill(db: Database, certId: string, skillId: string): void {
  db.run(
    'INSERT OR IGNORE INTO certification_skills (certification_id, skill_id) VALUES (?, ?)',
    [certId, skillId],
  )
}

/**
 * Unlink a skill from a certification. Idempotent — removing a
 * non-existent link is a no-op.
 */
export function removeSkill(db: Database, certId: string, skillId: string): void {
  db.run(
    'DELETE FROM certification_skills WHERE certification_id = ? AND skill_id = ?',
    [certId, skillId],
  )
}

/** Get all skills linked to a certification, ordered by name. */
export function getSkills(db: Database, certId: string): Skill[] {
  return db
    .query(
      `SELECT s.*
       FROM skills s
       JOIN certification_skills cs ON cs.skill_id = s.id
       WHERE cs.certification_id = ?
       ORDER BY s.name ASC`,
    )
    .all(certId) as Skill[]
}

// ---------------------------------------------------------------------------
// "With skills" variants (hydrated)
// ---------------------------------------------------------------------------

/** Retrieve a certification with its linked skills populated. */
export function findByIdWithSkills(
  db: Database,
  id: string,
): CertificationWithSkills | null {
  const cert = findById(db, id)
  if (!cert) return null
  return { ...cert, skills: getSkills(db, id) }
}

/** List all certifications with their linked skills populated. */
export function findAllWithSkills(db: Database): CertificationWithSkills[] {
  const certs = findAll(db)
  return certs.map((cert) => ({ ...cert, skills: getSkills(db, cert.id) }))
}
