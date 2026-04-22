import type { ExtensionConfig, RequestFn, Result } from '../types'

export class ExtensionConfigResource {
  constructor(private request: RequestFn) {}

  /** Get full extension config (merged over defaults). */
  get(): Promise<Result<ExtensionConfig>> {
    return this.request<ExtensionConfig>('GET', '/api/extension/config')
  }

  /** Update one or more config keys. Returns full config after update. */
  update(updates: Record<string, unknown>): Promise<Result<ExtensionConfig>> {
    return this.request<ExtensionConfig>('PUT', '/api/extension/config', { updates })
  }
}
