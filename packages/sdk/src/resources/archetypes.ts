import type {
  Archetype,
  Domain,
  PaginatedResult,
  PaginationParams,
  RequestFn,
  RequestListFn,
  Result,
} from '../types'

export interface CreateArchetype {
  name: string
  description?: string
}

export interface UpdateArchetype {
  name?: string
  description?: string | null
}

export interface ArchetypeWithDomains extends Archetype {
  domains: Domain[]
}

export class ArchetypesResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  create(input: CreateArchetype): Promise<Result<Archetype>> {
    return this.request<Archetype>('POST', '/api/archetypes', input)
  }

  list(params?: PaginationParams): Promise<PaginatedResult<Archetype>> {
    const p: Record<string, string> = {}
    if (params?.offset !== undefined) p.offset = String(params.offset)
    if (params?.limit !== undefined) p.limit = String(params.limit)
    return this.requestList<Archetype>('GET', '/api/archetypes', Object.keys(p).length > 0 ? p : undefined)
  }

  get(id: string): Promise<Result<ArchetypeWithDomains>> {
    return this.request<ArchetypeWithDomains>('GET', `/api/archetypes/${id}`)
  }

  update(id: string, input: UpdateArchetype): Promise<Result<Archetype>> {
    return this.request<Archetype>('PATCH', `/api/archetypes/${id}`, input)
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/archetypes/${id}`)
  }

  // ── Domain associations ────────────────────────────────────────

  listDomains(archetypeId: string): Promise<Result<Domain[]>> {
    return this.request<Domain[]>('GET', `/api/archetypes/${archetypeId}/domains`)
  }

  addDomain(archetypeId: string, domainId: string): Promise<Result<void>> {
    return this.request<void>('POST', `/api/archetypes/${archetypeId}/domains`, { domain_id: domainId })
  }

  removeDomain(archetypeId: string, domainId: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/archetypes/${archetypeId}/domains/${domainId}`)
  }
}
