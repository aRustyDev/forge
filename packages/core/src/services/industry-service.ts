/**
 * IndustryService — business logic for industry entities.
 *
 * Phase 1.1: uses EntityLifecycleManager instead of IndustryRepository.
 *
 * Validates input. Industry names are human-readable (e.g. "AI Safety",
 * "Defense", "FinTech") with no slug format constraint.
 *
 * The entity map declares setNull rules from organizations.industry_id
 * and summaries.industry_id → industries. Deleting an industry now
 * automatically NULLs those FKs; no manual reference counting is
 * needed. This is a deliberate BEHAVIOR CHANGE from the pre-migration
 * service, which returned CONFLICT when any organization referenced
 * the industry. The entity map is the source of truth.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { Industry, Result, PaginatedResult, CreateIndustryInput } from '../types'

export class IndustryService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateIndustryInput): Promise<Result<Industry>> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    const createResult = await this.elm.create('industries', {
      ...input,
      name: input.name.trim(),
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    const fetched = await this.elm.get('industries', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as Industry }
  }

  async get(id: string): Promise<Result<Industry>> {
    const result = await this.elm.get('industries', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: result.value as unknown as Industry }
  }

  async getByName(name: string): Promise<Result<Industry>> {
    // The old repository matched via `lower(name) = lower(?)`, a case-insensitive
    // lookup. The integrity layer has no direct equivalent, so we fetch and
    // filter in-memory. Industry tables are small (<100 rows), so the
    // round-trip cost is negligible. If this becomes a hot path, add a named
    // query.
    const listResult = await this.elm.list('industries', { limit: 1000 })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    const lower = name.toLowerCase()
    const match = listResult.value.rows.find(
      (row) => typeof row.name === 'string' && row.name.toLowerCase() === lower,
    )
    if (!match) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Industry '${name}' not found` } }
    }
    return { ok: true, data: match as unknown as Industry }
  }

  async list(offset?: number, limit?: number): Promise<PaginatedResult<Industry>> {
    const listResult = await this.elm.list('industries', {
      offset,
      limit,
      orderBy: [{ field: 'name', direction: 'asc' }],
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return {
      ok: true,
      data: listResult.value.rows as unknown as Industry[],
      pagination: { total: listResult.value.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
  }

  async update(id: string, input: Partial<CreateIndustryInput>): Promise<Result<Industry>> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    const updateResult = await this.elm.update('industries', id, {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    })
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }

    const fetched = await this.elm.get('industries', id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as Industry }
  }

  async delete(id: string): Promise<Result<void>> {
    // NOTE: The entity map declares setNull rules on organizations.industry_id
    // and summaries.industry_id, so deleting an industry NULLs those columns
    // instead of blocking. This is a deliberate departure from the
    // pre-migration service, which blocked deletion when any org referenced
    // the industry.
    const delResult = await this.elm.delete('industries', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  /**
   * Find an industry by name, creating it if it doesn't exist.
   * Supports the combobox "select existing or create new" pattern.
   */
  async getOrCreate(name: string): Promise<Result<Industry>> {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    const existing = await this.getByName(trimmed)
    if (existing.ok) return existing
    return this.create({ name: trimmed })
  }
}
