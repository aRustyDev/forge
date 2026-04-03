import type {
  CreateSummary,
  PaginatedResult,
  PaginationParams,
  RequestFn,
  RequestListFn,
  Result,
  Resume,
  Summary,
  SummaryFilter,
  UpdateSummary,
} from '../types'

/**
 * Convert filter + pagination into query string params.
 * Boolean `is_template` is converted to "1"/"0" for SQLite INTEGER columns.
 */
function toParams(
  filter?: object,
  pagination?: PaginationParams,
): Record<string, string> | undefined {
  const out: Record<string, string> = {}

  if (filter) {
    for (const [k, v] of Object.entries(filter)) {
      if (v === undefined || v === null) continue
      // Boolean->"1"/"0" conversion for is_template (SQLite INTEGER column)
      if (k === 'is_template' && typeof v === 'boolean') {
        out[k] = v ? '1' : '0'
      } else {
        out[k] = String(v)
      }
    }
  }

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
    filter?: SummaryFilter & PaginationParams,
  ): Promise<PaginatedResult<Summary>> {
    const { offset, limit, ...rest } = filter ?? {}
    return this.requestList<Summary>(
      'GET',
      '/api/summaries',
      toParams(rest, { offset, limit }),
    )
  }

  get(id: string): Promise<Result<Summary>> {
    return this.request<Summary>('GET', `/api/summaries/${id}`)
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
      toParams(undefined, params),
    )
  }
}
