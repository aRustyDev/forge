import type {
  Resume,
  ResumeTemplate,
  CreateResumeTemplate,
  UpdateResumeTemplate,
  RequestFn,
  Result,
} from '../types'

/**
 * SDK resource for resume template CRUD.
 *
 * Converts `is_builtin` between server format (0|1) and SDK format (boolean).
 */
export class TemplatesResource {
  constructor(private request: RequestFn) {}

  async list(): Promise<Result<ResumeTemplate[]>> {
    const result = await this.request<ResumeTemplate[]>('GET', '/api/templates')
    if (result.ok) {
      result.data = result.data.map(this.deserialize)
    }
    return result
  }

  async get(id: string): Promise<Result<ResumeTemplate>> {
    const result = await this.request<ResumeTemplate>('GET', `/api/templates/${id}`)
    if (result.ok) {
      result.data = this.deserialize(result.data)
    }
    return result
  }

  async create(input: CreateResumeTemplate): Promise<Result<ResumeTemplate>> {
    const result = await this.request<ResumeTemplate>('POST', '/api/templates', input)
    if (result.ok) {
      result.data = this.deserialize(result.data)
    }
    return result
  }

  async update(id: string, input: UpdateResumeTemplate): Promise<Result<ResumeTemplate>> {
    const result = await this.request<ResumeTemplate>('PATCH', `/api/templates/${id}`, input)
    if (result.ok) {
      result.data = this.deserialize(result.data)
    }
    return result
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/templates/${id}`)
  }

  /**
   * Create a new resume from a template.
   *
   * The server clones the template's section structure into a new resume.
   */
  async createResumeFromTemplate(input: {
    template_id: string
    name: string
    target_role: string
    target_employer: string
    archetype: string
  }): Promise<Result<Resume>> {
    return this.request<Resume>('POST', `/api/templates/${input.template_id}/create-resume`, {
      name: input.name,
      target_role: input.target_role,
      target_employer: input.target_employer,
      archetype: input.archetype,
    })
  }

  /**
   * Convert server is_builtin (0|1) to boolean.
   *
   * The server returns `is_builtin` as `0 | 1` (SQLite INTEGER). The deserializer
   * converts to boolean for the SDK consumer. Using `any` on the parameter is
   * cleaner than `as any` on the output.
   */
  private deserialize(template: any): ResumeTemplate {
    return { ...template, is_builtin: Boolean(template.is_builtin) }
  }
}
