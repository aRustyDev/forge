import type {
  CreateSummary,
  PaginatedResult,
  PaginationParams,
  RequestFn,
  RequestListFn,
  Result,
  Resume,
  Skill,
  Summary,
  SummaryFilter,
  SummarySort,
  SummaryWithRelations,
  UpdateSummary,
} from '../types'

/**
 * Convert filter + sort + pagination into query string params.
 * Boolean `is_template` is converted to "1"/"0" for SQLite INTEGER columns.
 */
function toParams(
  filter?: object,
  sort?: SummarySort,
  pagination?: PaginationParams,
): Record<string, string> | undefined {
  const out: Record<string, string> = {}

  if (filter) {
    for (const [k, v] of Object.entries(filter)) {
      if (v === undefined || v === null) continue
      if (k === 'is_template' && typeof v === 'boolean') {
        out[k] = v ? '1' : '0'
      } else {
        out[k] = String(v)
      }
    }
  }

  if (sort?.sort_by) out.sort_by = sort.sort_by
  if (sort?.direction) out.direction = sort.direction

  if (pagination?.offset !== undefined) out.offset = String(pagination.offset)
  if (pagination?.limit !== undefined) out.limit = String(pagination.limit)

  return Object.keys(out).length > 0 ? out : undefined
}

export class SummariesResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  create(input: CreateSummary): Promise<Result<Summary>> {
    return this.request<Summary>('POST', '/api/summaries', input)
  }

  list(
    filter?: SummaryFilter & PaginationParams & SummarySort,
  ): Promise<PaginatedResult<Summary>> {
    const { offset, limit, sort_by, direction, ...rest } = filter ?? {}
    return this.requestList<Summary>(
      'GET',
      '/api/summaries',
      toParams(rest, { sort_by, direction }, { offset, limit }),
    )
  }

  get(id: string): Promise<Result<Summary>> {
    return this.request<Summary>('GET', `/api/summaries/${id}`)
  }

  /** Get a summary with industry, role_type, and skill keywords populated. */
  getWithRelations(id: string): Promise<Result<SummaryWithRelations>> {
    return this.request<SummaryWithRelations>(
      'GET',
      `/api/summaries/${id}?include=relations`,
    )
  }

  update(id: string, input: UpdateSummary): Promise<Result<Summary>> {
    return this.request<Summary>('PATCH', `/api/summaries/${id}`, input)
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/summaries/${id}`)
  }

  clone(id: string): Promise<Result<Summary>> {
    return this.request<Summary>('POST', `/api/summaries/${id}/clone`)
  }

  /** Toggle the is_template flag atomically. Returns the updated summary. */
  toggleTemplate(id: string): Promise<Result<Summary>> {
    return this.request<Summary>('POST', `/api/summaries/${id}/toggle-template`)
  }

  /** List resumes linked to a summary via summary_id, with pagination. */
  linkedResumes(
    id: string,
    params?: PaginationParams,
  ): Promise<PaginatedResult<Resume>> {
    return this.requestList<Resume>(
      'GET',
      `/api/summaries/${id}/linked-resumes`,
      toParams(undefined, undefined, params),
    )
  }

  // ── Skill keyword junction (Phase 91) ───────────────────────────────

  /** List skill keywords linked to a summary. */
  listSkills(id: string): Promise<Result<Skill[]>> {
    return this.request<Skill[]>('GET', `/api/summaries/${id}/skills`)
  }

  /** Link a skill as a keyword on the summary (idempotent). */
  addSkill(id: string, skillId: string): Promise<Result<void>> {
    return this.request<void>('POST', `/api/summaries/${id}/skills`, {
      skill_id: skillId,
    })
  }

  /** Unlink a skill keyword from the summary. */
  removeSkill(id: string, skillId: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/summaries/${id}/skills/${skillId}`)
  }
}
