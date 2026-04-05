/**
 * RoleTypeService — business logic for role type entities.
 *
 * Validates input. Role type names are human-readable (e.g. "Individual Contributor",
 * "Tech Lead", "Architect") with no slug format constraint.
 */

import type { Database } from 'bun:sqlite'
import type { RoleType, Result, PaginatedResult } from '../types'
import * as RoleTypeRepo from '../db/repositories/role-type-repository'

export class RoleTypeService {
  constructor(private db: Database) {}

  create(input: RoleTypeRepo.CreateRoleTypeInput): Result<RoleType> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    try {
      const roleType = RoleTypeRepo.create(this.db, { ...input, name: input.name.trim() })
      return { ok: true, data: roleType }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: `Role type '${input.name}' already exists` } }
      }
      throw err
    }
  }

  get(id: string): Result<RoleType> {
    const roleType = RoleTypeRepo.get(this.db, id)
    if (!roleType) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Role type ${id} not found` } }
    }
    return { ok: true, data: roleType }
  }

  getByName(name: string): Result<RoleType> {
    const roleType = RoleTypeRepo.getByName(this.db, name)
    if (!roleType) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Role type '${name}' not found` } }
    }
    return { ok: true, data: roleType }
  }

  list(offset?: number, limit?: number): PaginatedResult<RoleType> {
    const result = RoleTypeRepo.list(this.db, offset, limit)
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
  }

  update(id: string, input: Partial<RoleTypeRepo.CreateRoleTypeInput>): Result<RoleType> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    try {
      const roleType = RoleTypeRepo.update(this.db, id, {
        ...input,
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      })
      if (!roleType) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Role type ${id} not found` } }
      }
      return { ok: true, data: roleType }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: `Role type '${input.name}' already exists` } }
      }
      throw err
    }
  }

  delete(id: string): Result<void> {
    const roleType = RoleTypeRepo.get(this.db, id)
    if (!roleType) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Role type ${id} not found` } }
    }
    RoleTypeRepo.del(this.db, id)
    return { ok: true, data: undefined }
  }

  /**
   * Find a role type by name, creating it if it doesn't exist.
   * Supports the combobox "select existing or create new" pattern.
   */
  getOrCreate(name: string): Result<RoleType> {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    const existing = RoleTypeRepo.getByName(this.db, trimmed)
    if (existing) return { ok: true, data: existing }
    return this.create({ name: trimmed })
  }
}
