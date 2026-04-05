import type {
  RoleType,
  PaginatedResult,
  PaginationParams,
  RequestFn,
  RequestListFn,
  Result,
} from '../types'

export interface CreateRoleType {
  name: string
  description?: string
}

export interface UpdateRoleType {
  name?: string
  description?: string | null
}

export class RoleTypesResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  create(input: CreateRoleType): Promise<Result<RoleType>> {
    return this.request<RoleType>('POST', '/api/role-types', input)
  }

  list(params?: PaginationParams): Promise<PaginatedResult<RoleType>> {
    const p: Record<string, string> = {}
    if (params?.offset !== undefined) p.offset = String(params.offset)
    if (params?.limit !== undefined) p.limit = String(params.limit)
    return this.requestList<RoleType>('GET', '/api/role-types', Object.keys(p).length > 0 ? p : undefined)
  }

  get(id: string): Promise<Result<RoleType>> {
    return this.request<RoleType>('GET', `/api/role-types/${id}`)
  }

  update(id: string, input: UpdateRoleType): Promise<Result<RoleType>> {
    return this.request<RoleType>('PATCH', `/api/role-types/${id}`, input)
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/role-types/${id}`)
  }
}
