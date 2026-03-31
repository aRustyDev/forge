/**
 * ProfileService — business logic for user profile management.
 *
 * Validates input, delegates to ProfileRepository, returns Result<T>.
 */

import type { Database } from 'bun:sqlite'
import type { UserProfile, UpdateProfile, Result } from '../types'
import * as ProfileRepository from '../db/repositories/profile-repository'

export class ProfileService {
  constructor(private db: Database) {}

  /** Get the single user profile. Returns NOT_FOUND if missing. */
  getProfile(): Result<UserProfile> {
    const profile = ProfileRepository.get(this.db)
    if (!profile) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }
    }
    return { ok: true, data: profile }
  }

  /**
   * Update the user profile with a partial patch.
   * Validates that name is not empty or null.
   * All other fields accept any string value including null (clearing a field).
   */
  updateProfile(patch: UpdateProfile): Result<UserProfile> {
    if (patch.name === null) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name cannot be null' },
      }
    }
    if (patch.name !== undefined && patch.name.trim() === '') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' },
      }
    }
    const updated = ProfileRepository.update(this.db, patch)
    if (!updated) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }
    }
    return { ok: true, data: updated }
  }
}
