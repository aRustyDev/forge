/**
 * SummaryService -- business logic for summary entities.
 *
 * Phase 1.2: uses EntityLifecycleManager instead of SummaryRepository.
 *
 * Validates input before delegating to the ELM. All methods return
 * Result<T> (never throw).
 *
 * Phase 91 additions still hold: structured fields (industry_id,
 * role_type_id), summary_skills junction for keyword tagging,
 * filter/sort on list().
 *
 * Quirks that bridge Phase 0 entity-map decisions back to the legacy
 * Summary shape:
 * - `summaries.is_template` is declared `boolean: true` in the entity
 *   map, so the ELM deserializes it as `true/false`. The Summary type
 *   is `number` (0/1) to stay backwards-compatible with existing
 *   routes and tests. The service converts on read via `toSummary`.
 * - `linked_resume_count` is a JOIN-computed column the ELM doesn't
 *   populate; computed per-row via `elm.count('resumes', { summary_id })`.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type {
  Summary,
  SummaryWithRelations,
  Resume,
  Result,
  PaginatedResult,
  Skill,
  Industry,
  RoleType,
  CreateSummaryInput,
  UpdateSummaryInput,
  SummaryFilter,
  SummarySort,
  SummarySortBy,
  SortDirection,
} from '../types'

const VALID_SORT_BY: readonly SummarySortBy[] = ['title', 'created_at', 'updated_at'] as const
const VALID_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'] as const

export class SummaryService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateSummaryInput): Promise<Result<Summary>> {
    if (!input.title || input.title.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty' } }
    }
    if (input.is_template !== undefined && input.is_template !== 0 && input.is_template !== 1) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'is_template must be 0 or 1' },
      }
    }

    const createResult = await this.elm.create('summaries', {
      title: input.title,
      role: input.role ?? null,
      description: input.description ?? null,
      is_template: input.is_template ?? 0,
      industry_id: input.industry_id ?? null,
      role_type_id: input.role_type_id ?? null,
      notes: input.notes ?? null,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    return this.fetchSummary(createResult.value.id)
  }

  async get(id: string): Promise<Result<Summary>> {
    return this.fetchSummary(id)
  }

  async getWithRelations(id: string): Promise<Result<SummaryWithRelations>> {
    const base = await this.fetchSummary(id)
    if (!base.ok) return base

    let industry: Industry | null = null
    if (base.data.industry_id) {
      const res = await this.elm.get('industries', base.data.industry_id)
      if (res.ok) industry = res.value as unknown as Industry
    }

    let roleType: RoleType | null = null
    if (base.data.role_type_id) {
      const res = await this.elm.get('role_types', base.data.role_type_id)
      if (res.ok) roleType = res.value as unknown as RoleType
    }

    const skills = await this.fetchSkillsFor(id)
    return {
      ok: true,
      data: { ...base.data, industry, role_type: roleType, skills },
    }
  }

  async list(
    filter?: SummaryFilter,
    sort?: SummarySort,
    offset?: number,
    limit?: number,
  ): Promise<PaginatedResult<Summary>> {
    if (sort?.sort_by !== undefined && !VALID_SORT_BY.includes(sort.sort_by)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid sort_by '${sort.sort_by}'. Valid: ${VALID_SORT_BY.join(', ')}`,
        },
      }
    }
    if (sort?.direction !== undefined && !VALID_DIRECTIONS.includes(sort.direction)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid direction '${sort.direction}'. Valid: ${VALID_DIRECTIONS.join(', ')}`,
        },
      }
    }

    // If filtering by skill_id, walk the junction in-memory (mirrors the
    // archetype/skill-service pattern). Otherwise, use the adapter's
    // generic where/orderBy path.
    const sortBy: SummarySortBy = sort?.sort_by ?? 'updated_at'
    const direction: SortDirection = sort?.direction ?? (sortBy === 'title' ? 'asc' : 'desc')
    // Historical behavior: templates always float to the top.
    const orderBy = [
      { field: 'is_template', direction: 'desc' as const },
      { field: sortBy, direction },
    ]

    if (filter?.skill_id !== undefined) {
      const junctionResult = await this.elm.list('summary_skills', {
        where: { skill_id: filter.skill_id },
        limit: 10000,
      })
      if (!junctionResult.ok) {
        return { ok: false, error: storageErrorToForgeError(junctionResult.error) }
      }
      const ids = junctionResult.value.rows.map(
        (r) => (r as unknown as { summary_id: string }).summary_id,
      )
      let results: Summary[] = []
      for (const sid of ids) {
        const s = await this.elm.get('summaries', sid)
        if (!s.ok) continue
        const summary = s.value as unknown as Summary
        // Apply remaining filters client-side
        if (filter.is_template !== undefined) {
          const asNum = typeof (summary.is_template as unknown) === 'boolean'
            ? (summary.is_template as unknown as boolean ? 1 : 0)
            : summary.is_template
          if (asNum !== filter.is_template) continue
        }
        if (filter.industry_id !== undefined && summary.industry_id !== filter.industry_id) {
          continue
        }
        if (filter.role_type_id !== undefined && summary.role_type_id !== filter.role_type_id) {
          continue
        }
        results.push(await this.toSummaryWithCount(summary))
      }

      // Sort: templates first, then by sortBy/direction
      results.sort((a, b) => this.compareForSort(a, b, sortBy, direction))

      // In-memory text search on title/description
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        results = results.filter(s => (s.title as string)?.toLowerCase().includes(searchLower) || (s.description as string)?.toLowerCase().includes(searchLower))
      }

      const total = results.length
      const sliced = results.slice(offset ?? 0, (offset ?? 0) + (limit ?? 50))
      return {
        ok: true,
        data: sliced,
        pagination: { total, offset: offset ?? 0, limit: limit ?? 50 },
      }
    }

    const where: Record<string, unknown> = {}
    if (filter?.is_template !== undefined) where.is_template = filter.is_template
    if (filter?.industry_id !== undefined) where.industry_id = filter.industry_id
    if (filter?.role_type_id !== undefined) where.role_type_id = filter.role_type_id

    // When searching, fetch all rows so we can filter in-memory before slicing.
    const useSearch = !!filter?.search
    const listResult = await this.elm.list('summaries', {
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy,
      offset: useSearch ? undefined : offset,
      limit: useSearch ? 10000 : limit,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }

    let data: Summary[] = []
    for (const row of listResult.value.rows) {
      data.push(await this.toSummaryWithCount(row as unknown as Summary))
    }

    // In-memory text search on title/description
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase()
      data = data.filter(s => (s.title as string)?.toLowerCase().includes(searchLower) || (s.description as string)?.toLowerCase().includes(searchLower))
    }

    if (useSearch) {
      const total = data.length
      const sliced = data.slice(offset ?? 0, (offset ?? 0) + (limit ?? 50))
      return {
        ok: true,
        data: sliced,
        pagination: { total, offset: offset ?? 0, limit: limit ?? 50 },
      }
    }

    return {
      ok: true,
      data,
      pagination: { total: listResult.value.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
  }

  async update(id: string, input: UpdateSummaryInput): Promise<Result<Summary>> {
    if (input.title !== undefined && input.title.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty' } }
    }
    if (input.is_template !== undefined && input.is_template !== 0 && input.is_template !== 1) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'is_template must be 0 or 1' },
      }
    }

    // Build patch with only the fields the caller provided.
    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.role !== undefined) patch.role = input.role
    if (input.description !== undefined) patch.description = input.description
    if (input.is_template !== undefined) patch.is_template = input.is_template
    if (input.industry_id !== undefined) patch.industry_id = input.industry_id
    if (input.role_type_id !== undefined) patch.role_type_id = input.role_type_id
    if (input.notes !== undefined) patch.notes = input.notes

    const updateResult = await this.elm.update('summaries', id, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchSummary(id)
  }

  async delete(id: string): Promise<Result<void>> {
    const delResult = await this.elm.delete('summaries', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async clone(id: string): Promise<Result<Summary>> {
    const source = await this.fetchSummary(id)
    if (!source.ok) {
      return { ok: false, error: { code: 'SUMMARY_NOT_FOUND', message: 'Summary not found' } }
    }

    const createResult = await this.elm.create('summaries', {
      title: `Copy of ${source.data.title}`,
      role: source.data.role,
      description: source.data.description,
      is_template: 0,
      industry_id: source.data.industry_id,
      role_type_id: source.data.role_type_id,
      notes: source.data.notes,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    const newId = createResult.value.id

    // Duplicate summary_skills links. Listed separately rather than in
    // a `transaction()` scope because each ELM create is its own
    // transaction already and this is a rare admin-triggered action.
    const junctionResult = await this.elm.list('summary_skills', {
      where: { summary_id: id },
      limit: 10000,
    })
    if (junctionResult.ok) {
      for (const row of junctionResult.value.rows) {
        const j = row as unknown as { summary_id: string; skill_id: string }
        await this.elm.create('summary_skills', {
          summary_id: newId,
          skill_id: j.skill_id,
        })
      }
    }

    return this.fetchSummary(newId)
  }

  /** Toggle the is_template flag. */
  async toggleTemplate(id: string): Promise<Result<Summary>> {
    const current = await this.fetchSummary(id)
    if (!current.ok) return current

    const updateResult = await this.elm.update('summaries', id, {
      is_template: current.data.is_template === 1 ? 0 : 1,
    })
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchSummary(id)
  }

  /** List resumes linked to a summary via summary_id, with pagination. */
  async getLinkedResumes(
    id: string,
    offset?: number,
    limit?: number,
  ): Promise<PaginatedResult<Resume>> {
    // Verify the summary exists before querying linked resumes
    const summaryResult = await this.elm.get('summaries', id)
    if (!summaryResult.ok) {
      return { ok: false, error: storageErrorToForgeError(summaryResult.error) }
    }

    const listResult = await this.elm.list('resumes', {
      where: { summary_id: id },
      orderBy: [{ field: 'updated_at', direction: 'desc' }],
      offset,
      limit,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }

    return {
      ok: true,
      data: listResult.value.rows as unknown as Resume[],
      pagination: {
        total: listResult.value.total,
        offset: offset ?? 0,
        limit: limit ?? 50,
      },
    }
  }

  // ── Skill keyword junction ──────────────────────────────────────────

  /** Link a skill as a keyword on the summary (idempotent). */
  async addSkill(summaryId: string, skillId: string): Promise<Result<void>> {
    const summaryResult = await this.elm.get('summaries', summaryId)
    if (!summaryResult.ok) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Summary ${summaryId} not found` },
      }
    }

    // Idempotent: skip if already linked.
    const existing = await this.elm.count('summary_skills', {
      summary_id: summaryId,
      skill_id: skillId,
    })
    if (existing.ok && existing.value > 0) {
      return { ok: true, data: undefined }
    }

    const createResult = await this.elm.create('summary_skills', {
      summary_id: summaryId,
      skill_id: skillId,
    })
    if (!createResult.ok) {
      const mapped = storageErrorToForgeError(createResult.error)
      // Map FK violation on skill_id to NOT_FOUND wording.
      if (mapped.code === 'VALIDATION_ERROR' && mapped.message.includes('skill')) {
        return {
          ok: false,
          error: { code: 'NOT_FOUND', message: `Skill ${skillId} not found` },
        }
      }
      return { ok: false, error: mapped }
    }
    return { ok: true, data: undefined }
  }

  /** Unlink a skill keyword from the summary. */
  async removeSkill(summaryId: string, skillId: string): Promise<Result<void>> {
    const delResult = await this.elm.deleteWhere('summary_skills', {
      summary_id: summaryId,
      skill_id: skillId,
    })
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  /** Get all skill keywords linked to the summary. */
  async getSkills(summaryId: string): Promise<Result<Skill[]>> {
    const summaryResult = await this.elm.get('summaries', summaryId)
    if (!summaryResult.ok) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Summary ${summaryId} not found` },
      }
    }
    const skills = await this.fetchSkillsFor(summaryId)
    return { ok: true, data: skills }
  }

  // ── Internal helpers ─────────────────────────────────────────────

  private async fetchSummary(id: string): Promise<Result<Summary>> {
    const result = await this.elm.get('summaries', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    const summary = await this.toSummaryWithCount(result.value as unknown as Summary)
    return { ok: true, data: summary }
  }

  /**
   * Normalize an ELM row into the legacy Summary shape. Converts the
   * `is_template` boolean back to `0/1` and populates the computed
   * `linked_resume_count` via `elm.count('resumes')`.
   */
  private async toSummaryWithCount(
    row: Summary & { is_template: number | boolean },
  ): Promise<Summary> {
    const isTemplate =
      typeof row.is_template === 'boolean' ? (row.is_template ? 1 : 0) : row.is_template
    const countResult = await this.elm.count('resumes', { summary_id: row.id })
    const linkedResumeCount = countResult.ok ? countResult.value : 0
    return {
      id: row.id,
      title: row.title,
      role: row.role ?? null,
      description: row.description ?? null,
      is_template: isTemplate,
      industry_id: row.industry_id ?? null,
      role_type_id: row.role_type_id ?? null,
      linked_resume_count: linkedResumeCount,
      notes: row.notes ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }

  private compareForSort(
    a: Summary,
    b: Summary,
    sortBy: SummarySortBy,
    direction: SortDirection,
  ): number {
    // Templates first
    if (a.is_template !== b.is_template) return b.is_template - a.is_template
    const av =
      sortBy === 'title' ? a.title : sortBy === 'created_at' ? a.created_at : a.updated_at
    const bv =
      sortBy === 'title' ? b.title : sortBy === 'created_at' ? b.created_at : b.updated_at
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  }

  private async fetchSkillsFor(summaryId: string): Promise<Skill[]> {
    const junctionResult = await this.elm.list('summary_skills', {
      where: { summary_id: summaryId },
      limit: 1000,
    })
    if (!junctionResult.ok) return []

    const skills: Skill[] = []
    for (const row of junctionResult.value.rows) {
      const j = row as unknown as { summary_id: string; skill_id: string }
      const s = await this.elm.get('skills', j.skill_id)
      if (s.ok) {
        const skill = s.value as Skill & { created_at?: string }
        // Strip created_at to match Skill interface
        skills.push({
          id: skill.id,
          name: skill.name,
          category: skill.category,
        })
      }
    }
    skills.sort((a, b) => a.name.localeCompare(b.name))
    return skills
  }
}
