import type {
  Domain,
  RequestFn,
  Result,
  Skill,
  SkillCategory,
  SkillWithDomains,
} from '../types'

export interface CreateSkill {
  name: string
  category?: SkillCategory
  notes?: string | null
}

export interface UpdateSkill {
  name?: string
  category?: SkillCategory
  notes?: string | null
}

export interface SkillListFilter {
  category?: SkillCategory
  domain_id?: string
  limit?: number
}

export class SkillsResource {
  constructor(private request: RequestFn) {}

  list(filter?: SkillListFilter): Promise<Result<Skill[]>> {
    let path = '/api/skills'
    const params: string[] = []
    if (filter?.category) params.push(`category=${encodeURIComponent(filter.category)}`)
    if (filter?.domain_id) params.push(`domain_id=${encodeURIComponent(filter.domain_id)}`)
    if (filter?.limit) params.push(`limit=${filter.limit}`)
    if (params.length > 0) path += `?${params.join('&')}`
    return this.request<Skill[]>('GET', path)
  }

  get(id: string): Promise<Result<Skill>> {
    return this.request<Skill>('GET', `/api/skills/${id}`)
  }

  /** Get a skill with its linked domains populated. */
  getWithDomains(id: string): Promise<Result<SkillWithDomains>> {
    return this.request<SkillWithDomains>('GET', `/api/skills/${id}?include=domains`)
  }

  create(input: CreateSkill): Promise<Result<Skill>> {
    return this.request<Skill>('POST', '/api/skills', input)
  }

  update(id: string, input: UpdateSkill): Promise<Result<Skill>> {
    return this.request<Skill>('PATCH', `/api/skills/${id}`, input)
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/skills/${id}`)
  }

  // ── Skill ↔ Domain junction ─────────────────────────────────────────

  /** List domains linked to a skill. */
  listDomains(skillId: string): Promise<Result<Domain[]>> {
    return this.request<Domain[]>('GET', `/api/skills/${skillId}/domains`)
  }

  /** Link a skill to a domain (idempotent). */
  addDomain(skillId: string, domainId: string): Promise<Result<void>> {
    return this.request<void>('POST', `/api/skills/${skillId}/domains`, { domain_id: domainId })
  }

  /** Unlink a skill from a domain. */
  removeDomain(skillId: string, domainId: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/skills/${skillId}/domains/${domainId}`)
  }
}
