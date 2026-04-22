// packages/core/src/storage/adapters/helix/helix-named-queries.ts
//
// TypeScript dispatch for HelixDB named queries. Maps each named query
// from the registry (named-queries.ts) to a HelixDB-native call.

import type {
  NamedQueryRegistry,
  TraceChainResult,
  ListBulletsFilteredResult,
  GetResumeWithSectionsResult,
  ListDriftedBulletsResult,
  ListDriftedPerspectivesResult,
} from '../../named-queries'

/**
 * Minimal HelixDB client interface. We define this locally rather than
 * importing helix-ts since the package may not be installed yet.
 */
export type HelixClient = {
  query(name: string, params: Record<string, unknown>): Promise<unknown>
}

/**
 * A handler function that executes a named query against a HelixDB client.
 * Each handler receives the raw client and typed params, and returns the
 * result shape defined in the NamedQueryRegistry.
 */
type NamedQueryHandler<K extends keyof NamedQueryRegistry> = (
  client: HelixClient,
  params: NamedQueryRegistry[K]['params'],
) => Promise<NamedQueryRegistry[K]['result']>

/**
 * Complete map of named query handlers for the HelixDB adapter.
 */
export const HELIX_NAMED_QUERIES: {
  [K in keyof NamedQueryRegistry]: NamedQueryHandler<K>
} = {
  traceChain: async (client, params): Promise<TraceChainResult | null> => {
    const result = await client.query('TraceChain', {
      perspectiveId: params.perspectiveId,
    })
    // HelixDB returns the graph traversal result directly.
    // The HQL query already shapes { perspective, bullet, sources }.
    if (!result) return null
    return result as TraceChainResult
  },

  listBulletsFiltered: async (client, params): Promise<ListBulletsFilteredResult> => {
    // Initial: list all bullets, filter in TypeScript.
    // Future: use graph traversals for sourceId/skillId filtering
    // (those live on edges, not bullet node properties).
    const result = await client.query('ListAllBullets', {})
    const rows = Array.isArray(result) ? result : []
    let filtered = rows as Array<Record<string, unknown>>

    if (params.status) {
      filtered = filtered.filter((r) => r.status === params.status)
    }
    if (params.domain) {
      filtered = filtered.filter((r) => r.domain === params.domain)
    }
    // sourceId and skillId require edge traversal — not yet implemented.
    // For now they are silently ignored; callers should be aware.

    const total = filtered.length

    if (params.offset) {
      filtered = filtered.slice(params.offset)
    }
    if (params.limit) {
      filtered = filtered.slice(0, params.limit)
    }

    return {
      rows: filtered.map((r) => ({
        id: r.id as string,
        content: r.content as string,
        status: r.status as string,
        domain: (r.domain as string | null) ?? null,
        created_at: r.created_at as string,
      })),
      total,
    }
  },

  getResumeWithSections: async (client, params): Promise<GetResumeWithSectionsResult | null> => {
    const result = await client.query('GetResumes', {
      id: params.resumeId,
    })
    if (!result) return null

    const resume = Array.isArray(result) ? result[0] : result
    if (!resume) return null

    // Initial: return resume without sections.
    // Future: use graph traversal for nested sections + entries.
    return {
      resume: resume as Record<string, unknown>,
      sections: [],
    }
  },

  listDriftedBullets: async (client): Promise<ListDriftedBulletsResult> => {
    const result = await client.query('ListDriftedBullets', {})
    const bullets = Array.isArray(result) ? result : []

    // Filter for drift in TypeScript: rows where source_content_snapshot
    // is non-empty (indicating a snapshot was taken). The actual drift
    // comparison (snapshot != current source description) requires joining
    // with the source node, done downstream by the integrity service.
    const drifted = (bullets as Array<Record<string, unknown>>).filter((b) => {
      return (
        typeof b.source_content_snapshot === 'string' &&
        b.source_content_snapshot !== ''
      )
    })

    return {
      rows: drifted.map((b) => ({
        bullet_id: b.id as string,
        source_content_snapshot: b.source_content_snapshot as string,
        // current_description requires a source traversal; placeholder
        // until graph-native drift detection is implemented.
        current_description: '',
      })),
    }
  },

  listDriftedPerspectives: async (client): Promise<ListDriftedPerspectivesResult> => {
    const result = await client.query('ListDriftedPerspectives', {})
    const perspectives = Array.isArray(result) ? result : []

    // Filter for drift: rows where bullet_content_snapshot is non-empty.
    const drifted = (perspectives as Array<Record<string, unknown>>).filter((p) => {
      return (
        typeof p.bullet_content_snapshot === 'string' &&
        p.bullet_content_snapshot !== ''
      )
    })

    return {
      rows: drifted.map((p) => ({
        perspective_id: p.id as string,
        bullet_content_snapshot: p.bullet_content_snapshot as string,
        // current_content requires a bullet node lookup; placeholder
        // until graph-native drift detection is implemented.
        current_content: '',
      })),
    }
  },
}
