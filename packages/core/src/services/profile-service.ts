/**
 * ProfileService — business logic for user profile management.
 *
 * Phase 1.2: uses EntityLifecycleManager instead of ProfileRepository.
 *
 * The `user_profile` table is a singleton — it contains exactly one
 * row, seeded by migration. The ELM has no built-in awareness of this
 * constraint; the service layer enforces the singleton by always
 * fetching the first row before updates and by never calling
 * `elm.create('user_profile', ...)` from the service code.
 *
 * Salary-expectation ordering (minimum ≤ target ≤ stretch) is app-level
 * validation that has no entity-map equivalent and is preserved.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { Address, ProfileUrl, UserProfile, UpdateProfile, Result } from '../types'

export class ProfileService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  /** Get the single user profile. Returns NOT_FOUND if missing. */
  async getProfile(): Promise<Result<UserProfile>> {
    const profile = await this.fetchSingleton()
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
  async updateProfile(patch: UpdateProfile): Promise<Result<UserProfile>> {
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

    // Validate salary expectation ordering when multiple tiers are provided
    const salMin = patch.salary_minimum
    const salTarget = patch.salary_target
    const salStretch = patch.salary_stretch
    if (salMin != null && salTarget != null && salMin > salTarget) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'salary_minimum must not exceed salary_target',
        },
      }
    }
    if (salTarget != null && salStretch != null && salTarget > salStretch) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'salary_target must not exceed salary_stretch',
        },
      }
    }
    if (salMin != null && salStretch != null && salMin > salStretch) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'salary_minimum must not exceed salary_stretch',
        },
      }
    }

    const current = await this.fetchSingleton()
    if (!current) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }
    }

    // Build the patch from the allowed fields only. Unknown keys are
    // silently dropped, matching the old repository's ALLOWED_FIELDS
    // whitelist.
    const allowed = [
      'name',
      'email',
      'phone',
      'address_id',
      'salary_minimum',
      'salary_target',
      'salary_stretch',
    ] as const
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if ((patch as Record<string, unknown>)[key] !== undefined) {
        data[key] = (patch as Record<string, unknown>)[key]
      }
    }

    // Handle address upsert
    if (patch.address !== undefined) {
      if (current.address_id) {
        // Update existing address
        await this.elm.update('addresses', current.address_id, patch.address as Record<string, unknown>)
      } else {
        // Create new address and link it
        const addrId = crypto.randomUUID()
        const addrData = {
          ...patch.address,
          country_code: (patch.address as Record<string, unknown>).country_code ?? 'US',
        }
        await this.elm.create('addresses', { id: addrId, ...addrData })
        data.address_id = addrId
      }
    }

    // Handle URL array replace
    if (patch.urls !== undefined) {
      // Validate no duplicate keys
      const keys = patch.urls.map(u => u.key.toLowerCase())
      if (new Set(keys).size !== keys.length) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Duplicate URL keys' },
        }
      }

      // Delete existing URLs
      for (const existing of current.urls) {
        await this.elm.delete('profile_urls', existing.id)
      }

      // Insert new URLs
      for (let i = 0; i < patch.urls.length; i++) {
        const u = patch.urls[i]
        await this.elm.create('profile_urls', {
          id: crypto.randomUUID(),
          profile_id: current.id,
          key: u.key,
          url: u.url,
          position: i,
        })
      }
    }

    const updateResult = await this.elm.update('user_profile', current.id, data)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }

    const updatedProfile = await this.fetchSingleton()
    if (!updatedProfile) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Profile not found after update' } }
    }
    return { ok: true, data: updatedProfile }
  }

  // ── Internal helpers ─────────────────────────────────────────────

  /**
   * Fetch the singleton `user_profile` row via `elm.list({ limit: 1 })`.
   * Returns `null` if the row has not been seeded (migration not yet
   * applied or test DB without the seed).
   */
  private async fetchSingleton(): Promise<UserProfile | null> {
    const listResult = await this.elm.list('user_profile', { limit: 1 })
    if (!listResult.ok) return null
    const row = listResult.value.rows[0] as Record<string, unknown> | undefined
    if (!row) return null

    // Fetch address if linked
    let address: Address | null = null
    if (row.address_id) {
      const addrResult = await this.elm.get('addresses', row.address_id as string)
      if (addrResult.ok) address = addrResult.value as unknown as Address
    }

    // Fetch profile URLs ordered by position
    const urlsResult = await this.elm.list('profile_urls', {
      where: { profile_id: row.id as string },
      orderBy: [{ field: 'position', direction: 'asc' }],
    })
    const urls: ProfileUrl[] = urlsResult.ok
      ? (urlsResult.value.rows as unknown as ProfileUrl[])
      : []

    return {
      ...(row as unknown as Omit<UserProfile, 'address' | 'urls'>),
      address,
      urls,
    } as UserProfile
  }
}
