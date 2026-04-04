import type { GraphNode } from './graph.types'

/**
 * Filter state for the graph. Each field is a set of active (visible) values.
 * A node passes the filter if it matches at least one active value in each
 * category that has any values set.
 *
 * Empty set = "show all" for that category (no filtering).
 */
export interface GraphFilterState {
  /** Visible node types. Empty = show all types. */
  nodeTypes: Set<string>
  /** Visible statuses. Empty = show all statuses. */
  statuses: Set<string>
  /** Visible domains. Empty = show all domains. */
  domains: Set<string>
  /** Visible archetypes. Empty = show all archetypes. */
  archetypes: Set<string>
}

/**
 * Default filter state: everything visible (all empty sets).
 */
export function createDefaultFilterState(): GraphFilterState {
  return {
    nodeTypes: new Set(),
    statuses: new Set(),
    domains: new Set(),
    archetypes: new Set(),
  }
}

/**
 * Determine if a node passes the current filter state.
 * Returns true if the node should be visible (full opacity).
 * Returns false if the node should be dimmed.
 *
 * Logic: AND across categories, OR within each category.
 * Empty category = pass (no filtering for that dimension).
 */
export function nodePassesFilter(
  node: GraphNode,
  filter: GraphFilterState
): boolean {
  if (filter.nodeTypes.size > 0 && !filter.nodeTypes.has(node.type)) {
    return false
  }
  if (filter.statuses.size > 0 && !filter.statuses.has(node.status as string)) {
    return false
  }
  if (filter.domains.size > 0 && !filter.domains.has(node.domain as string)) {
    return false
  }
  if (filter.archetypes.size > 0 && !filter.archetypes.has(node.archetype as string)) {
    return false
  }
  return true
}

/**
 * Serialize filter state to URL search params.
 * Empty sets are omitted (no filter = no param).
 */
export function filterToSearchParams(filter: GraphFilterState): URLSearchParams {
  const params = new URLSearchParams()
  if (filter.nodeTypes.size > 0) params.set('types', [...filter.nodeTypes].join(','))
  if (filter.statuses.size > 0) params.set('status', [...filter.statuses].join(','))
  if (filter.domains.size > 0) params.set('domain', [...filter.domains].join(','))
  if (filter.archetypes.size > 0) params.set('archetype', [...filter.archetypes].join(','))
  return params
}

/**
 * Deserialize URL search params to filter state.
 * Missing params default to empty sets (show all).
 */
export function searchParamsToFilter(params: URLSearchParams): GraphFilterState {
  return {
    nodeTypes: paramToSet(params.get('types')),
    statuses: paramToSet(params.get('status')),
    domains: paramToSet(params.get('domain')),
    archetypes: paramToSet(params.get('archetype')),
  }
}

function paramToSet(value: string | null): Set<string> {
  if (!value) return new Set()
  return new Set(value.split(',').map(s => s.trim()).filter(Boolean))
}
