/**
 * IndustryService — business logic for industry entities.
 *
 * Validates input, enforces delete-protection when referenced
 * by organizations. Unlike domains, industry names are human-readable
 * (e.g. "AI Safety", "Defense", "FinTech") with no slug format constraint.
 */

import type { Database } from 'bun:sqlite'
import type { Industry, Result, PaginatedResult } from '../types'
import * as IndustryRepo from '../db/repositories/industry-repository'

export class IndustryService {
  constructor(private db: Database) {}

  create(input: IndustryRepo.CreateIndustryInput): Result<Industry> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    try {
      const industry = IndustryRepo.create(this.db, { ...input, name: input.name.trim() })
      return { ok: true, data: industry }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: `Industry '${input.name}' already exists` } }
      }
      throw err
    }
  }

  get(id: string): Result<Industry> {
    const industry = IndustryRepo.get(this.db, id)
    if (!industry) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Industry ${id} not found` } }
    }
    return { ok: true, data: industry }
  }

  getByName(name: string): Result<Industry> {
    const industry = IndustryRepo.getByName(this.db, name)
    if (!industry) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Industry '${name}' not found` } }
    }
    return { ok: true, data: industry }
  }

  list(offset?: number, limit?: number): PaginatedResult<Industry> {
    const result = IndustryRepo.list(this.db, offset, limit)
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
  }

  update(id: string, input: Partial<IndustryRepo.CreateIndustryInput>): Result<Industry> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    try {
      const industry = IndustryRepo.update(this.db, id, {
        ...input,
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      })
      if (!industry) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Industry ${id} not found` } }
      }
      return { ok: true, data: industry }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: `Industry '${input.name}' already exists` } }
      }
      throw err
    }
  }

  delete(id: string): Result<void> {
    const industry = IndustryRepo.get(this.db, id)
    if (!industry) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Industry ${id} not found` } }
    }

    const refCount = IndustryRepo.countReferences(this.db, id)
    if (refCount > 0) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `Cannot delete industry '${industry.name}': referenced by ${refCount} organization(s)`,
        },
      }
    }

    IndustryRepo.del(this.db, id)
    return { ok: true, data: undefined }
  }

  /**
   * Find an industry by name, creating it if it doesn't exist.
   * Supports the combobox "select existing or create new" pattern.
   */
  getOrCreate(name: string): Result<Industry> {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    const existing = IndustryRepo.getByName(this.db, trimmed)
    if (existing) return { ok: true, data: existing }
    return this.create({ name: trimmed })
  }
}
