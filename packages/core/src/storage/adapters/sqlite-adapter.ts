/**
 * SqliteAdapter — concrete StorageAdapter backed by bun:sqlite.
 *
 * Generic SQL generation using the entity map. Does NOT reuse existing
 * repository classes; each CRUD operation is a direct prepared statement.
 *
 * Responsibilities (all covered):
 *   - CRUD: create/get/update/delete/list/count
 *   - Bulk: deleteWhere/updateWhere
 *   - Transactions: beginTransaction returns SqliteTransaction
 *   - Named queries: delegated to named-query handlers
 *   - Serialization on WRITE (bool → int, object → JSON, Float32 → Buffer)
 *   - Raw rows on READ (integrity layer deserializes)
 */

import type { Database, Statement } from 'bun:sqlite'

import type {
  StorageAdapter,
  Transaction,
} from '../adapter'
import type {
  AdapterCapabilities,
  ListOptions,
  ListResult,
  WhereClause,
} from '../adapter-types'
import { adapterError } from '../errors'
import { buildWhereClause, serializeValue } from './sqlite-where'

// ─── Identifier safety ────────────────────────────────────────────────────

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/
function assertSafeIdent(name: string): void {
  if (!SAFE_IDENT.test(name)) {
    throw new Error(`SqliteAdapter: unsafe identifier "${name}"`)
  }
}

function quoteIdent(name: string): string {
  assertSafeIdent(name)
  return `"${name}"`
}

// ─── SqliteAdapter ────────────────────────────────────────────────────────

export interface SqliteAdapterOptions {
  /** Registered named-query handlers. Each is called with (db, params). */
  namedQueries?: Record<
    string,
    (db: Database, params: Record<string, unknown>) => unknown | Promise<unknown>
  >
  /**
   * Optional UUID generator for auto-generated primary keys.
   * Defaults to crypto.randomUUID() (Node 20+ / Bun).
   */
  generateId?: () => string
}

export class SqliteAdapter implements StorageAdapter {
  public readonly capabilities: AdapterCapabilities = {
    graph: false,
    vector: false,
    transactions: true,
    nativeCascade: true, // SQLite enforces FK cascade; integrity layer double-cascades harmlessly
  }

  private readonly namedQueries: NonNullable<SqliteAdapterOptions['namedQueries']>
  private readonly generateId: () => string
  private connected = true

  constructor(
    private readonly db: Database,
    options: SqliteAdapterOptions = {},
  ) {
    this.namedQueries = options.namedQueries ?? {}
    this.generateId = options.generateId ?? (() => crypto.randomUUID())
  }

  // ─── Single-entity CRUD ───

  async create(
    entityType: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string }> {
    assertSafeIdent(entityType)
    // The adapter does NOT auto-generate id. The EntityLifecycleManager
    // handles id generation for entities that have an id column, via
    // its entity-map-aware applyDefaults. Junction tables (composite PK,
    // no id) are passed through untouched.
    const fields = Object.keys(data)
    if (fields.length === 0) {
      throw new Error(`SqliteAdapter.create: no fields provided for ${entityType}`)
    }
    fields.forEach(assertSafeIdent)

    const placeholders = fields.map(() => '?').join(', ')
    const sql = `INSERT INTO ${quoteIdent(entityType)} (${fields
      .map(quoteIdent)
      .join(', ')}) VALUES (${placeholders})`

    try {
      this.db.prepare(sql).run(...fields.map((f) => serializeValue(data[f])) as never[])
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }

    // Return the id if present; otherwise return empty string (caller
    // should not expect an id from junction tables).
    return { id: typeof data.id === 'string' ? data.id : '' }
  }

