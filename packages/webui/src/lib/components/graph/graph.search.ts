import type Graph from 'graphology'

/**
 * A searchable entry in the graph search index.
 */
export interface SearchEntry {
  nodeId: string
  label: string
  slug: string
  content: string
  type: string
}

/**
 * A search result with scoring.
 */
export interface SearchResult {
  nodeId: string
  label: string
  slug: string
  type: string
  content: string
  score: number
}

/**
 * Build a search index from the graphology Graph object.
 *
 * IMPORTANT: Reads slugs from node attributes (computed in Phase 52 graph
 * construction), NOT from the raw GraphNode[] props where slugs don't exist.
 */
export function buildSearchIndex(graph: Graph): SearchEntry[] {
  const entries: SearchEntry[] = []
  graph.forEachNode((nodeId, attrs) => {
    entries.push({
      nodeId,
      label: (attrs.fullLabel as string) ?? (attrs.label as string) ?? '',
      slug: (attrs.slug as string) ?? '',
      content: (attrs.searchContent as string) ?? '',
      type: (attrs.nodeType as string) ?? (attrs.type as string) ?? '',
    })
  })
  return entries
}

/**
 * Match a query against a search entry.
 * Returns a score (0 = no match, higher = better match).
 *
 * Scoring:
 * - Exact match on slug: 100
 * - Starts-with on label: 80
 * - Starts-with on slug: 70
 * - Contains in label: 50
 * - Contains in slug: 40
 * - Contains in content: 20
 * - No match: 0
 */
export function scoreMatch(query: string, entry: SearchEntry): number {
  const q = query.toLowerCase().trim()
  if (q.length === 0) return 0

  const label = entry.label.toLowerCase()
  const slug = entry.slug.toLowerCase()
  const content = entry.content.toLowerCase()

  if (slug === q) return 100
  if (label.startsWith(q)) return 80
  if (slug.startsWith(q)) return 70
  if (label.includes(q)) return 50
  if (slug.includes(q)) return 40
  if (content.includes(q)) return 20
  return 0
}

/**
 * Search the index for matches, returning results sorted by score (descending).
 * Limits results to `maxResults`.
 */
export function searchNodes(
  query: string,
  index: SearchEntry[],
  maxResults = 10
): SearchResult[] {
  if (query.trim().length === 0) return []

  return index
    .map(entry => ({ entry, score: scoreMatch(query, entry) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(r => ({
      nodeId: r.entry.nodeId,
      label: r.entry.label,
      slug: r.entry.slug,
      type: r.entry.type,
      content: r.entry.content,
      score: r.score,
    }))
}
