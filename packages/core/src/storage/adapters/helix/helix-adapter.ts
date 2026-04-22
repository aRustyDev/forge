/**
 * HelixAdapter — StorageAdapter + GraphCapableAdapter + VectorCapableAdapter
 * for HelixDB.
 *
 * Wires together entity classification, query name mapping, where-clause
 * routing, response normalization, fake transactions, and named queries
 * into a single StorageAdapter implementation.
 *
 * CRUD operations are dispatched to pre-compiled HQL queries via a simple
 * HTTP client. The adapter is stateless except for the connection flag.
 */

import type {
  GraphCapableAdapter,
  StorageAdapter,
  Transaction,
  VectorCapableAdapter,
} from '../../adapter'
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
} from '../../adapter-types'
import type { EntityMap } from '../../entity-map'
import type { EdgeMeta } from './helix-classify'

import { classifyEntities } from './helix-classify'
import { buildQueryNameMap } from './helix-query-names'
import { routeWhereClause, filterInTypeScript } from './helix-where'
import { normalizeNodeResponse, normalizeEdgeResponse, normalizeListResponse } from './helix-response'
import { HelixTransaction } from './helix-transaction'
import { HELIX_NAMED_QUERIES, type HelixClient } from './helix-named-queries'

// ── Simple HTTP client ───────────────────────────────────────────────────

class SimpleHelixClient implements HelixClient {
  constructor(
    private url: string,
    private apiKey?: string,
  ) {}

  async query(name: string, params: Record<string, unknown>): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['x-api-key'] = this.apiKey

