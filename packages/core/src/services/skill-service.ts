/**
 * SkillService — business logic for skill entities.
 *
 * Phase 1.2: uses EntityLifecycleManager instead of SkillRepository.
 *
 * Introduced in Phase 89 (migration 031):
 * - Validates the structured `category` enum (CHECK constraint backing).
 * - Manages the `skill_domains` junction for many-to-many skill↔domain linkage.
 * - Supports the "select existing or create new" pattern via getOrCreate().
 *
 * Skill names are capitalized on the first character while preserving the rest
 * (e.g. "SAFe" stays "SAFe", "typescript" becomes "Typescript") — this is the
 * same rule the raw route layer used prior to the service extraction.
 *
 * The `skills.category` column is an FK to `skill_categories.slug` (non-id
 * FK). The integrity layer validates existence via `adapter.count`; this
 * service keeps a static enum-literal check in addition so callers get
 * specific "Invalid category 'foo'. Valid values: ..." messages that
 * name the enum values.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { Result, Skill, SkillCategory, SkillWithDomains, Domain } from '../types'

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
  'ai_ml',
  'infrastructure',
  'data_systems',
  'security',
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
}

export interface UpdateSkillInput {
  name?: string
  category?: SkillCategory | string
}

export class SkillService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateSkillInput): Promise<Result<Skill>> {
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

    const createResult = await this.elm.create('skills', {
      name: capitalizeFirst(input.name.trim()),
      // Entity map declares default 'other' for category, so omission is
      // fine; pass through when provided.
      ...(input.category !== undefined ? { category: input.category } : {}),
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    return this.fetchSkill(createResult.value.id)
  }

  async get(id: string): Promise<Result<Skill>> {
    return this.fetchSkill(id)
  }

  async getWithDomains(id: string): Promise<Result<SkillWithDomains>> {
    const skillResult = await this.fetchSkill(id)
    if (!skillResult.ok) return skillResult

    const domains = await this.fetchDomainsFor(id)
    return { ok: true, data: { ...skillResult.data, domains } }
  }

  async list(filter?: { category?: string; domain_id?: string; search?: string }): Promise<Result<Skill[]>> {
    if (filter?.category !== undefined && !isValidCategory(filter.category)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid category '${filter.category}'. Valid values: ${VALID_CATEGORIES.join(', ')}`,
        },
      }
    }

    // If filtering by domain, walk the junction rather than trying to
    // use a SQL JOIN. This is a small number of skills per domain, so
    // the per-row fetch is acceptable.
    if (filter?.domain_id) {
      const junctionResult = await this.elm.list('skill_domains', {
        where: { domain_id: filter.domain_id },
        limit: 10000,
      })
      if (!junctionResult.ok) {
        return { ok: false, error: storageErrorToForgeError(junctionResult.error) }
      }
      const searchLower = filter.search?.toLowerCase()
      const skills: Skill[] = []
      for (const row of junctionResult.value.rows) {
        const j = row as unknown as { skill_id: string; domain_id: string }
        const skillResult = await this.elm.get('skills', j.skill_id)
        if (!skillResult.ok) continue
        const s = skillResult.value as unknown as Skill
        if (filter.category !== undefined && s.category !== filter.category) continue
        if (searchLower && !s.name.toLowerCase().includes(searchLower)) continue
        skills.push(this.toSkill(s))
      }
      skills.sort((a, b) => a.name.localeCompare(b.name))
      return { ok: true, data: skills }
    }

    const where: Record<string, unknown> = {}
    if (filter?.category !== undefined) {
      where.category = filter.category as string
    }

    const listResult = await this.elm.list('skills', {
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [{ field: 'name', direction: 'asc' }],
      limit: 10000,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    let rows = listResult.value.rows.map((r) => this.toSkill(r as unknown as Skill))
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase()
      rows = rows.filter((s) => s.name.toLowerCase().includes(searchLower))
    }
    return { ok: true, data: rows }
  }

  async update(id: string, input: UpdateSkillInput): Promise<Result<Skill>> {
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

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = capitalizeFirst(input.name.trim())
    if (input.category !== undefined) patch.category = input.category

    const updateResult = await this.elm.update('skills', id, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchSkill(id)
  }

  async delete(id: string): Promise<Result<void>> {
    const delResult = await this.elm.delete('skills', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  /**
   * Find a skill by name (case-insensitive), creating it if it doesn't
   * exist. Supports the combobox "select existing or create new"
   * pattern.
   */
  async getOrCreate(
    name: string,
    category?: SkillCategory | string,
  ): Promise<Result<Skill>> {
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

    // Case-insensitive name lookup. The WhereClause DSL has no $ilike,
    // so we walk a bounded list and filter in-memory. Skills tables are
    // < 1000 rows in practice; if this becomes hot, add a named query.
    const existing = await this.getByNameCaseInsensitive(trimmed)
    if (existing) return { ok: true, data: existing }

    return this.create({ name: trimmed, category: category as SkillCategory | undefined })
  }

  // ── Skill ↔ Domain junction ─────────────────────────────────────────

  /** Link a skill to a domain (idempotent — duplicate → ok). */
  async addDomain(skillId: string, domainId: string): Promise<Result<void>> {
    // Verify skill exists first so we can return the user-friendly
    // "Skill X not found" message that the historical service returned.
    const skillResult = await this.elm.get('skills', skillId)
    if (!skillResult.ok) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Skill ${skillId} not found` },
      }
    }

    // Idempotent: if the pair already exists, return ok. This matches
    // the old SkillRepo.addDomain which used INSERT OR IGNORE.
    const existing = await this.elm.count('skill_domains', {
      skill_id: skillId,
      domain_id: domainId,
    })
    if (existing.ok && existing.value > 0) {
      return { ok: true, data: undefined }
    }

    const createResult = await this.elm.create('skill_domains', {
      skill_id: skillId,
      domain_id: domainId,
    })
    if (!createResult.ok) {
      const mapped = storageErrorToForgeError(createResult.error)
      // The old service mapped FK violations on domain_id to
      // NOT_FOUND with "Domain X not found" wording.
      if (mapped.code === 'VALIDATION_ERROR' && mapped.message.includes('domain')) {
        return {
          ok: false,
          error: { code: 'NOT_FOUND', message: `Domain ${domainId} not found` },
        }
      }
      return { ok: false, error: mapped }
    }
    return { ok: true, data: undefined }
  }

  /** Unlink a skill from a domain (silent if the pair does not exist). */
  async removeDomain(skillId: string, domainId: string): Promise<Result<void>> {
    const delResult = await this.elm.deleteWhere('skill_domains', {
      skill_id: skillId,
      domain_id: domainId,
    })
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  /** Get all domains linked to a skill. */
  async getDomains(skillId: string): Promise<Result<Domain[]>> {
    const skillResult = await this.elm.get('skills', skillId)
    if (!skillResult.ok) {
      return { ok: false, error: storageErrorToForgeError(skillResult.error) }
    }
    const domains = await this.fetchDomainsFor(skillId)
    return { ok: true, data: domains }
  }

  // ── Merge ────────────────────────────────────────────────────────

  /**
   * Atomically merge `sourceId` into `targetId`: re-point all junction
   * rows from the source skill to the target, handling duplicates, then
   * delete the source skill.
   *
   * Returns the surviving target skill.
   */
  async merge(sourceId: string, targetId: string): Promise<Result<Skill>> {
    if (sourceId === targetId) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot merge a skill into itself' } }
    }

    // Verify both skills exist.
    const [sourceResult, targetResult] = await Promise.all([
      this.elm.get('skills', sourceId),
      this.elm.get('skills', targetId),
    ])
    if (!sourceResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Source skill ${sourceId} not found` } }
    }
    if (!targetResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Target skill ${targetId} not found` } }
    }

    // Junction tables to migrate: [entityType, parentField]
    const junctions: Array<[string, string]> = [
      ['bullet_skills', 'bullet_id'],
      ['resume_skills', 'section_id'],
      ['certification_skills', 'certification_id'],
      ['job_description_skills', 'job_description_id'],
      ['perspective_skills', 'perspective_id'],
      ['source_skills', 'source_id'],
      ['skill_domains', 'domain_id'],
      ['summary_skills', 'summary_id'],
    ]

    // Pre-transaction: for each junction, find conflict parent IDs.
    const conflictMap = new Map<string, string[]>()
    for (const [entityType, parentField] of junctions) {
      const [sourceRows, targetRows] = await Promise.all([
        this.elm.list(entityType, { where: { skill_id: sourceId }, limit: 100000 }),
        this.elm.list(entityType, { where: { skill_id: targetId }, limit: 100000 }),
      ])
      if (!sourceRows.ok || !targetRows.ok) continue
      const targetParents = new Set(
        targetRows.value.rows.map((r) => (r as Record<string, unknown>)[parentField] as string),
      )
      const conflicts = sourceRows.value.rows
        .map((r) => (r as Record<string, unknown>)[parentField] as string)
        .filter((pid) => targetParents.has(pid))
      if (conflicts.length > 0) {
        conflictMap.set(entityType, conflicts)
      }
    }

    // Transaction: delete conflicts, remap remaining, delete source skill.
    const txResult = await this.elm.transaction(async (tx) => {
      for (const [entityType, parentField] of junctions) {
        const conflicts = conflictMap.get(entityType)
        if (conflicts && conflicts.length > 0) {
          await tx.deleteWhere(entityType, {
            skill_id: sourceId,
            [parentField]: { $in: conflicts },
          })
        }
        await tx.updateWhere(
          entityType,
          { skill_id: sourceId },
          { skill_id: targetId },
        )
      }
      await tx.delete('skills', sourceId)
    })

    if (!txResult.ok) {
      return { ok: false, error: storageErrorToForgeError(txResult.error) }
    }

    return this.fetchSkill(targetId)
  }

  // ── Internal helpers ─────────────────────────────────────────────

  /**
   * The ELM returns a row with `created_at` included, but the Skill
   * interface omits it. Strip extraneous fields so downstream JSON
   * responses stay stable.
   */
  private toSkill(row: Skill & { created_at?: string }): Skill {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
    }
  }

  private async fetchSkill(id: string): Promise<Result<Skill>> {
    const result = await this.elm.get('skills', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: this.toSkill(result.value as unknown as Skill) }
  }

  private async getByNameCaseInsensitive(name: string): Promise<Skill | null> {
    const lower = name.toLowerCase()
    const listResult = await this.elm.list('skills', { limit: 10000 })
    if (!listResult.ok) return null
    const hit = listResult.value.rows.find(
      (r) => typeof r.name === 'string' && (r.name as string).toLowerCase() === lower,
    )
    return hit ? this.toSkill(hit as unknown as Skill) : null
  }

  private async fetchDomainsFor(skillId: string): Promise<Domain[]> {
    const junctionResult = await this.elm.list('skill_domains', {
      where: { skill_id: skillId },
      limit: 1000,
    })
    if (!junctionResult.ok) return []

    const domains: Domain[] = []
    for (const row of junctionResult.value.rows) {
      const j = row as unknown as { skill_id: string; domain_id: string }
      const d = await this.elm.get('domains', j.domain_id)
      if (d.ok) {
        domains.push(d.value as unknown as Domain)
      }
    }
    domains.sort((a, b) => a.name.localeCompare(b.name))
    return domains
  }
}
