/**
 * WhereClause routing for the HelixDB adapter.
 *
 * Analyzes a WhereClause and determines which pre-compiled HQL query to use:
 *   Tier 1 — direct query routing (list, getBy, listFrom, listTo): ~95% of calls
 *   Tier 2 — parameterized filter queries (filterIn, filterLike, filterGt, etc.): ~4%
 *   Tier 3 — client-side fallback via filterInTypeScript ($and, $or, complex): ~1%
 *
 * Also exports filterInTypeScript() for Tier 3 client-side filtering.
 */

import type { WhereClause, WhereValue } from '../../adapter-types'
import type { EdgeMeta } from './helix-classify'

// ─── Route result types ────────────────────────────────────────────────────

export type Strategy =
  | 'list'
  | 'getBy'
  | 'listFrom'
  | 'listTo'
  | 'filterIn'
  | 'filterLike'
  | 'filterGt'
  | 'filterGte'
  | 'filterLt'
  | 'filterLte'
  | 'filterNe'
  | 'filterIsNull'
  | 'filterIsNotNull'
  | 'clientFilter'

export interface RouteResult {
  tier: 1 | 2 | 3
  strategy: Strategy
  /** For getBy: the field→value map. For listFrom/listTo: { id: <value> } */
  params?: Record<string, unknown>
  /** For tier 2 operator queries: the field being filtered on */
  field?: string
  /** Original where clause, preserved for tier 3 client-side filtering */
  originalWhere?: WhereClause
}

// ─── Type guards ───────────────────────────────────────────────────────────

function isCompoundWhere(where: WhereClause): where is { $and?: WhereClause[]; $or?: WhereClause[] } {
  return '$and' in where || '$or' in where
}

function isOperatorValue(value: WhereValue): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ─── Routing logic ─────────────────────────────────────────────────────────

/**
 * Route a WhereClause to the appropriate HQL query tier/strategy.
 *
 * @param entityType - The entity being queried (e.g. 'bullets', 'bullet_skills')
 * @param where - The WhereClause (or undefined for a full list)
 * @param edges - Set of entity names classified as edges
 * @param edgeMeta - Map of edge entity name → EdgeMeta
 */
export function routeWhereClause(
  entityType: string,
  where: WhereClause | undefined,
  edges: Set<string>,
  edgeMeta: Map<string, EdgeMeta>,
): RouteResult {
  // No where clause → Tier 1 list
  if (!where) {
    return { tier: 1, strategy: 'list' }
  }

  // Compound where ($and/$or) → Tier 3 client-side
  if (isCompoundWhere(where)) {
    return { tier: 3, strategy: 'clientFilter', originalWhere: where }
  }

  // At this point we have a SimpleWhere
  const entries = Object.entries(where)

  // Check for operator values (non-equality)
  // If any field has an operator, route to tier 2
  for (const [field, value] of entries) {
    if (isOperatorValue(value)) {
      const op = value as Record<string, unknown>

      if ('$in' in op) return { tier: 2, strategy: 'filterIn', field, originalWhere: where }
      if ('$like' in op) return { tier: 2, strategy: 'filterLike', field, originalWhere: where }
      if ('$gt' in op) return { tier: 2, strategy: 'filterGt', field, originalWhere: where }
      if ('$gte' in op) return { tier: 2, strategy: 'filterGte', field, originalWhere: where }
      if ('$lt' in op) return { tier: 2, strategy: 'filterLt', field, originalWhere: where }
      if ('$lte' in op) return { tier: 2, strategy: 'filterLte', field, originalWhere: where }
      if ('$ne' in op) return { tier: 2, strategy: 'filterNe', field, originalWhere: where }
      if ('$isNull' in op) return { tier: 2, strategy: 'filterIsNull', field, originalWhere: where }
      if ('$isNotNull' in op) return { tier: 2, strategy: 'filterIsNotNull', field, originalWhere: where }

      // Unknown operator shape → tier 3 fallback
      return { tier: 3, strategy: 'clientFilter', originalWhere: where }
    }
  }

  // All values are simple equality. Check if this is an edge entity.
  if (edges.has(entityType)) {
    const meta = edgeMeta.get(entityType)
    if (meta && entries.length === 1) {
      const [field, value] = entries[0]
      if (field === meta.fromField) {
        return { tier: 1, strategy: 'listFrom', params: { id: value as string } }
      }
      if (field === meta.toField) {
        return { tier: 1, strategy: 'listTo', params: { id: value as string } }
      }
    }
  }

  // Simple equality on one or more fields → Tier 1 getBy
  const params: Record<string, unknown> = {}
  for (const [field, value] of entries) {
    params[field] = value
  }
  return { tier: 1, strategy: 'getBy', params }
}

