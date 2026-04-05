import type {
  Industry,
  PaginatedResult,
  PaginationParams,
  RequestFn,
  RequestListFn,
  Result,
} from '../types'

export interface CreateIndustry {
  name: string
  description?: string
}

export interface UpdateIndustry {
  name?: string
  description?: string | null
}

export class IndustriesResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  create(input: CreateIndustry): Promise<Result<Industry>> {
    return this.request<Industry>('POST', '/api/industries', input)
  }

  list(params?: PaginationParams): Promise<PaginatedResult<Industry>> {
    const p: Record<string, string> = {}
    if (params?.offset !== undefined) p.offset = String(params.offset)
    if (params?.limit !== undefined) p.limit = String(params.limit)
    return this.requestList<Industry>('GET', '/api/industries', Object.keys(p).length > 0 ? p : undefined)
  }

  get(id: string): Promise<Result<Industry>> {
    return this.request<Industry>('GET', `/api/industries/${id}`)
  }

  update(id: string, input: UpdateIndustry): Promise<Result<Industry>> {
    return this.request<Industry>('PATCH', `/api/industries/${id}`, input)
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/industries/${id}`)
  }
}
