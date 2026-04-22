/**
 * WhereClause → SQL translator for the SQLite adapter.
 *
 * Converts the backend-agnostic WhereClause DSL (from adapter-types.ts)
 * into a parameterized SQL WHERE fragment. Supports:
 *   - equality: { field: value }
 *   - operators: $in, $ne, $like, $gt, $gte, $lt, $lte, $isNull, $isNotNull
 *   - compound: { $and: [...], $or: [...] }
 */

import type { WhereClause, WhereValue } from '../adapter-types'

export interface CompiledWhere {
  /** SQL fragment (without leading WHERE keyword). */
  clause: string
  /** Parameter values in positional order. */
  values: unknown[]
}

/**
 * Compile a WhereClause into a parameterized SQL fragment.
 * Returns { clause: '', values: [] } for empty/null where.
 */
export function buildWhereClause(where: WhereClause | undefined): CompiledWhere {
  if (!where) return { clause: '', values: [] }
  return compileClause(where)
}

function compileClause(where: WhereClause): CompiledWhere {
  // Compound clause?
  if ('$and' in where || '$or' in where) {
    return compileCompound(where as { $and?: WhereClause[]; $or?: WhereClause[] })
  }

  // Simple clause — AND-join each field condition
  const parts: string[] = []
  const values: unknown[] = []

  for (const [field, value] of Object.entries(where)) {
    const { clause, values: v } = compileFieldCondition(field, value as WhereValue)
    parts.push(clause)
    values.push(...v)
  }

  if (parts.length === 0) return { clause: '', values: [] }
  return { clause: parts.join(' AND '), values }
}

function compileCompound(where: {
  $and?: WhereClause[]
  $or?: WhereClause[]
}): CompiledWhere {
  const parts: string[] = []
  const values: unknown[] = []

  if (where.$and && where.$and.length > 0) {
    const sub = where.$and.map(compileClause)
    const clause = sub
      .filter((s) => s.clause.length > 0)
      .map((s) => `(${s.clause})`)
      .join(' AND ')
    if (clause.length > 0) {
      parts.push(clause)
      sub.forEach((s) => values.push(...s.values))
    }
  }

  if (where.$or && where.$or.length > 0) {
    const sub = where.$or.map(compileClause)
    const clause = sub
      .filter((s) => s.clause.length > 0)
      .map((s) => `(${s.clause})`)
      .join(' OR ')
    if (clause.length > 0) {
      parts.push(`(${clause})`)
      sub.forEach((s) => values.push(...s.values))
    }
  }

  return { clause: parts.join(' AND '), values }
}

function compileFieldCondition(
  field: string,
  value: WhereValue,
): CompiledWhere {
  // Primitive equality / null
  if (value === null) {
    return { clause: `${quoteIdent(field)} IS NULL`, values: [] }
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return {
      clause: `${quoteIdent(field)} = ?`,
      values: [serializeValue(value)],
    }
  }

  // Operator object
  if (typeof value === 'object' && value !== null) {
    const op = value as Record<string, unknown>

    if ('$in' in op) {
      const arr = op.$in as (string | number)[]
      if (arr.length === 0) {
        // IN () is invalid SQL; match nothing
        return { clause: '0 = 1', values: [] }
      }
      const placeholders = arr.map(() => '?').join(', ')
      return {
        clause: `${quoteIdent(field)} IN (${placeholders})`,
        values: arr,
      }
    }

    if ('$ne' in op) {
      const v = op.$ne
      if (v === null) {
        return { clause: `${quoteIdent(field)} IS NOT NULL`, values: [] }
      }
      return {
        clause: `${quoteIdent(field)} != ?`,
        values: [v],
      }
    }

    if ('$like' in op) {
      return {
        clause: `${quoteIdent(field)} LIKE ?`,
        values: [op.$like],
      }
    }

    if ('$gt' in op) {
      return {
        clause: `${quoteIdent(field)} > ?`,
        values: [op.$gt],
      }
    }
    if ('$gte' in op) {
      return {
        clause: `${quoteIdent(field)} >= ?`,
        values: [op.$gte],
      }
    }
    if ('$lt' in op) {
      return {
        clause: `${quoteIdent(field)} < ?`,
        values: [op.$lt],
      }
    }
    if ('$lte' in op) {
      return {
        clause: `${quoteIdent(field)} <= ?`,
        values: [op.$lte],
      }
    }

    if ('$isNull' in op && op.$isNull === true) {
      return { clause: `${quoteIdent(field)} IS NULL`, values: [] }
    }
    if ('$isNotNull' in op && op.$isNotNull === true) {
      return { clause: `${quoteIdent(field)} IS NOT NULL`, values: [] }
    }
  }

  throw new Error(
    `buildWhereClause: unsupported value for field "${field}": ${JSON.stringify(value)}`,
  )
}

/**
 * Quote a field name for SQLite using double quotes. This is safe for
 * legitimate column names that came from the entity map; the caller is
 * responsible for ensuring identifiers aren't attacker-controlled.
 */
function quoteIdent(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`)
  }
  return `"${name}"`
}

/**
 * Serialize a canonical JS value to SQLite storage format.
 * Booleans become integers; everything else passes through.
 *
 * This is used on the adapter WRITE path. READ values stay raw (see
 * Section 8.1 of the Phase 0 spec — integrity layer deserializes).
 */
export function serializeValue(value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value instanceof Float32Array || value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Buffer)
  ) {
    return JSON.stringify(value)
  }
  return value
}
