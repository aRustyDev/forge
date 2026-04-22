import type { ExtensionLog, CreateExtensionLog, ExtensionLogFilter, RequestFn, Result } from '../types'

export class ExtensionLogsResource {
  constructor(private request: RequestFn) {}

  /** Append an error log entry. */
  append(entry: CreateExtensionLog): Promise<Result<ExtensionLog>> {
    return this.request<ExtensionLog>('POST', '/api/extension/log', entry)
  }

  /** List log entries with optional filters. */
  async list(opts?: ExtensionLogFilter): Promise<Result<ExtensionLog[]>> {
    const params = new URLSearchParams()
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
    if (opts?.offset !== undefined) params.set('offset', String(opts.offset))
    if (opts?.error_code) params.set('error_code', opts.error_code)
    if (opts?.layer) params.set('layer', opts.layer)
    const qs = params.toString()
    const path = qs ? `/api/extension/logs?${qs}` : '/api/extension/logs'
    return this.request<ExtensionLog[]>('GET', path)
  }

  /** Clear all log entries. */
  clear(): Promise<Result<void>> {
    return this.request<void>('DELETE', '/api/extension/logs')
  }
}
