import type {
  CreateNote,
  PaginatedResult,
  PaginationParams,
  RequestFn,
  RequestListFn,
  Result,
  UpdateNote,
  UserNote,
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

export class NotesResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  create(input: CreateNote): Promise<Result<UserNote>> {
    return this.request<UserNote>('POST', '/api/notes', input)
  }

  list(
    filter?: { search?: string } & PaginationParams,
  ): Promise<PaginatedResult<UserNote>> {
    return this.requestList<UserNote>('GET', '/api/notes', toParams(filter))
  }

  get(id: string): Promise<Result<UserNote>> {
    return this.request<UserNote>('GET', `/api/notes/${id}`)
  }

  update(id: string, input: UpdateNote): Promise<Result<UserNote>> {
    return this.request<UserNote>('PATCH', `/api/notes/${id}`, input)
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/notes/${id}`)
  }

  addReference(
    noteId: string,
    input: { entity_type: string; entity_id: string },
  ): Promise<Result<void>> {
    return this.request<void>(
      'POST',
      `/api/notes/${noteId}/references`,
      input,
    )
  }

  removeReference(
    noteId: string,
    entityType: string,
    entityId: string,
  ): Promise<Result<void>> {
    return this.request<void>(
      'DELETE',
      `/api/notes/${noteId}/references/${entityType}/${entityId}`,
    )
  }
}
