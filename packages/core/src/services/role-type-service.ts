/**
 * RoleTypeService — business logic for role type entities.
 *
 * Phase 1.1: uses EntityLifecycleManager instead of RoleTypeRepository.
 *
 * Validates input. Role type names are human-readable (e.g. "Individual
 * Contributor", "Tech Lead", "Architect") with no slug format constraint.
 *
 * The entity map declares a setNull rule from summaries.role_type_id →
 * role_types. Deleting a role type NULLs those FKs automatically; no
 * manual reference counting is needed.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { RoleType, Result, PaginatedResult, CreateRoleTypeInput } from '../types'

export class RoleTypeService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateRoleTypeInput): Promise<Result<RoleType>> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    const createResult = await this.elm.create('role_types', {
      ...input,
      name: input.name.trim(),
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    const fetched = await this.elm.get('role_types', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as RoleType }
  }

  async get(id: string): Promise<Result<RoleType>> {
    const result = await this.elm.get('role_types', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: result.value as unknown as RoleType }
  }

  async getByName(name: string): Promise<Result<RoleType>> {
    // The old repository matched via `lower(name) = lower(?)`, a
    // case-insensitive lookup. Re-implement as an in-memory filter over a
    // bounded list. Role type taxonomies are small (< 50 rows).
    const listResult = await this.elm.list('role_types', { limit: 1000 })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    const lower = name.toLowerCase()
    const match = listResult.value.rows.find(
      (row) => typeof row.name === 'string' && row.name.toLowerCase() === lower,
    )
    if (!match) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Role type '${name}' not found` } }
    }
    return { ok: true, data: match as unknown as RoleType }
  }

  async list(offset?: number, limit?: number): Promise<PaginatedResult<RoleType>> {
    const listResult = await this.elm.list('role_types', {
      offset,
      limit,
      orderBy: [{ field: 'name', direction: 'asc' }],
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return {
      ok: true,
      data: listResult.value.rows as unknown as RoleType[],
      pagination: { total: listResult.value.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
  }

  async update(id: string, input: Partial<CreateRoleTypeInput>): Promise<Result<RoleType>> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    const updateResult = await this.elm.update('role_types', id, {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    })
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }

    const fetched = await this.elm.get('role_types', id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as RoleType }
  }

  async delete(id: string): Promise<Result<void>> {
    // The entity map's setNull rule on summaries.role_type_id handles
    // reference cleanup automatically. The pre-migration service did
    // not enforce delete-protection here either, so behavior is preserved.
    const delResult = await this.elm.delete('role_types', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  /**
   * Find a role type by name, creating it if it doesn't exist.
   * Supports the combobox "select existing or create new" pattern.
   */
  async getOrCreate(name: string): Promise<Result<RoleType>> {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    const existing = await this.getByName(trimmed)
    if (existing.ok) return existing
    return this.create({ name: trimmed })
  }
}
