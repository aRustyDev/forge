import type { DriftReport, RequestFn, Result } from '../types'

export class IntegrityResource {
  constructor(private request: RequestFn) {}

  drift(): Promise<Result<DriftReport>> {
    return this.request<DriftReport>('GET', '/api/integrity/drift')
  }
}
