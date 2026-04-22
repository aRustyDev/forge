/**
 * JobDescriptionService -- business logic for job description entities.
 *
 * Phase 1.3.1: uses EntityLifecycleManager instead of JobDescriptionRepository.
 *
 * Validates input before delegating to the ELM. All methods return
 * Result<T> (never throw).
 *
 * Hydration: `JobDescriptionWithOrg` includes a JOIN-computed
 * `organization_name` field. The service fetches the JD row then
 * looks up its organization_id → organizations.name to populate.
 *
 * Embedding lifecycle: JD embedding is "parse raw_text into
 * requirements → embed each as '{jd_id}:{i}'". The generic
 * createEmbedHook cannot express that, so the service still owns it
 * via queueMicrotask → EmbeddingService.onJDCreated / onJDUpdated.
 * See HOWTO-migrate-service.md "Phase 1.3 gotchas" for rationale.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type {
  JobDescription,
  JobDescriptionWithOrg,
  CreateJobDescription,
  UpdateJobDescription,
  Organization,
  Result,
  PaginatedResult,
  JobDescriptionFilter,
} from '../types'
import { parseRequirements } from '../lib/jd-parser'
import type { EmbeddingService } from './embedding-service'
import type { WhereClause } from '../storage/adapter-types'

const VALID_STATUSES = [
  'discovered',
  'analyzing',
  'applying',
  'applied',
  'interviewing',
  'offered',
  'rejected',
  'withdrawn',
  'closed',
]

export class JobDescriptionService {
  private embeddingService: EmbeddingService | null = null

  constructor(protected readonly elm: EntityLifecycleManager) {}

  /**
   * Set the embedding service for fire-and-forget hooks.
   *
   * NOTE (I6): Constructor injection would be preferred but requires careful
   * ordering in createServices(). The setter pattern is used here because
   * EmbeddingService initialization is async (model loading) and may complete
   * after createServices(). This avoids circular dependency issues.
   */
  setEmbeddingService(svc: EmbeddingService): void {
    this.embeddingService = svc
  }

  async create(
    input: CreateJobDescription,
  ): Promise<Result<JobDescriptionWithOrg>> {
    if (!input.title || input.title.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty' },
      }
    }
    if (!input.raw_text || input.raw_text.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job description text (raw_text) must not be empty',
        },
      }
    }
    if (
      input.status !== undefined &&
      !VALID_STATUSES.includes(input.status)
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
      }
    }

    // Validate salary_min <= salary_max when both are provided
    if (
      input.salary_min != null &&
      input.salary_max != null &&
      input.salary_min > input.salary_max
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'salary_min must not exceed salary_max',
        },
      }
    }

    const createResult = await this.elm.create('job_descriptions', {
      organization_id: input.organization_id ?? null,
      title: input.title,
      url: input.url ?? null,
      raw_text: input.raw_text,
      status: input.status ?? 'discovered',
      salary_range: input.salary_range ?? null,
      salary_min: input.salary_min ?? null,
      salary_max: input.salary_max ?? null,
      location: input.location ?? null,
      parsed_sections: input.parsed_sections ?? null,
      work_posture: input.work_posture ?? null,
      parsed_locations: input.parsed_locations ?? null,
      salary_period: input.salary_period ?? null,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    const fetched = await this.elm.get('job_descriptions', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    const jd = fetched.value as unknown as JobDescription
    const hydrated = await this.toJDWithOrg(jd)

    // Fire-and-forget requirement parsing and embedding
    if (this.embeddingService) {
      const parsed = parseRequirements(input.raw_text)
      const requirementTexts = parsed.requirements.map(r => r.text)
      queueMicrotask(() =>
        this.embeddingService!.onJDCreated(jd, requirementTexts).catch(err =>
          // TODO: Replace with structured logger (Phase 23)
          console.error(`[JobDescriptionService] Embedding hook failed for JD ${jd.id}:`, err)
        )
      )
    }

    return { ok: true, data: hydrated }
  }

  async get(id: string): Promise<Result<JobDescriptionWithOrg>> {
    const result = await this.elm.get('job_descriptions', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    const jd = result.value as unknown as JobDescription
    return { ok: true, data: await this.toJDWithOrg(jd) }
  }

  async list(
    filter?: JobDescriptionFilter,
    offset?: number,
    limit?: number,
  ): Promise<PaginatedResult<JobDescriptionWithOrg>> {
    if (
      filter?.status !== undefined &&
      !VALID_STATUSES.includes(filter.status)
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status filter: ${filter.status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
      }
    }

    const where: WhereClause = {}
    if (filter?.status !== undefined) where.status = filter.status
    if (filter?.organization_id !== undefined)
      where.organization_id = filter.organization_id

    const listResult = await this.elm.list('job_descriptions', {
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [{ field: 'updated_at', direction: 'desc' }],
      offset,
      limit,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }

    const data: JobDescriptionWithOrg[] = []
    for (const row of listResult.value.rows) {
      data.push(await this.toJDWithOrg(row as unknown as JobDescription))
    }

    return {
      ok: true,
      data,
      pagination: {
        total: listResult.value.total,
        offset: offset ?? 0,
        limit: limit ?? 50,
      },
    }
  }

  async update(
    id: string,
    input: UpdateJobDescription,
  ): Promise<Result<JobDescriptionWithOrg>> {
    if (input.title !== undefined && input.title.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty' },
      }
    }
    if (input.raw_text !== undefined && input.raw_text.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job description text (raw_text) must not be empty',
        },
      }
    }
    if (
      input.status !== undefined &&
      !VALID_STATUSES.includes(input.status)
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
      }
    }

    // Validate salary_min <= salary_max when both are provided
    if (
      input.salary_min != null &&
      input.salary_max != null &&
      input.salary_min > input.salary_max
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'salary_min must not exceed salary_max',
        },
      }
    }

    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.organization_id !== undefined)
      patch.organization_id = input.organization_id
    if (input.url !== undefined) patch.url = input.url
    if (input.raw_text !== undefined) patch.raw_text = input.raw_text
    if (input.status !== undefined) patch.status = input.status
    if (input.salary_range !== undefined) patch.salary_range = input.salary_range
    if (input.salary_min !== undefined) patch.salary_min = input.salary_min
    if (input.salary_max !== undefined) patch.salary_max = input.salary_max
    if (input.location !== undefined) patch.location = input.location
    if (input.parsed_sections !== undefined) patch.parsed_sections = input.parsed_sections
    if (input.work_posture !== undefined) patch.work_posture = input.work_posture
    if (input.parsed_locations !== undefined) patch.parsed_locations = input.parsed_locations
    if (input.salary_period !== undefined) patch.salary_period = input.salary_period

    const updateResult = await this.elm.update('job_descriptions', id, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }

    const fetched = await this.elm.get('job_descriptions', id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    const jd = fetched.value as unknown as JobDescription
    const hydrated = await this.toJDWithOrg(jd)

    // If raw_text was updated, re-embed requirements
    if (input.raw_text && this.embeddingService) {
      queueMicrotask(() =>
        this.embeddingService!.onJDUpdated(jd).catch(err =>
          // TODO: Replace with structured logger (Phase 23)
          console.error(`[JobDescriptionService] Re-embedding hook failed for JD ${jd.id}:`, err)
        )
      )
    }

    return { ok: true, data: hydrated }
  }

  async delete(id: string): Promise<Result<void>> {
    const delResult = await this.elm.delete('job_descriptions', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async lookupByUrl(url: string): Promise<Result<JobDescriptionWithOrg>> {
    if (!url || url.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'URL must not be empty' },
      }
    }

    const listResult = await this.elm.list('job_descriptions', {
      where: { url },
      limit: 1,
    })

    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }

    if (listResult.value.rows.length === 0) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `No job description found for URL: ${url}` },
      }
    }

    const jd = listResult.value.rows[0] as unknown as JobDescription
    const hydrated = await this.toJDWithOrg(jd)
    return { ok: true, data: hydrated }
  }

  // ── helpers ─────────────────────────────────────────────────────────

  private async toJDWithOrg(
    jd: JobDescription,
  ): Promise<JobDescriptionWithOrg> {
    let organization_name: string | null = null
    if (jd.organization_id) {
      const orgResult = await this.elm.get('organizations', jd.organization_id)
      if (orgResult.ok) {
        organization_name = (orgResult.value as unknown as Organization).name
      }
    }
    return { ...jd, organization_name }
  }
}