    const response = await fetch(`${this.url}/query/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(
        `HelixDB query "${name}" failed: ${response.status} ${response.statusText}`,
      )
    }

    return response.json()
  }
}

// ── HelixAdapter ─────────────────────────────────────────────────────────

export class HelixAdapter
  implements StorageAdapter, GraphCapableAdapter, VectorCapableAdapter
{
  readonly capabilities: AdapterCapabilities = {
    graph: true,
    vector: true,
    transactions: false,
    nativeCascade: false,
  }

  private client: HelixClient
  private edgeEntities: Set<string>
  private edgeMeta: Map<string, EdgeMeta>
  private queryNameMap: Map<string, string>
  private entityMap: EntityMap
  private connected = false

  constructor(
    entityMap: EntityMap,
    options?: { url?: string; apiKey?: string },
  ) {
    this.entityMap = entityMap
    const classification = classifyEntities(entityMap)
    this.edgeEntities = classification.edges
    this.edgeMeta = classification.edgeMeta
    this.queryNameMap = buildQueryNameMap(classification, entityMap)
    this.client = new SimpleHelixClient(
      options?.url ?? 'http://localhost:6969',
      options?.apiKey,
    )
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  // ── Single-entity CRUD ───────────────────────────────────────────────

  async create(
    entityType: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const queryName = this.resolveQuery('create', entityType)

    if (this.edgeEntities.has(entityType)) {
      const meta = this.edgeMeta.get(entityType)!
      const fromId = data[meta.fromField]
      const toId = data[meta.toField]

      // Build properties (everything except the from/to FK fields)
      const properties: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(data)) {
        if (key !== meta.fromField && key !== meta.toField) {
          properties[key] = value
        }
      }

      await this.client.query(queryName, {
        fromId,
        toId,
        ...properties,
      })

      return { id: '' }
    }

    await this.client.query(queryName, data)
    return { id: typeof data.id === 'string' ? data.id : '' }
  }

  async get(
    entityType: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const queryName = this.resolveQuery('get', entityType)
    const raw = await this.client.query(queryName, { id })
    return normalizeNodeResponse(raw)
  }

  async update(
    entityType: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const queryName = this.resolveQuery('update', entityType)
    await this.client.query(queryName, { id, ...data })
  }

  async delete(entityType: string, id: string): Promise<void> {
    const queryName = this.resolveQuery('delete', entityType)
    await this.client.query(queryName, { id })
  }

  // ── Bulk operations ──────────────────────────────────────────────────

  async list(entityType: string, opts?: ListOptions): Promise<ListResult> {
    const route = routeWhereClause(
      entityType,
      opts?.where,
      this.edgeEntities,
      this.edgeMeta,
    )

    let rows: Record<string, unknown>[]
    let total: number

    switch (route.strategy) {
      case 'list': {
        // Tier 1: direct list with pagination
        const queryName = this.resolveQuery('list', entityType)
        const params: Record<string, unknown> = {}
        if (opts?.limit != null) params.limit = opts.limit
        if (opts?.offset != null) params.offset = opts.offset
        const raw = await this.client.query(queryName, params)
        const result = normalizeListResponse(raw)
        rows = result.rows
        total = result.total
        break
      }

      case 'listFrom': {
        // Tier 1: edge traversal from source
        const queryName = this.resolveQuery('listFrom', entityType)
        const raw = await this.client.query(queryName, route.params!)
        const result = normalizeListResponse(raw)
        // Normalize edge rows to junction shape
        const meta = this.edgeMeta.get(entityType)
        if (meta) {
          rows = result.rows.map((r) =>
            normalizeEdgeResponse(r, meta.fromField, meta.toField),
          )
        } else {
          rows = result.rows
        }
        total = rows.length
        break
      }

      case 'listTo': {
        // Tier 1: edge traversal to target
        const queryName = this.resolveQuery('listTo', entityType)
        const raw = await this.client.query(queryName, route.params!)
        const result = normalizeListResponse(raw)
        const meta = this.edgeMeta.get(entityType)
        if (meta) {
          rows = result.rows.map((r) =>
            normalizeEdgeResponse(r, meta.fromField, meta.toField),
          )
        } else {
          rows = result.rows
        }
        total = rows.length
        break
      }

      case 'getBy': {
        // Tier 1: list all then filter by simple equality
        const queryName = this.resolveQuery('listAll', entityType)
        const raw = await this.client.query(queryName, {})
        const result = normalizeListResponse(raw)
        rows = filterInTypeScript(result.rows, opts?.where)
        total = rows.length
        break
      }

      case 'clientFilter': {
        // Tier 3: list all, filter in TypeScript
        const queryName = this.resolveQuery('listAll', entityType)
        const raw = await this.client.query(queryName, {})
        const result = normalizeListResponse(raw)
        rows = filterInTypeScript(result.rows, route.originalWhere)
        total = rows.length
        break
      }

      default: {
        // Tier 2 operators (filterIn, filterLike, etc.):
        // For now, fall back to ListAll + client-side filter
        const queryName = this.resolveQuery('listAll', entityType)
        const raw = await this.client.query(queryName, {})
        const result = normalizeListResponse(raw)
        rows = filterInTypeScript(result.rows, route.originalWhere ?? opts?.where)
        total = rows.length
        break
      }
    }

    // Apply client-side ordering if requested
    if (opts?.orderBy?.length) {
      rows = this.applyOrderBy(rows, opts.orderBy)
    }

    // Apply client-side pagination for strategies that don't paginate natively
    if (route.strategy !== 'list') {
      if (opts?.offset) {
        rows = rows.slice(opts.offset)
      }
      if (opts?.limit) {
        rows = rows.slice(0, opts.limit)
      }
    }

    return { rows, total }
  }

  async count(entityType: string, where?: WhereClause): Promise<number> {
    if (!where) {
      const queryName = this.resolveQuery('count', entityType)
      const raw = await this.client.query(queryName, {})
      return typeof raw === 'number' ? raw : 0
    }

    // Edge with from field → CountFrom
    if (this.edgeEntities.has(entityType)) {
      const meta = this.edgeMeta.get(entityType)
      if (meta && typeof where === 'object' && !('$and' in where) && !('$or' in where)) {
        const simple = where as Record<string, unknown>
        const keys = Object.keys(simple)
        if (keys.length === 1 && keys[0] === meta.fromField) {
          const queryName = this.resolveQuery('countFrom', entityType)
          const raw = await this.client.query(queryName, {
            id: simple[meta.fromField] as string,
          })
          return typeof raw === 'number' ? raw : 0
        }
      }
    }

    // Fallback: list + count
    const result = await this.list(entityType, { where })
    return result.total
  }

  async deleteWhere(entityType: string, where: WhereClause): Promise<number> {
    // Edge-specific optimizations
    if (this.edgeEntities.has(entityType)) {
      const meta = this.edgeMeta.get(entityType)
      if (meta && typeof where === 'object' && !('$and' in where) && !('$or' in where)) {
        const simple = where as Record<string, unknown>
        const keys = Object.keys(simple)

        // Single from field → DeleteFrom
        if (keys.length === 1 && keys[0] === meta.fromField) {
          const queryName = this.resolveQuery('deleteFrom', entityType)
          const raw = await this.client.query(queryName, {
            id: simple[meta.fromField] as string,
          })
          return typeof raw === 'number' ? raw : 0
        }

        // Both endpoints → DeleteByEndpoints
        if (
          keys.length === 2 &&
          keys.includes(meta.fromField) &&
          keys.includes(meta.toField)
        ) {
          const queryName = this.resolveQuery('deleteByEndpoints', entityType)
          await this.client.query(queryName, {
            fromId: simple[meta.fromField] as string,
            toId: simple[meta.toField] as string,
          })
          return 1
        }
      }
    }

    // Fallback: list matching, then delete each
    const result = await this.list(entityType, { where })
    for (const row of result.rows) {
      const id = row.id as string
      if (id) {
        await this.delete(entityType, id)
      }
    }
    return result.rows.length
  }

  async updateWhere(
    entityType: string,
    where: WhereClause,
    data: Record<string, unknown>,
  ): Promise<number> {
    const result = await this.list(entityType, { where })
    for (const row of result.rows) {
      const id = row.id as string
      if (id) {
        await this.update(entityType, id, data)
      }
    }
    return result.rows.length
  }

  // ── Transactions ─────────────────────────────────────────────────────

  async beginTransaction(): Promise<Transaction> {
    return new HelixTransaction(this)
  }

  // ── Named queries ────────────────────────────────────────────────────

  async executeNamedQuery(
    name: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const handler = (HELIX_NAMED_QUERIES as Record<string, Function>)[name]
    if (!handler) {
      throw new Error(`Unknown named query: "${name}"`)
    }
    return handler(this.client, params)
  }

  // ── Graph sub-interface ──────────────────────────────────────────────

  async traverse(
    from: EntityRef,
    edgeType: string,
    depth?: number,
  ): Promise<TraversalResult> {
    const meta = this.edgeMeta.get(edgeType)
    if (!meta) {
      return { nodes: [], edges: [] }
    }

    // List outgoing edges from the source
    const queryName = this.resolveQuery('listFrom', edgeType)
    const raw = await this.client.query(queryName, { id: from.id })
    const edgeRows = Array.isArray(raw) ? raw : raw ? [raw] : []

    const edges: TraversalResult['edges'] = []
    const nodes: TraversalResult['nodes'] = []
    const seenNodes = new Set<string>()

    for (const edgeRow of edgeRows as Record<string, unknown>[]) {
      const toNode = edgeRow.to as Record<string, unknown> | undefined
      const toId = toNode?.id as string | undefined

      if (toId) {
        edges.push({
          from: { entityType: from.entityType, id: from.id },
          to: { entityType: meta.toEntity, id: toId },
          edgeType,
        })

        if (!seenNodes.has(toId)) {
          seenNodes.add(toId)
          // Fetch the target node
          try {
            const nodeQueryName = this.resolveQuery('get', meta.toEntity)
            const nodeRaw = await this.client.query(nodeQueryName, { id: toId })
            const nodeData = normalizeNodeResponse(nodeRaw)
            if (nodeData) {
              nodes.push({
                entityType: meta.toEntity,
                id: toId,
                data: nodeData,
              })
            }
          } catch {
            // Node fetch failed; include edge but skip node data
          }
        }
      }
    }

    return { nodes, edges }
  }

  async shortestPath(
    _from: EntityRef,
    _to: EntityRef,
  ): Promise<PathResult | null> {
    throw new Error('shortestPath is not supported by HelixAdapter')
  }

  async subgraph(
    _rootType: string,
    _rootId: string,
    _depth: number,
  ): Promise<SubgraphResult> {
    throw new Error('subgraph is not supported by HelixAdapter')
  }

  // ── Vector sub-interface ─────────────────────────────────────────────

  async embed(
    entityType: string,
    entityId: string,
    content: string,
  ): Promise<void> {
    await this.client.query('AddEmbedding', { entityType, entityId, content })
  }

  async findSimilar(
    query: string,
    entityType: string,
    topK: number,
    threshold: number,
  ): Promise<SimilarityResult[]> {
    const raw = await this.client.query('SearchEmbedding', {
      query,
      entityType,
      topK,
      threshold,
    })
    if (!raw || !Array.isArray(raw)) return []
    return raw as SimilarityResult[]
  }

  async checkEmbeddingStale(
    entityType: string,
    entityId: string,
    contentHash: string,
  ): Promise<boolean> {
    const raw = await this.client.query('GetEmbeddingByEntity', {
      entityType,
      entityId,
    })
    if (!raw || typeof raw !== 'object') return true
    const existing = raw as Record<string, unknown>
    return existing.content_hash !== contentHash
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private resolveQuery(method: string, entityType: string): string {
    const key = `${method}:${entityType}`
    const name = this.queryNameMap.get(key)
    if (!name) {
      throw new Error(
        `HelixAdapter: no query mapped for ${key}. Available: ${[...this.queryNameMap.keys()].join(', ')}`,
      )
    }
    return name
  }

  private applyOrderBy(
    rows: Record<string, unknown>[],
    orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>,
  ): Record<string, unknown>[] {
    return [...rows].sort((a, b) => {
      for (const { field, direction } of orderBy) {
        const aVal = a[field]
        const bVal = b[field]

        if (aVal === bVal) continue

        // Nulls sort last
        if (aVal == null) return 1
        if (bVal == null) return -1

        let cmp: number
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal
        } else {
          cmp = String(aVal).localeCompare(String(bVal))
        }

        return direction === 'desc' ? -cmp : cmp
      }
      return 0
    })
  }
}
