/**
 * Adapter-facing types: the types that the StorageAdapter interface speaks.
 *
 * These are the "thin adapter" primitives — WhereClause, ListOptions,
 * ListResult, ReadOptions, AdapterCapabilities. Domain types (Bullet,
 * Perspective, etc.) live in entity-types.ts.
 */

// ─── WhereClause ──────────────────────────────────────────────────────────
//
// Expressive enough for integrity layer's needs (FK checks, cascade deletes,
// junction queries) and basic service filters. Not a full query language;
// complex queries go through named queries.

/**
 * Operators supported by the WhereClause value syntax.
 *
 *   { status: 'draft' }                            equality
 *   { status: { $ne: 'archived' } }                not equal
 *   { status: { $in: ['draft', 'in_review'] } }    set membership
 *   { title: { $like: '%remote%' } }               pattern match
 *   { salary_min: { $gt: 100000 } }                comparison
 *   { updated_at: { $gte: '2026-01-01' } }
 *   { last_derived_at: { $isNull: true } }
 *   { notes: { $isNotNull: true } }
 */
export type WhereValue =
  | string
  | number
  | boolean
  | null
  | { $in: (string | number)[] }
  | { $ne: string | number | null }
  | { $like: string }
  | { $gt: number | string }
  | { $gte: number | string }
  | { $lt: number | string }
  | { $lte: number | string }
  | { $isNull: true }
  | { $isNotNull: true }

/** Simple where: field → value mapping (implicit AND between fields). */
export type SimpleWhere = Record<string, WhereValue>

/** Compound where: $and / $or combinators for complex filters. */
export type CompoundWhere = {
  $and?: WhereClause[]
  $or?: WhereClause[]
}

export type WhereClause = SimpleWhere | CompoundWhere

// ─── List/Read options ─────────────────────────────────────────────────────

export interface OrderBy {
  field: string
  direction: 'asc' | 'desc'
}

export interface ListOptions {
  where?: WhereClause
  orderBy?: OrderBy[]
  limit?: number
  offset?: number
}

/**
 * Opt-in flags for reads. Controls lazy field materialization.
 *
 * Fields marked `lazy: true` in the entity map (e.g. embedding vectors,
 * large JSON blobs) are NOT deserialized by default. Callers opt in by
 * passing `includeLazy: true` (all lazy fields) or an array of field names.
 */
export interface ReadOptions {
  includeLazy?: boolean | string[]
}

export interface ListResult {
  rows: Record<string, unknown>[]
  total: number
}

// ─── Capability detection ──────────────────────────────────────────────────

/**
 * Describes which optional capabilities an adapter supports.
 * Used by the integrity layer to decide whether to provide software
 * fallbacks (e.g. cascade in code vs. relying on native FK cascades).
 */
export interface AdapterCapabilities {
  /** Adapter implements GraphCapableAdapter sub-interface. */
  graph: boolean
  /** Adapter implements VectorCapableAdapter sub-interface. */
  vector: boolean
  /** Adapter supports transactions. */
  transactions: boolean
  /**
   * Hint: the backend natively enforces cascade/restrict/setNull rules.
   * When true, the integrity layer can skip redundant cascade operations.
   * The SQLite adapter sets this true since the DB has ON DELETE CASCADE
   * FKs; but the integrity layer cascades anyway (harmless double-delete).
   */
  nativeCascade: boolean
}

// ─── Graph capability (optional sub-interface) ─────────────────────────────

export interface EntityRef {
  entityType: string
  id: string
}

export interface TraversalResult {
  nodes: Array<{ entityType: string; id: string; data: Record<string, unknown> }>
  edges: Array<{ from: EntityRef; to: EntityRef; edgeType: string }>
}

export interface PathResult {
  nodes: EntityRef[]
  length: number
}

export interface SubgraphResult {
  root: EntityRef
  nodes: Array<{ entityType: string; id: string; data: Record<string, unknown> }>
  edges: Array<{ from: EntityRef; to: EntityRef; edgeType: string }>
}

// ─── Vector capability (optional sub-interface) ────────────────────────────

export interface SimilarityResult {
  entityType: string
  entityId: string
  score: number
}
