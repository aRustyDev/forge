/**
 * ExtensionLogService — server-side storage for browser extension errors.
 *
 * Uses ELM for standard CRUD. Logs are append-only (no update).
 * The `context` field is stored as a JSON string in SQLite but
 * parsed to an object when returned.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { Result } from '../types'

export interface ExtensionLog {
  id: string
  error_code: string
  message: string
  layer: string
  plugin: string | null
  url: string | null
  context: Record<string, unknown> | null
  created_at: string
}

export interface CreateExtensionLog {
  error_code: string
  message: string
  layer: string
  plugin?: string
  url?: string
  context?: Record<string, unknown>
}

export interface ExtensionLogFilter {
  limit?: number
  offset?: number
  error_code?: string
  layer?: string
}

export class ExtensionLogService {
  constructor(private elm: EntityLifecycleManager) {}

  /** Append a new log entry. */
  async append(input: CreateExtensionLog): Promise<Result<ExtensionLog>> {
    if (!input.error_code || input.error_code.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'error_code is required' } }
    }
    if (!input.message || input.message.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'message is required' } }
    }
    if (!input.layer || input.layer.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'layer is required' } }
    }

    const createResult = await this.elm.create('extension_logs', {
      error_code: input.error_code,
      message: input.message,
      layer: input.layer,
      plugin: input.plugin ?? null,
      url: input.url ?? null,
      context: input.context ? JSON.stringify(input.context) : null,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    const fetched = await this.elm.get('extension_logs', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: this.parseRow(fetched.value) }
  }

  /** List log entries with optional filters, ordered by created_at DESC. */
  async list(opts?: ExtensionLogFilter): Promise<Result<ExtensionLog[]>> {
    const where: Record<string, unknown> = {}
    if (opts?.error_code) where.error_code = opts.error_code
    if (opts?.layer) where.layer = opts.layer

    const listResult = await this.elm.list('extension_logs', {
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [
        { field: 'created_at', direction: 'desc' },
        { field: 'rowid', direction: 'desc' },
      ],
      limit: opts?.limit ?? 50,
      offset: opts?.offset ?? 0,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return {
      ok: true,
      data: listResult.value.rows.map(row => this.parseRow(row)),
    }
  }

  /** Delete all log entries. Returns count of deleted rows. */
  async clear(): Promise<Result<{ deleted: number }>> {
    const allResult = await this.elm.list('extension_logs', { limit: 10000 })
    if (!allResult.ok) {
      return { ok: false, error: storageErrorToForgeError(allResult.error) }
    }
    const rows = allResult.value.rows as unknown as Array<{ id: string }>
    for (const row of rows) {
      await this.elm.delete('extension_logs', row.id)
    }
    return { ok: true, data: { deleted: rows.length } }
  }

  /** Parse a raw DB row, deserializing the context JSON. */
  private parseRow(row: unknown): ExtensionLog {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      error_code: r.error_code as string,
      message: r.message as string,
      layer: r.layer as string,
      plugin: (r.plugin as string) ?? null,
      url: (r.url as string) ?? null,
      context: r.context ? JSON.parse(r.context as string) : null,
      created_at: r.created_at as string,
    }
  }
}
