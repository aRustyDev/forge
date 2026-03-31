/**
 * ProfileRepository — data access for the user_profile table.
 *
 * Single-row table: get() returns the one profile, update() patches it.
 *
 * The user_profile table is expected to contain exactly one row. This is
 * enforced at the application level (not the DB level) via the migration
 * seeding logic.
 */

import type { Database } from 'bun:sqlite'
import type { UserProfile, UpdateProfile } from '../../types'

/** Get the single user profile row. Returns null only if migration hasn't run. */
export function get(db: Database): UserProfile | null {
  return db.query('SELECT * FROM user_profile LIMIT 1').get() as UserProfile | null
}

const ALLOWED_FIELDS = ['name', 'email', 'phone', 'location', 'linkedin', 'github', 'website', 'clearance']

/** Patch the profile. Only provided fields are updated. Returns updated profile or null if not found. */
export function update(db: Database, patch: UpdateProfile): UserProfile | null {
  const profile = get(db)
  if (!profile) return null

  const fields: string[] = []
  const values: unknown[] = []

  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED_FIELDS.includes(key)) continue
    fields.push(`${key} = ?`)
    values.push(value)
  }

  if (fields.length === 0) return profile

  fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
  values.push(profile.id)

  db.run(`UPDATE user_profile SET ${fields.join(', ')} WHERE id = ?`, values)
  return get(db)
}
