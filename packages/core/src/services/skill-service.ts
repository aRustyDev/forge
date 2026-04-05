/**
 * SkillService — business logic for skill entities.
 *
 * Introduced in Phase 89 (migration 031):
 * - Validates the structured `category` enum (CHECK constraint backing).
 * - Manages the `skill_domains` junction for many-to-many skill↔domain linkage.
 * - Supports the "select existing or create new" pattern via getOrCreate().
 *
 * Skill names are capitalized on the first character while preserving the rest
 * (e.g. "SAFe" stays "SAFe", "typescript" becomes "Typescript") — this is the
 * same rule the raw route layer used prior to the service extraction.
 */

import type { Database } from 'bun:sqlite'
import type { Result, Skill, SkillCategory, SkillWithDomains, Domain } from '../types'
import * as SkillRepo from '../db/repositories/skill-repository'

/** Valid SkillCategory values — mirrors the CHECK constraint in migration 031. */
const VALID_CATEGORIES: readonly SkillCategory[] = [
  'language',
  'framework',
  'platform',
  'tool',
  'library',
  'methodology',
  'protocol',
  'concept',
  'soft_skill',
  'other',
] as const

function isValidCategory(value: unknown): value is SkillCategory {
  return typeof value === 'string' && (VALID_CATEGORIES as readonly string[]).includes(value)
}

/** Capitalize first character only, preserve rest (SAFe stays SAFe, foo→Foo). */
function capitalizeFirst(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export interface CreateSkillInput {
  name: string
  category?: SkillCategory | string
  notes?: string | null
}

export interface UpdateSkillInput {
  name?: string
  category?: SkillCategory | string
  notes?: string | null
}

export class SkillService {
  constructor(private db: Database) {}

  create(input: CreateSkillInput): Result<Skill> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (input.category !== undefined && !isValidCategory(input.category)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid category '${input.category}'. Valid values: ${VALID_CATEGORIES.join(', ')}`,
        },
      }
    }

    try {
      const skill = SkillRepo.create(this.db, {
        name: capitalizeFirst(input.name.trim()),
        category: input.category as SkillCategory | undefined,
        notes: input.notes ?? null,
      })
      return { ok: true, data: skill }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: `Skill '${input.name}' already exists` } }
      }
      throw err
    }
  }

  get(id: string): Result<Skill> {
    const skill = SkillRepo.get(this.db, id)
    if (!skill) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Skill ${id} not found` } }
    }
    return { ok: true, data: skill }
  }

  getWithDomains(id: string): Result<SkillWithDomains> {
    const skill = SkillRepo.getWithDomains(this.db, id)
    if (!skill) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Skill ${id} not found` } }
    }
    return { ok: true, data: skill }
  }

  list(filter?: { category?: string; domain_id?: string }): Result<Skill[]> {
    if (filter?.category !== undefined && !isValidCategory(filter.category)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid category '${filter.category}'. Valid values: ${VALID_CATEGORIES.join(', ')}`,
        },
      }
    }
    const skills = SkillRepo.list(this.db, {
      category: filter?.category as SkillCategory | undefined,
      domain_id: filter?.domain_id,
    })
    return { ok: true, data: skills }
  }

  update(id: string, input: UpdateSkillInput): Result<Skill> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (input.category !== undefined && !isValidCategory(input.category)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid category '${input.category}'. Valid values: ${VALID_CATEGORIES.join(', ')}`,
        },
      }
    }

    try {
      const updated = SkillRepo.update(this.db, id, {
        ...(input.name !== undefined ? { name: capitalizeFirst(input.name.trim()) } : {}),
        ...(input.category !== undefined ? { category: input.category as SkillCategory } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      })
      if (!updated) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Skill ${id} not found` } }
      }
      return { ok: true, data: updated }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: `Skill '${input.name}' already exists` } }
      }
      throw err
    }
  }

  delete(id: string): Result<void> {
    const existing = SkillRepo.get(this.db, id)
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Skill ${id} not found` } }
    }
    SkillRepo.del(this.db, id)
    return { ok: true, data: undefined }
  }

  /**
   * Find a skill by name, creating it if it doesn't exist.
   * Supports the combobox "select existing or create new" pattern.
   */
  getOrCreate(name: string, category?: SkillCategory | string): Result<Skill> {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (category !== undefined && !isValidCategory(category)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid category '${category}'. Valid values: ${VALID_CATEGORIES.join(', ')}`,
        },
      }
    }
    const existing = SkillRepo.getByName(this.db, trimmed)
    if (existing) return { ok: true, data: existing }
    return this.create({ name: trimmed, category: category as SkillCategory | undefined })
  }

  // ── Skill ↔ Domain junction ─────────────────────────────────────────

  /** Link a skill to a domain (idempotent). */
  addDomain(skillId: string, domainId: string): Result<void> {
    const skill = SkillRepo.get(this.db, skillId)
    if (!skill) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Skill ${skillId} not found` } }
    }
    try {
      SkillRepo.addDomain(this.db, skillId, domainId)
      return { ok: true, data: undefined }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('FOREIGN KEY')) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Domain ${domainId} not found` } }
      }
      throw err
    }
  }

  /** Unlink a skill from a domain. */
  removeDomain(skillId: string, domainId: string): Result<void> {
    SkillRepo.removeDomain(this.db, skillId, domainId)
    return { ok: true, data: undefined }
  }

  /** Get all domains linked to a skill. */
  getDomains(skillId: string): Result<Domain[]> {
    const skill = SkillRepo.get(this.db, skillId)
    if (!skill) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Skill ${skillId} not found` } }
    }
    return { ok: true, data: SkillRepo.getDomains(this.db, skillId) }
  }
}
