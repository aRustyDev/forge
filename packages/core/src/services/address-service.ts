/**
 * AddressService — CRUD for shared address entities.
 *
 * Addresses are referenced by user_profile (and future org campuses).
 * Delete is blocked when an address is referenced by any FK.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { Address, CreateAddress, UpdateAddress, Result, PaginatedResult } from '../types'

export class AddressService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateAddress): Promise<Result<Address>> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Address name must not be empty' } }
    }

    const createResult = await this.elm.create('addresses', {
      ...input,
      country_code: input.country_code ?? 'US',
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    const fetched = await this.elm.get('addresses', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as Address }
  }

  async get(id: string): Promise<Result<Address>> {
    const result = await this.elm.get('addresses', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: result.value as unknown as Address }
  }

  async list(offset?: number, limit?: number): Promise<PaginatedResult<Address>> {
    const listResult = await this.elm.list('addresses', {
      offset,
      limit,
      orderBy: [{ field: 'name', direction: 'asc' }],
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }

    return {
      ok: true,
      data: listResult.value.rows as unknown as Address[],
      pagination: { total: listResult.value.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
  }

  async update(id: string, input: UpdateAddress): Promise<Result<Address>> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Address name must not be empty' } }
    }

    const updateResult = await this.elm.update('addresses', id, { ...input })
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }

    const fetched = await this.elm.get('addresses', id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as Address }
  }

  async delete(id: string): Promise<Result<void>> {
    // Check for FK references from user_profile
    const profileCount = await this.elm.count('user_profile', { address_id: id })
    if (profileCount.ok && profileCount.value > 0) {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: 'Cannot delete address: referenced by user profile' },
      }
    }

    const delResult = await this.elm.delete('addresses', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }
}
