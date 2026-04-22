/**
 * Named query registry — typed catalogue of complex queries that can't
 * be expressed as simple CRUD.
 *
 * Each adapter implements these using its native strengths (JOINs for
 * SQLite, Cypher for GraphQLite, HQL for HelixDB). The contract is
 * "return this shape", not "use this mechanism".
 *
 * Phase 0 ships with a minimum viable subset implemented. Additional
 * queries can be added in Phase 1 as services are rewired to use them.
 */

// ─── Minimum Viable Named Queries (Phase 0) ────────────────────────────

/**
 * traceChain: Given a perspective id, return the full derivation chain
 * (perspective → bullet → source[]). Used by audit/integrity services to
 * detect snapshot drift.
 */
export interface TraceChainParams {
  perspectiveId: string
}

export interface TraceChainResult {
  perspective: {
    id: string
    content: string
    bullet_content_snapshot: string
    framing: string
    status: string
    created_at: string
  }
  bullet: {
    id: string
    content: string
    source_content_snapshot: string
    status: string
  }
  sources: Array<{
    id: string
    title: string
    description: string
    source_type: string
    is_primary: boolean
  }>
}

/**
 * listBulletsFiltered: Filtered bullet list with JOIN-based filters
 * that can't be expressed in the simple WhereClause DSL (e.g. by
 * source_id or skill_id, both of which live in junction tables).
 */
export interface ListBulletsFilteredParams {
  status?: string
  sourceId?: string
  skillId?: string
  domain?: string
  limit?: number
  offset?: number
}

export interface ListBulletsFilteredResult {
  rows: Array<{
    id: string
    content: string
    status: string
    domain: string | null
    created_at: string
  }>
  total: number
}

/**
 * getResumeWithSections: Full resume with nested sections and entries.
 * Used by the resume compiler / rendering path.
 */
export interface GetResumeWithSectionsParams {
  resumeId: string
}

export interface GetResumeWithSectionsResult {
  resume: Record<string, unknown>
  sections: Array<{
    id: string
    title: string
    entry_type: string
    position: number
    entries: Array<{
      id: string
      perspective_id: string | null
      source_id: string | null
      content: string | null
      perspective_content_snapshot: string | null
      position: number
    }>
  }>
}

// ─── Phase 1.4: Integrity drift detection ─────────────────────────────

/**
 * listDriftedBullets: Find bullets where source_content_snapshot differs
 * from their primary source's current description.
 */
export interface ListDriftedBulletsParams {}

export interface ListDriftedBulletsResult {
  rows: Array<{
    bullet_id: string
    source_content_snapshot: string
    current_description: string
  }>
}

/**
 * listDriftedPerspectives: Find perspectives where bullet_content_snapshot
 * differs from their bullet's current content.
 */
export interface ListDriftedPerspectivesParams {}

export interface ListDriftedPerspectivesResult {
  rows: Array<{
    perspective_id: string
    bullet_content_snapshot: string
    current_content: string
  }>
}

// ─── Typed registry ────────────────────────────────────────────────────

/**
 * The complete type-level registry of named queries. Each key is a query
 * name; each value has `params` and `result` types. The ELM's `query()`
 * method is parameterized over this registry to provide end-to-end type
 * safety.
 *
 * To add a new query:
 *   1. Define Params and Result types above
 *   2. Add an entry here
 *   3. Implement in each adapter's named-queries module
 *   4. (Optional) Add a convenience wrapper on the ELM or a service
 */
export interface NamedQueryRegistry {
  traceChain: {
    params: TraceChainParams
    result: TraceChainResult | null
  }
  listBulletsFiltered: {
    params: ListBulletsFilteredParams
    result: ListBulletsFilteredResult
  }
  getResumeWithSections: {
    params: GetResumeWithSectionsParams
    result: GetResumeWithSectionsResult | null
  }
  listDriftedBullets: {
    params: ListDriftedBulletsParams
    result: ListDriftedBulletsResult
  }
  listDriftedPerspectives: {
    params: ListDriftedPerspectivesParams
    result: ListDriftedPerspectivesResult
  }
}

export type NamedQueryName = keyof NamedQueryRegistry
export type NamedQueryParams<K extends NamedQueryName> = NamedQueryRegistry[K]['params']
export type NamedQueryResult<K extends NamedQueryName> = NamedQueryRegistry[K]['result']
