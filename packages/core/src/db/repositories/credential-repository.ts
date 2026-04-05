/**
 * CredentialRepository — pure data access for the `credentials` table.
 *
 * As of migration 037 (Phase 84), credentials are the canonical storage
 * for clearances, driver's licenses, bar admissions, and medical licenses.
 * The polymorphic `details` column holds a JSON blob with type-specific
 * structured fields.
 *
 * This repository is stateless: all functions take a `Database` as the
 * first parameter. Business validation (type-specific required fields,
 * organization FK checks) lives in credential-service.ts.
 */

import type { Database } from 'bun:sqlite'
import type {
  Credential,
  CreateCredential,
  UpdateCredential,
  CredentialType,
  CredentialStatus,
  CredentialDetails,
} from '../../types'

// ---------------------------------------------------------------------------
// Row + serialization
// ---------------------------------------------------------------------------

interface CredentialRow {
  id: string
  credential_type: CredentialType
  label: string
  status: CredentialStatus
  organization_id: string | null
  details: string // JSON-encoded
  issued_date: string | null
  expiry_date: string | null
  created_at: string
  updated_at: string
}

/** Map a DB row to a Credential entity, parsing the JSON details column. */
function rowToCredential(row: CredentialRow): Credential {
  let parsedDetails: CredentialDetails
  try {
    parsedDetails = JSON.parse(row.details) as CredentialDetails
  } catch {
    // Defensive: if details is malformed we surface an empty-ish shape so
    // downstream code doesn't crash. In practice this can only happen if
    // something writes invalid JSON directly to the column outside this
    // repository, which the service layer's validation prevents.
    parsedDetails = {} as CredentialDetails
  }

  return {
    id: row.id,
    credential_type: row.credential_type,
    label: row.label,
    status: row.status,
    organization_id: row.organization_id,
    details: parsedDetails,
    issued_date: row.issued_date,
    expiry_date: row.expiry_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/** Insert a new credential. The details object is JSON-encoded before insert. */
export function create(db: Database, input: CreateCredential): Credential {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO credentials
         (id, credential_type, label, status, organization_id, details, issued_date, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      id,
      input.credential_type,
      input.label,
      input.status ?? 'active',
      input.organization_id ?? null,
      JSON.stringify(input.details),
      input.issued_date ?? null,
      input.expiry_date ?? null,
    ) as CredentialRow

  return rowToCredential(row)
}

/** Retrieve a credential by ID, or null if not found. */
export function findById(db: Database, id: string): Credential | null {
  const row = db
    .query('SELECT * FROM credentials WHERE id = ?')
    .get(id) as CredentialRow | null
  return row ? rowToCredential(row) : null
}

/**
 * List all credentials, ordered by (credential_type, label).
 * Grouping by type gives the UI a stable "Clearances / Licenses" section
 * ordering, and alphabetical label order within each type.
 */
export function findAll(db: Database): Credential[] {
  const rows = db
    .query(
      `SELECT * FROM credentials
       ORDER BY credential_type ASC, label ASC`,
    )
    .all() as CredentialRow[]
  return rows.map(rowToCredential)
}

/** List credentials of a specific type (e.g., all clearances). */
export function findByType(db: Database, type: CredentialType): Credential[] {
  const rows = db
    .query(
      `SELECT * FROM credentials
       WHERE credential_type = ?
       ORDER BY label ASC`,
    )
    .all(type) as CredentialRow[]
  return rows.map(rowToCredential)
}

/**
 * Partially update a credential.
 *
 * `details` is merged with the existing JSON (read-modify-write) so callers
 * can update a single field without clobbering the rest. Top-level columns
 * (label, status, organization_id, dates) use straight SET.
 *
 * Always refreshes `updated_at`. Returns null if the credential does not
 * exist.
 */
export function update(
  db: Database,
  id: string,
  input: UpdateCredential,
): Credential | null {
  const existing = findById(db, id)
  if (!existing) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (input.label !== undefined) {
    sets.push('label = ?')
    params.push(input.label)
  }
  if (input.status !== undefined) {
    sets.push('status = ?')
    params.push(input.status)
  }
  if (input.organization_id !== undefined) {
    sets.push('organization_id = ?')
    params.push(input.organization_id)
  }
  if (input.issued_date !== undefined) {
    sets.push('issued_date = ?')
    params.push(input.issued_date)
  }
  if (input.expiry_date !== undefined) {
    sets.push('expiry_date = ?')
    params.push(input.expiry_date)
  }
  if (input.details !== undefined) {
    // Merge partial details with the existing JSON so callers can update a
    // single field (e.g., just change polygraph) without having to resend
    // the whole details object.
    const merged = { ...(existing.details as object), ...(input.details as object) }
    sets.push('details = ?')
    params.push(JSON.stringify(merged))
  }

  // Always refresh updated_at
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")

  params.push(id)
  const row = db
    .query(`UPDATE credentials SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .get(...params) as CredentialRow | null

  return row ? rowToCredential(row) : null
}

/** Delete a credential. Returns true if a row was deleted. */
export function del(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM credentials WHERE id = ?', [id])
  return result.changes > 0
}
