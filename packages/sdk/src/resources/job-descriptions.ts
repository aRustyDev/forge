import type {
  CreateJobDescription,
  JobDescriptionFilter,
  JobDescriptionWithOrg,
  PaginatedResult,
  PaginationParams,
  RequestFn,
  RequestListFn,
  Result,
  UpdateJobDescription,
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

export class JobDescriptionsResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  create(
    input: CreateJobDescription,
  ): Promise<Result<JobDescriptionWithOrg>> {
    return this.request<JobDescriptionWithOrg>(
      'POST',
      '/api/job-descriptions',
      input,
    )
  }

  list(
    filter?: JobDescriptionFilter & PaginationParams,
  ): Promise<PaginatedResult<JobDescriptionWithOrg>> {
    return this.requestList<JobDescriptionWithOrg>(
      'GET',
      '/api/job-descriptions',
      toParams(filter),
    )
  }

  get(id: string): Promise<Result<JobDescriptionWithOrg>> {
    return this.request<JobDescriptionWithOrg>(
      'GET',
      `/api/job-descriptions/${id}`,
    )
  }

  update(
    id: string,
    input: UpdateJobDescription,
  ): Promise<Result<JobDescriptionWithOrg>> {
    return this.request<JobDescriptionWithOrg>(
      'PATCH',
      `/api/job-descriptions/${id}`,
      input,
    )
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/job-descriptions/${id}`)
  }
}
