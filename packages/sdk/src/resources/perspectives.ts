import type {
  PaginatedResult,
  PaginationParams,
  Perspective,
  PerspectiveFilter,
  PerspectiveWithChain,
  RejectInput,
  RequestFn,
  RequestListFn,
  Result,
  UpdatePerspective,
} from '../types'

function toParams(
  filter?: object,
): Record<string, string> | undefined {
  if (!filter) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined && v !== null) out[k] = String(v)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export class PerspectivesResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  list(
    filter?: PerspectiveFilter & PaginationParams,
  ): Promise<PaginatedResult<Perspective>> {
    return this.requestList<Perspective>(
      'GET',
      '/api/perspectives',
      toParams(filter),
    )
  }

  get(id: string): Promise<Result<PerspectiveWithChain>> {
    return this.request<PerspectiveWithChain>(
      'GET',
      `/api/perspectives/${id}`,
    )
  }

  update(
    id: string,
    input: UpdatePerspective,
  ): Promise<Result<Perspective>> {
    return this.request<Perspective>(
      'PATCH',
      `/api/perspectives/${id}`,
      input,
    )
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/perspectives/${id}`)
  }

  approve(id: string): Promise<Result<Perspective>> {
    return this.request<Perspective>(
      'PATCH',
      `/api/perspectives/${id}/approve`,
    )
  }

  reject(id: string, input: RejectInput): Promise<Result<Perspective>> {
    return this.request<Perspective>(
      'PATCH',
      `/api/perspectives/${id}/reject`,
      input,
    )
  }

  reopen(id: string): Promise<Result<Perspective>> {
    return this.request<Perspective>(
      'PATCH',
      `/api/perspectives/${id}/reopen`,
    )
  }
}
