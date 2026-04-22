/**
 * StorageAdapter — the thin storage abstraction.
 *
 * Adapters speak in entities (type + id + data), not domain objects. They
 * have no relational awareness, no constraint enforcement, no lifecycle
 * hooks. The EntityLifecycleManager wraps the adapter with all of that.
 *
 * Adapters MUST:
 *   - accept canonical JS types on WRITE (strings, numbers, booleans, objects)
 *     and serialize them to backend-native format internally
 *   - return RAW backend values on READ (the integrity layer deserializes
 *     using the entity map — see Section 8.1 of the Phase 0 spec)
 *   - use the error factories from ./errors.ts when throwing
 *
 * Adapters MAY optionally implement the GraphCapableAdapter and
 * VectorCapableAdapter sub-interfaces for backend-native graph traversals
 * and vector search.
 */

import type {
  AdapterCapabilities,
  EntityRef,
  ListOptions,
  ListResult,
  PathResult,
  SimilarityResult,
  SubgraphResult,
  TraversalResult,
  WhereClause,
} from './adapter-types'

// ─── Core interface ────────────────────────────────────────────────────────

export interface StorageAdapter {
  /** Capability descriptor — used by the integrity layer for optimization. */
  readonly capabilities: AdapterCapabilities

  // ─── Single entity operations ───
  create(entityType: string, data: Record<string, unknown>): Promise<{ id: string }>
  get(entityType: string, id: string): Promise<Record<string, unknown> | null>
  update(entityType: string, id: string, data: Record<string, unknown>): Promise<void>
  delete(entityType: string, id: string): Promise<void>

  // ─── Bulk operations ───
  list(entityType: string, opts?: ListOptions): Promise<ListResult>
  count(entityType: string, where?: WhereClause): Promise<number>
  deleteWhere(entityType: string, where: WhereClause): Promise<number>
  updateWhere(
    entityType: string,
    where: WhereClause,
    data: Record<string, unknown>,
  ): Promise<number>

  // ─── Transactions ───
  beginTransaction(): Promise<Transaction>

  // ─── Named queries (complex, backend-optimized) ───
  /**
   * Execute a backend-optimized query that can't be expressed as simple
   * CRUD. Each backend implements known query names using its native
   * strengths (JOINs for SQLite, traversals for HelixDB, etc.).
   *
   * The contract is "return this shape", not "use this mechanism".
   * See named-queries.ts for the typed registry.
   */
  executeNamedQuery(name: string, params: Record<string, unknown>): Promise<unknown>

  // ─── Lifecycle ───
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
}

// ─── Transaction interface ─────────────────────────────────────────────────
//
// Mirrors the adapter's CRUD methods but scoped to a single in-progress
// transaction. The adapter's beginTransaction() returns an instance; the
// caller is responsible for committing or rolling back.

export interface Transaction {
  create(entityType: string, data: Record<string, unknown>): Promise<{ id: string }>
  get(entityType: string, id: string): Promise<Record<string, unknown> | null>
  update(entityType: string, id: string, data: Record<string, unknown>): Promise<void>
  delete(entityType: string, id: string): Promise<void>
  deleteWhere(entityType: string, where: WhereClause): Promise<number>
  updateWhere(
    entityType: string,
    where: WhereClause,
    data: Record<string, unknown>,
  ): Promise<number>
  count(entityType: string, where?: WhereClause): Promise<number>

  commit(): Promise<void>
  rollback(): Promise<void>
}

// ─── Optional sub-interfaces ───────────────────────────────────────────────

/**
 * Optional graph traversal capability.
 *
 * Adapters that implement this can express multi-hop traversals directly.
 * Adapters that don't are expected to implement equivalent named queries
 * via JOINs or iterative lookups.
 */
export interface GraphCapableAdapter extends StorageAdapter {
  traverse(
    from: EntityRef,
    edgeType: string,
    depth?: number,
  ): Promise<TraversalResult>
  shortestPath(from: EntityRef, to: EntityRef): Promise<PathResult | null>
  subgraph(rootType: string, rootId: string, depth: number): Promise<SubgraphResult>
}

/**
 * Optional native vector capability.
 *
 * Adapters with built-in vector storage (HelixDB, pgvector, sqlite-vec)
 * can implement this for native embedding/search. Otherwise the integrity
 * layer coordinates with a separate EmbeddingService.
 */
export interface VectorCapableAdapter extends StorageAdapter {
  embed(entityType: string, entityId: string, content: string): Promise<void>
  findSimilar(
    query: string,
    entityType: string,
    topK: number,
    threshold: number,
  ): Promise<SimilarityResult[]>
  checkEmbeddingStale(
    entityType: string,
    entityId: string,
    contentHash: string,
  ): Promise<boolean>
}

// ─── Capability-detection helpers ──────────────────────────────────────────

export function isGraphCapable(a: StorageAdapter): a is GraphCapableAdapter {
  return a.capabilities.graph
}

export function isVectorCapable(a: StorageAdapter): a is VectorCapableAdapter {
  return a.capabilities.vector
}
