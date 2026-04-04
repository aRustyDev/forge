import type {
  RequestFn,
  Result,
  Skill,
} from '../types'

export class SkillsResource {
  constructor(private request: RequestFn) {}

  list(filter?: { category?: string; limit?: number }): Promise<Result<Skill[]>> {
    let path = '/api/skills'
    const params: string[] = []
    if (filter?.category) params.push(`category=${encodeURIComponent(filter.category)}`)
    if (filter?.limit) params.push(`limit=${filter.limit}`)
    if (params.length > 0) path += `?${params.join('&')}`
    return this.request<Skill[]>('GET', path)
  }

  create(input: { name: string; category?: string }): Promise<Result<Skill>> {
    return this.request<Skill>('POST', '/api/skills', input)
  }
}