// ─── Client-side filtering (Tier 3) ───────────────────────────────────────

/**
 * Filter an array of rows using a WhereClause entirely in TypeScript.
 * Used as the Tier 3 fallback when no pre-compiled HQL query can handle
 * the clause shape.
 */
export function filterInTypeScript<T extends Record<string, unknown>>(
  rows: T[],
  where: WhereClause | undefined,
): T[] {
  if (!where) return rows
  return rows.filter((row) => matchesWhere(row, where))
}

function matchesWhere(row: Record<string, unknown>, where: WhereClause): boolean {
  if (isCompoundWhere(where)) {
    return matchesCompound(row, where as { $and?: WhereClause[]; $or?: WhereClause[] })
  }

  // SimpleWhere: all fields must match (implicit AND)
  for (const [field, value] of Object.entries(where)) {
    if (!matchesField(row, field, value as WhereValue)) {
      return false
    }
  }
  return true
}

function matchesCompound(
  row: Record<string, unknown>,
  where: { $and?: WhereClause[]; $or?: WhereClause[] },
): boolean {
  if (where.$and) {
    if (!where.$and.every((clause) => matchesWhere(row, clause))) {
      return false
    }
  }
  if (where.$or) {
    if (!where.$or.some((clause) => matchesWhere(row, clause))) {
      return false
    }
  }
  return true
}

function matchesField(row: Record<string, unknown>, field: string, value: WhereValue): boolean {
  const actual = row[field]

  // Null equality
  if (value === null) {
    return actual === null || actual === undefined
  }

  // Primitive equality
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return actual === value
  }

  // Operator object
  if (isOperatorValue(value)) {
    const op = value as Record<string, unknown>

    if ('$in' in op) {
      const arr = op.$in as (string | number)[]
      return arr.includes(actual as string | number)
    }

    if ('$ne' in op) {
      if (op.$ne === null) return actual !== null && actual !== undefined
      return actual !== op.$ne
    }

    if ('$like' in op) {
      return matchesLike(String(actual), op.$like as string)
    }

    if ('$gt' in op) {
      return actual != null && (actual as string | number) > (op.$gt as string | number)
    }
    if ('$gte' in op) {
      return actual != null && (actual as string | number) >= (op.$gte as string | number)
    }
    if ('$lt' in op) {
      return actual != null && (actual as string | number) < (op.$lt as string | number)
    }
    if ('$lte' in op) {
      return actual != null && (actual as string | number) <= (op.$lte as string | number)
    }

    if ('$isNull' in op && op.$isNull === true) {
      return actual === null || actual === undefined
    }
    if ('$isNotNull' in op && op.$isNotNull === true) {
      return actual !== null && actual !== undefined
    }
  }

  // Unknown → no match
  return false
}

/**
 * Convert a SQL LIKE pattern to a regex and test it.
 * '%' → '.*', '_' → '.', everything else is escaped.
 */
function matchesLike(value: string, pattern: string): boolean {
  let regex = '^'
  for (const ch of pattern) {
    if (ch === '%') regex += '.*'
    else if (ch === '_') regex += '.'
    else regex += escapeRegex(ch)
  }
  regex += '$'
  return new RegExp(regex, 'i').test(value)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
