import type {
  BulletCommitInput,
  PerspectiveCommitInput,
  PrepareResult,
  RequestFn,
  Result,
} from '../types'

export class DerivationsResource {
  constructor(private request: RequestFn) {}

  prepare(input: {
    entity_type: 'source' | 'bullet'
    entity_id: string
    client_id: string
    params?: { archetype: string; domain: string; framing: string }
  }): Promise<Result<PrepareResult>> {
    return this.request<PrepareResult>('POST', '/api/derivations/prepare', input)
  }

  commitBullets(derivationId: string, input: BulletCommitInput): Promise<Result<unknown[]>> {
    return this.request<unknown[]>('POST', `/api/derivations/${derivationId}/commit`, input)
  }

  commitPerspective(derivationId: string, input: PerspectiveCommitInput): Promise<Result<unknown>> {
    return this.request<unknown>('POST', `/api/derivations/${derivationId}/commit`, input)
  }
}