  async get(
    entityType: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    assertSafeIdent(entityType)
    try {
      const row = this.db
        .prepare(`SELECT * FROM ${quoteIdent(entityType)} WHERE "id" = ?`)
        .get(id) as Record<string, unknown> | null
      return row ?? null
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async update(
    entityType: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    assertSafeIdent(entityType)
    const fields = Object.keys(data)
    if (fields.length === 0) return

    fields.forEach(assertSafeIdent)
    const setClauses = fields.map((f) => `${quoteIdent(f)} = ?`).join(', ')
    const sql = `UPDATE ${quoteIdent(entityType)} SET ${setClauses} WHERE "id" = ?`

    try {
      this.db.prepare(sql).run(
        ...fields.map((f) => serializeValue(data[f])) as never[],
        id,
      )
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async delete(entityType: string, id: string): Promise<void> {
    assertSafeIdent(entityType)
    try {
      this.db
        .prepare(`DELETE FROM ${quoteIdent(entityType)} WHERE "id" = ?`)
        .run(id)
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  // ─── Bulk operations ───

  async list(entityType: string, opts: ListOptions = {}): Promise<ListResult> {
    assertSafeIdent(entityType)
    const { clause: whereClause, values: whereValues } = buildWhereClause(opts.where)

    let sql = `SELECT * FROM ${quoteIdent(entityType)}`
    let countSql = `SELECT COUNT(*) as total FROM ${quoteIdent(entityType)}`

    if (whereClause) {
      sql += ` WHERE ${whereClause}`
      countSql += ` WHERE ${whereClause}`
    }

    if (opts.orderBy && opts.orderBy.length > 0) {
      opts.orderBy.forEach((o) => assertSafeIdent(o.field))
      sql +=
        ' ORDER BY ' +
        opts.orderBy
          .map(
            (o) =>
              `${quoteIdent(o.field)} ${o.direction === 'desc' ? 'DESC' : 'ASC'}`,
          )
          .join(', ')
    }

    const pageValues: unknown[] = []
    if (opts.limit != null) {
      sql += ' LIMIT ?'
      pageValues.push(opts.limit)
      if (opts.offset != null) {
        sql += ' OFFSET ?'
        pageValues.push(opts.offset)
      }
    }

    try {
      const rows = this.db
        .prepare(sql)
        .all(...whereValues as never[], ...pageValues as never[]) as Record<
          string,
          unknown
        >[]
      const totalRow = this.db
        .prepare(countSql)
        .get(...whereValues as never[]) as { total: number } | null
      return { rows, total: totalRow?.total ?? 0 }
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async count(entityType: string, where?: WhereClause): Promise<number> {
    assertSafeIdent(entityType)
    const { clause, values } = buildWhereClause(where)
    let sql = `SELECT COUNT(*) as total FROM ${quoteIdent(entityType)}`
    if (clause) sql += ` WHERE ${clause}`
    try {
      const row = this.db.prepare(sql).get(...values as never[]) as {
        total: number
      } | null
      return row?.total ?? 0
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async deleteWhere(
    entityType: string,
    where: WhereClause,
  ): Promise<number> {
    assertSafeIdent(entityType)
    const { clause, values } = buildWhereClause(where)
    if (!clause) {
      throw new Error(
        'SqliteAdapter.deleteWhere requires a non-empty WhereClause',
      )
    }
    try {
      const result = this.db
        .prepare(`DELETE FROM ${quoteIdent(entityType)} WHERE ${clause}`)
        .run(...values as never[])
      return result.changes
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async updateWhere(
    entityType: string,
    where: WhereClause,
    data: Record<string, unknown>,
  ): Promise<number> {
    assertSafeIdent(entityType)
    const fields = Object.keys(data)
    if (fields.length === 0) return 0
    fields.forEach(assertSafeIdent)

    const { clause, values: whereValues } = buildWhereClause(where)
    if (!clause) {
      throw new Error(
        'SqliteAdapter.updateWhere requires a non-empty WhereClause',
      )
    }

    const setClauses = fields.map((f) => `${quoteIdent(f)} = ?`).join(', ')
    try {
      const result = this.db
        .prepare(
          `UPDATE ${quoteIdent(entityType)} SET ${setClauses} WHERE ${clause}`,
        )
        .run(
          ...fields.map((f) => serializeValue(data[f])) as never[],
          ...whereValues as never[],
        )
      return result.changes
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  // ─── Transactions ───

  async beginTransaction(): Promise<Transaction> {
    this.db.exec('BEGIN')
    return new SqliteTransaction(this.db, this.generateId)
  }

  // ─── Named queries ───

  async executeNamedQuery(
    name: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const handler = this.namedQueries[name]
    if (!handler) {
      throw new Error(
        `SqliteAdapter: named query "${name}" is not registered`,
      )
    }
    try {
      return await handler(this.db, params)
    } catch (err) {
      throw wrapSqliteError(err)
    }
  }

  // ─── Lifecycle ───

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
    // Note: we don't close the bun:sqlite Database here — the caller owns
    // the connection lifecycle (core/index.ts creates and holds it).
  }

  isConnected(): boolean {
    return this.connected
  }
}

// ─── SqliteTransaction ─────────────────────────────────────────────────────
//
// Wraps a bun:sqlite connection inside an explicit BEGIN/COMMIT/ROLLBACK.
// bun:sqlite has a higher-level `db.transaction(fn)` API, but we need the
// explicit form to match the async StorageAdapter.beginTransaction contract
// (the integrity layer can interleave user logic between tx operations).

export class SqliteTransaction implements Transaction {
  private state: 'open' | 'committed' | 'rolled_back' = 'open'

  constructor(
    private readonly db: Database,
    private readonly generateId: () => string,
  ) {}

  private assertOpen(): void {
    if (this.state !== 'open') {
      throw new Error(
        `SqliteTransaction: cannot operate on ${this.state} transaction`,
      )
    }
  }

  async create(
    entityType: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string }> {
    this.assertOpen()
    assertSafeIdent(entityType)
    // Same pass-through convention as SqliteAdapter.create — the
    // lifecycle manager handles id generation.
    const fields = Object.keys(data)
    if (fields.length === 0) {
      throw new Error(`SqliteTransaction.create: no fields provided for ${entityType}`)
    }
    fields.forEach(assertSafeIdent)
    const placeholders = fields.map(() => '?').join(', ')
    const sql = `INSERT INTO ${quoteIdent(entityType)} (${fields
      .map(quoteIdent)
      .join(', ')}) VALUES (${placeholders})`
    try {
      this.db
        .prepare(sql)
        .run(...fields.map((f) => serializeValue(data[f])) as never[])
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
    return { id: typeof data.id === 'string' ? data.id : '' }
  }

  async get(
    entityType: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    this.assertOpen()
    assertSafeIdent(entityType)
    try {
      const row = this.db
        .prepare(`SELECT * FROM ${quoteIdent(entityType)} WHERE "id" = ?`)
        .get(id) as Record<string, unknown> | null
      return row ?? null
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async update(
    entityType: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.assertOpen()
    assertSafeIdent(entityType)
    const fields = Object.keys(data)
    if (fields.length === 0) return
    fields.forEach(assertSafeIdent)
    const setClauses = fields.map((f) => `${quoteIdent(f)} = ?`).join(', ')
    try {
      this.db
        .prepare(
          `UPDATE ${quoteIdent(entityType)} SET ${setClauses} WHERE "id" = ?`,
        )
        .run(
          ...fields.map((f) => serializeValue(data[f])) as never[],
          id,
        )
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async delete(entityType: string, id: string): Promise<void> {
    this.assertOpen()
    assertSafeIdent(entityType)
    try {
      this.db
        .prepare(`DELETE FROM ${quoteIdent(entityType)} WHERE "id" = ?`)
        .run(id)
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async deleteWhere(
    entityType: string,
    where: WhereClause,
  ): Promise<number> {
    this.assertOpen()
    assertSafeIdent(entityType)
    const { clause, values } = buildWhereClause(where)
    if (!clause) {
      throw new Error(
        'SqliteTransaction.deleteWhere requires a non-empty WhereClause',
      )
    }
    try {
      const result = this.db
        .prepare(`DELETE FROM ${quoteIdent(entityType)} WHERE ${clause}`)
        .run(...values as never[])
      return result.changes
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async updateWhere(
    entityType: string,
    where: WhereClause,
    data: Record<string, unknown>,
  ): Promise<number> {
    this.assertOpen()
    assertSafeIdent(entityType)
    const fields = Object.keys(data)
    if (fields.length === 0) return 0
    fields.forEach(assertSafeIdent)
    const { clause, values: whereValues } = buildWhereClause(where)
    if (!clause) {
      throw new Error(
        'SqliteTransaction.updateWhere requires a non-empty WhereClause',
      )
    }
    const setClauses = fields.map((f) => `${quoteIdent(f)} = ?`).join(', ')
    try {
      const result = this.db
        .prepare(
          `UPDATE ${quoteIdent(entityType)} SET ${setClauses} WHERE ${clause}`,
        )
        .run(
          ...fields.map((f) => serializeValue(data[f])) as never[],
          ...whereValues as never[],
        )
      return result.changes
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async count(entityType: string, where?: WhereClause): Promise<number> {
    this.assertOpen()
    assertSafeIdent(entityType)
    const { clause, values } = buildWhereClause(where)
    let sql = `SELECT COUNT(*) as total FROM ${quoteIdent(entityType)}`
    if (clause) sql += ` WHERE ${clause}`
    try {
      const row = this.db.prepare(sql).get(...values as never[]) as {
        total: number
      } | null
      return row?.total ?? 0
    } catch (err) {
      throw wrapSqliteError(err, entityType)
    }
  }

  async commit(): Promise<void> {
    this.assertOpen()
    try {
      this.db.exec('COMMIT')
      this.state = 'committed'
    } catch (err) {
      throw wrapSqliteError(err)
    }
  }

  async rollback(): Promise<void> {
    if (this.state !== 'open') return
    try {
      this.db.exec('ROLLBACK')
    } catch {
      // Rollback may fail if the transaction was already aborted.
    }
    this.state = 'rolled_back'
  }
}

// ─── Error wrapping ────────────────────────────────────────────────────────

/**
 * Wrap a bun:sqlite error as a StorageError. Does NOT map specific codes
 * (e.g. UNIQUE violation → UNIQUE_VIOLATION); that's the integrity layer's
 * responsibility since it owns constraint semantics. Here we just annotate.
 */
function wrapSqliteError(err: unknown, entityType?: string): Error {
  const message = err instanceof Error ? err.message : String(err)
  const e = new Error(`[sqlite-adapter${entityType ? `:${entityType}` : ''}] ${message}`)
  ;(e as Error & { storageError?: unknown }).storageError = adapterError(
    message,
    err,
    entityType,
  )
  return e
}

// Suppress unused import linting — Statement is used implicitly via this.db
void ({} as Statement)
