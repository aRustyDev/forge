/**
 * DomainService — business logic for domain entities.
 *
 * Phase 1.1: uses EntityLifecycleManager instead of DomainRepository.
 *
 * Validates input, enforces delete-protection when referenced by
 * perspectives or archetype_domains. The integrity layer handles
 * uniqueness and basic type checks; this service keeps the regex
 * format check for domain slugs and the perspective/archetype delete
 * pre-check (perspectives.domain is a text field, not an FK, so the
 * integrity layer cannot enforce it).
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { Domain, Result, PaginatedResult, CreateDomainInput, DomainWithUsage } from '../types'

export class DomainService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateDomainInput): Promise<Result<Domain>> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    // Validate name format: lowercase, underscores, no spaces
    if (!/^[a-z][a-z0-9_]*$/.test(input.name)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Domain name must be lowercase, start with a letter, and contain only letters, digits, and underscores',
        },
      }
    }

    const createResult = await this.elm.create('domains', { ...input })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    const fetched = await this.elm.get('domains', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as Domain }
  }

  async get(id: string): Promise<Result<Domain>> {
    const result = await this.elm.get('domains', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: result.value as unknown as Domain }
  }

  async list(offset?: number, limit?: number): Promise<PaginatedResult<DomainWithUsage>> {
    const listResult = await this.elm.list('domains', {
      offset,
      limit,
      orderBy: [{ field: 'name', direction: 'asc' }],
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }

    // Enrich each row with perspective_count + archetype_count. The old
    // repository did this with a single SQL JOIN; here we trade per-row
    // COUNT queries for backend independence. Domain lists are tiny
    // (< 50 rows), so the extra round-trips are acceptable. If this ever
    // becomes a hot path, add a named query.
    const enriched: DomainWithUsage[] = []
    for (const row of listResult.value.rows) {
      const d = row as unknown as Domain
      const perspCount = await this.elm.count('perspectives', { domain: d.name })
      const archCount = await this.elm.count('archetype_domains', { domain_id: d.id })
      enriched.push({
        ...d,
        perspective_count: perspCount.ok ? perspCount.value : 0,
        archetype_count: archCount.ok ? archCount.value : 0,
      })
    }

    return {
      ok: true,
      data: enriched,
      pagination: { total: listResult.value.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
  }

  async update(id: string, input: Partial<CreateDomainInput>): Promise<Result<Domain>> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (input.name !== undefined && !/^[a-z][a-z0-9_]*$/.test(input.name)) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Domain name must be lowercase with underscores only' },
      }
    }

    const updateResult = await this.elm.update('domains', id, { ...input })
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }

    const fetched = await this.elm.get('domains', id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as Domain }
  }

  async delete(id: string): Promise<Result<void>> {
    // Fetch to get the domain's name (needed for the perspective check)
    // and to surface NOT_FOUND if the id is unknown.
    const domainResult = await this.elm.get('domains', id)
    if (!domainResult.ok) {
      return { ok: false, error: storageErrorToForgeError(domainResult.error) }
    }
    const domain = domainResult.value as unknown as Domain

    // Perspectives reference domains by name (text column), so the
    // integrity layer cannot enforce this. Keep the manual check.
    const perspCount = await this.elm.count('perspectives', { domain: domain.name })
    if (perspCount.ok && perspCount.value > 0) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `Cannot delete domain '${domain.name}': referenced by ${perspCount.value} perspective(s)`,
        },
      }
    }

    // The entity map declares `archetype_domains` as a CASCADE child of
    // `domains`, so an unguarded delete would silently tear down the
    // junction rows. We intentionally keep the pre-check to preserve the
    // long-standing "block delete when archetypes reference this domain"
    // semantics. skill_domains is also a cascade child but is not checked
    // here — the historical service did not check it either.
    const archCount = await this.elm.count('archetype_domains', { domain_id: id })
    if (archCount.ok && archCount.value > 0) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `Cannot delete domain '${domain.name}': associated with ${archCount.value} archetype(s)`,
        },
      }
    }

    const delResult = await this.elm.delete('domains', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }
}
