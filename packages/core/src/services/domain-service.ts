/**
 * DomainService — business logic for domain entities.
 *
 * Validates input, enforces delete-protection when referenced
 * by perspectives or archetype_domains.
 */

import type { Database } from 'bun:sqlite'
import type { Domain, Result, PaginatedResult } from '../types'
import * as DomainRepo from '../db/repositories/domain-repository'

export class DomainService {
  constructor(private db: Database) {}

  create(input: DomainRepo.CreateDomainInput): Result<Domain> {
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
    try {
      const domain = DomainRepo.create(this.db, input)
      return { ok: true, data: domain }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: `Domain '${input.name}' already exists` } }
      }
      throw err
    }
  }

  get(id: string): Result<Domain> {
    const domain = DomainRepo.get(this.db, id)
    if (!domain) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Domain ${id} not found` } }
    }
    return { ok: true, data: domain }
  }

  list(offset?: number, limit?: number): PaginatedResult<Domain> {
    const result = DomainRepo.list(this.db, offset, limit)
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
  }

  update(id: string, input: Partial<DomainRepo.CreateDomainInput>): Result<Domain> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (input.name !== undefined && !/^[a-z][a-z0-9_]*$/.test(input.name)) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Domain name must be lowercase with underscores only' },
      }
    }

    try {
      const domain = DomainRepo.update(this.db, id, input)
      if (!domain) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Domain ${id} not found` } }
      }
      return { ok: true, data: domain }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: `Domain '${input.name}' already exists` } }
      }
      throw err
    }
  }

  delete(id: string): Result<void> {
    const domain = DomainRepo.get(this.db, id)
    if (!domain) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Domain ${id} not found` } }
    }

    const refs = DomainRepo.countReferences(this.db, id)
    if (refs.perspective_count > 0) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `Cannot delete domain '${domain.name}': referenced by ${refs.perspective_count} perspective(s)`,
        },
      }
    }
    if (refs.archetype_count > 0) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `Cannot delete domain '${domain.name}': associated with ${refs.archetype_count} archetype(s)`,
        },
      }
    }

    DomainRepo.del(this.db, id)
    return { ok: true, data: undefined }
  }
}
