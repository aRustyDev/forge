/**
 * ArchetypeService — business logic for archetype entities.
 *
 * Manages CRUD and domain associations. Blocks deletion when
 * the archetype is referenced by resumes or perspectives.
 */

import type { Database } from 'bun:sqlite'
import type { Archetype, Domain, Result, PaginatedResult } from '../types'
import * as ArchetypeRepo from '../db/repositories/archetype-repository'
import * as DomainRepo from '../db/repositories/domain-repository'

export class ArchetypeService {
  constructor(private db: Database) {}

  create(input: ArchetypeRepo.CreateArchetypeInput): Result<Archetype> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    // Validate name format: lowercase, hyphens allowed (e.g., "agentic-ai")
    if (!/^[a-z][a-z0-9-]*$/.test(input.name)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Archetype name must be lowercase, start with a letter, and contain only letters, digits, and hyphens',
        },
      }
    }
    try {
      const archetype = ArchetypeRepo.create(this.db, input)
      return { ok: true, data: archetype }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: `Archetype '${input.name}' already exists` } }
      }
      throw err
    }
  }

  get(id: string): Result<Archetype> {
    const archetype = ArchetypeRepo.get(this.db, id)
    if (!archetype) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Archetype ${id} not found` } }
    }
    return { ok: true, data: archetype }
  }

  getWithDomains(id: string): Result<ArchetypeRepo.ArchetypeWithDomains> {
    const archetype = ArchetypeRepo.getWithDomains(this.db, id)
    if (!archetype) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Archetype ${id} not found` } }
    }
    return { ok: true, data: archetype }
  }

  list(offset?: number, limit?: number): PaginatedResult<Archetype> {
    const result = ArchetypeRepo.list(this.db, offset, limit)
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
  }

  update(id: string, input: Partial<ArchetypeRepo.CreateArchetypeInput>): Result<Archetype> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (input.name !== undefined && !/^[a-z][a-z0-9-]*$/.test(input.name)) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Archetype name must be lowercase with hyphens only' },
      }
    }

    try {
      const archetype = ArchetypeRepo.update(this.db, id, input)
      if (!archetype) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Archetype ${id} not found` } }
      }
      return { ok: true, data: archetype }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: `Archetype '${input.name}' already exists` } }
      }
      throw err
    }
  }

  delete(id: string): Result<void> {
    const archetype = ArchetypeRepo.get(this.db, id)
    if (!archetype) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Archetype ${id} not found` } }
    }

    const refs = ArchetypeRepo.countReferences(this.db, id)
    if (refs.resume_count > 0) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `Cannot delete archetype '${archetype.name}': referenced by ${refs.resume_count} resume(s)`,
        },
      }
    }
    if (refs.perspective_count > 0) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `Cannot delete archetype '${archetype.name}': referenced by ${refs.perspective_count} perspective(s)`,
        },
      }
    }

    // archetype_domains will cascade-delete
    ArchetypeRepo.del(this.db, id)
    return { ok: true, data: undefined }
  }

  // ── Domain association management ────────────────────────────────

  addDomain(archetypeId: string, domainId: string): Result<void> {
    const archetype = ArchetypeRepo.get(this.db, archetypeId)
    if (!archetype) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Archetype ${archetypeId} not found` } }
    }

    const domain = DomainRepo.get(this.db, domainId)
    if (!domain) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Domain ${domainId} not found` } }
    }

    try {
      ArchetypeRepo.addDomain(this.db, archetypeId, domainId)
      return { ok: true, data: undefined }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint') || message.includes('PRIMARY KEY')) {
        return { ok: false, error: { code: 'CONFLICT', message: 'Domain already associated with this archetype' } }
      }
      throw err
    }
  }

  removeDomain(archetypeId: string, domainId: string): Result<void> {
    const removed = ArchetypeRepo.removeDomain(this.db, archetypeId, domainId)
    if (!removed) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Domain association not found' } }
    }
    return { ok: true, data: undefined }
  }

  listDomains(archetypeId: string): Result<Domain[]> {
    const archetype = ArchetypeRepo.get(this.db, archetypeId)
    if (!archetype) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Archetype ${archetypeId} not found` } }
    }

    const domains = ArchetypeRepo.listDomains(this.db, archetypeId)
    return { ok: true, data: domains }
  }
}
