/**
 * ExtensionConfigService — key-value config for the browser extension.
 *
 * Uses raw SQL (not ELM) because extension_config uses TEXT primary key
 * `key` instead of UUID `id`, which doesn't fit the ELM pattern.
 */

import type { Database } from 'bun:sqlite'
import type { Result } from '../types'

export interface ExtensionConfig {
  baseUrl: string
  devMode: boolean
  enabledPlugins: string[]
  enableServerLogging: boolean
}

const DEFAULTS: ExtensionConfig = {
  baseUrl: 'http://localhost:3000',
  devMode: false,
  enabledPlugins: ['linkedin'],
  enableServerLogging: true,
}

const VALID_KEYS = new Set(Object.keys(DEFAULTS))

export class ExtensionConfigService {
  constructor(private db: Database) {}

  /** Get all config keys merged over defaults. */
  getAll(): Result<ExtensionConfig> {
    const rows = this.db.query('SELECT key, value FROM extension_config').all() as Array<{ key: string; value: string }>
    const config = { ...DEFAULTS }
    for (const row of rows) {
      if (row.key in config) {
        (config as Record<string, unknown>)[row.key] = JSON.parse(row.value)
      }
    }
    return { ok: true, data: config }
  }

  /** Get a single config value by key. */
  get(key: string): Result<unknown> {
    if (!VALID_KEYS.has(key)) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Unknown config key: ${key}` } }
    }
    const row = this.db.query('SELECT value FROM extension_config WHERE key = ?').get(key) as { value: string } | null
    if (!row) {
      return { ok: true, data: (DEFAULTS as Record<string, unknown>)[key] }
    }
    return { ok: true, data: JSON.parse(row.value) }
  }

  /** Set a single config key. Returns full config after update. */
  set(key: string, value: unknown): Result<ExtensionConfig> {
    if (!VALID_KEYS.has(key)) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Unknown config key: ${key}` } }
    }
    this.db.run(
      `INSERT INTO extension_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value)],
    )
    return this.getAll()
  }

  /** Set multiple config keys at once. Returns full config after update. */
  setMany(updates: Record<string, unknown>): Result<ExtensionConfig> {
    for (const key of Object.keys(updates)) {
      if (!VALID_KEYS.has(key)) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Unknown config key: ${key}` } }
      }
    }
    const stmt = this.db.prepare(
      `INSERT INTO extension_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    for (const [key, value] of Object.entries(updates)) {
      stmt.run(key, JSON.stringify(value))
    }
    return this.getAll()
  }
}
