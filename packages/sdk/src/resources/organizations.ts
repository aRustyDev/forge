import type {
  CreateOrganization,
  Organization,
  OrganizationFilter,
  PaginatedResult,
  PaginationParams,
  RequestFn,
  RequestListFn,
  Result,
  UpdateOrganization,
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

export class OrganizationsResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  create(input: CreateOrganization): Promise<Result<Organization>> {
    return this.request<Organization>('POST', '/api/organizations', input)
  }

  list(
    filter?: OrganizationFilter & PaginationParams,
  ): Promise<PaginatedResult<Organization>> {
    return this.requestList<Organization>(
      'GET',
      '/api/organizations',
      toParams(filter),
    )
  }

  get(id: string): Promise<Result<Organization>> {
    return this.request<Organization>('GET', `/api/organizations/${id}`)
  }

  update(
    id: string,
    input: UpdateOrganization,
  ): Promise<Result<Organization>> {
    return this.request<Organization>(
      'PATCH',
      `/api/organizations/${id}`,
      input,
    )
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/organizations/${id}`)
  }
}
