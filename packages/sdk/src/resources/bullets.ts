import type {
  Bullet,
  BulletFilter,
  BulletWithRelations,
  DerivePerspectiveInput,
  PaginatedResult,
  PaginationParams,
  Perspective,
  RejectInput,
  RequestFn,
  RequestListFn,
  Result,
  UpdateBullet,
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

export class BulletsResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  list(
    filter?: BulletFilter & PaginationParams,
  ): Promise<PaginatedResult<Bullet>> {
    return this.requestList<Bullet>('GET', '/api/bullets', toParams(filter))
  }

  get(id: string): Promise<Result<BulletWithRelations>> {
    return this.request<BulletWithRelations>('GET', `/api/bullets/${id}`)
  }

  update(id: string, input: UpdateBullet): Promise<Result<Bullet>> {
    return this.request<Bullet>('PATCH', `/api/bullets/${id}`, input)
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/bullets/${id}`)
  }

  approve(id: string): Promise<Result<Bullet>> {
    return this.request<Bullet>('PATCH', `/api/bullets/${id}/approve`)
  }

  reject(id: string, input: RejectInput): Promise<Result<Bullet>> {
    return this.request<Bullet>('PATCH', `/api/bullets/${id}/reject`, input)
  }

  reopen(id: string): Promise<Result<Bullet>> {
    return this.request<Bullet>('PATCH', `/api/bullets/${id}/reopen`)
  }

  derivePerspectives(
    id: string,
    input: DerivePerspectiveInput,
  ): Promise<Result<Perspective>> {
    return this.request<Perspective>(
      'POST',
      `/api/bullets/${id}/derive-perspectives`,
      input,
    )
  }
}
