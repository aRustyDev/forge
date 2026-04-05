/**
 * CredentialsResource — SDK client for the credentials API.
 *
 * Introduced by Phase 86 T86.3 as part of the Qualifications track.
 *
 * Endpoints mirrored:
 *   GET    /api/credentials              list()
 *   GET    /api/credentials?type=...     list({type})
 *   GET    /api/credentials/:id          get(id)
 *   POST   /api/credentials              create(input)
 *   PATCH  /api/credentials/:id          update(id, input)
 *   DELETE /api/credentials/:id          delete(id)
 */

import type {
  Credential,
  CreateCredential,
  CredentialType,
  RequestFn,
  Result,
  UpdateCredential,
} from '../types'

export class CredentialsResource {
  constructor(private request: RequestFn) {}

  list(filter?: { type?: CredentialType }): Promise<Result<Credential[]>> {
    let path = '/api/credentials'
    if (filter?.type) path += `?type=${encodeURIComponent(filter.type)}`
    return this.request<Credential[]>('GET', path)
  }

  get(id: string): Promise<Result<Credential>> {
    return this.request<Credential>('GET', `/api/credentials/${id}`)
  }

  create(input: CreateCredential): Promise<Result<Credential>> {
    return this.request<Credential>('POST', '/api/credentials', input)
  }

  update(id: string, input: UpdateCredential): Promise<Result<Credential>> {
    return this.request<Credential>('PATCH', `/api/credentials/${id}`, input)
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/credentials/${id}`)
  }
}
