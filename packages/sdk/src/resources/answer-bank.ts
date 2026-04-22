import type { AnswerBankEntry, UpsertAnswer, RequestFn, Result } from '../types'

export class AnswerBankResource {
  constructor(private request: RequestFn) {}

  /** List all answer bank entries. */
  list(): Promise<Result<AnswerBankEntry[]>> {
    return this.request<AnswerBankEntry[]>('GET', '/api/profile/answers')
  }

  /** Create or update an answer bank entry by field_kind. */
  upsert(data: UpsertAnswer): Promise<Result<AnswerBankEntry>> {
    return this.request<AnswerBankEntry>('PUT', '/api/profile/answers', data)
  }

  /** Delete an answer bank entry by field_kind. */
  delete(fieldKind: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/profile/answers/${encodeURIComponent(fieldKind)}`)
  }
}
