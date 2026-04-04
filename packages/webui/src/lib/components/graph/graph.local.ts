import type { GraphNode, GraphEdge, GraphConfig } from './graph.types'

/**
 * Extract a subgraph containing the center node and all nodes
 * directly connected by an edge (1-hop neighborhood).
 *
 * Returns new arrays of nodes and edges. The center node is included.
 * Edges between neighbors (not involving the center) are excluded.
 *
 * Returns empty arrays if centerId is not found in allNodes.
 */
export function extractLocalSubgraph(
  centerId: string,
  allNodes: GraphNode[],
  allEdges: GraphEdge[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  // Find edges connected to the center node
  const connectedEdges = allEdges.filter(
    e => e.source === centerId || e.target === centerId
  )

  // Collect neighbor IDs
  const neighborIds = new Set<string>()
  for (const edge of connectedEdges) {
    if (edge.source === centerId) neighborIds.add(edge.target)
    if (edge.target === centerId) neighborIds.add(edge.source)
  }

  // Build node set: center + neighbors
  const nodeIds = new Set([centerId, ...neighborIds])
  const nodes = allNodes.filter(n => nodeIds.has(n.id))

  // If center node itself wasn't in allNodes, return empty
  if (!nodes.some(n => n.id === centerId)) {
    return { nodes: [], edges: [] }
  }

  // Only include edges that connect to the center (not neighbor-to-neighbor)
  return { nodes, edges: connectedEdges }
}

/**
 * Prepare nodes for the local widget, emphasizing the center node.
 * Center node gets 1.5x size and forceLabel: true.
 */
export function prepareLocalNodes(
  centerId: string,
  nodes: GraphNode[],
  config: GraphConfig
): GraphNode[] {
  return nodes.map(node => {
    if (node.id === centerId) {
      return {
        ...node,
        size: (node.size ?? config.nodeDefaults.size) * 1.5,
        forceLabel: true,
      }
    }
    return node
  })
}

/**
 * Pre-position nodes for the local widget layout.
 * Center at (50, 50), neighbors in a circle around it.
 * Gives ForceAtlas2 a good starting point for fast convergence.
 */
export function prePositionLocalNodes(
  centerId: string,
  nodes: GraphNode[]
): GraphNode[] {
  const neighborCount = nodes.filter(n => n.id !== centerId).length
  const angleStep = (2 * Math.PI) / Math.max(neighborCount, 1)
  const radius = 30

  const result: GraphNode[] = []
  let neighborIdx = 0

  for (const node of nodes) {
    if (node.id === centerId) {
      result.push({ ...node, x: 50, y: 50 })
    } else {
      result.push({
        ...node,
        x: 50 + radius * Math.cos(neighborIdx * angleStep),
        y: 50 + radius * Math.sin(neighborIdx * angleStep),
      })
      neighborIdx++
    }
  }

  return result
}

/**
 * Widget-specific config: no drag, no edge events, small iterations.
 * Consumers merge this with their own overrides via mergeConfig().
 *
 * NOTE: Sigma v3 does not have an `enableZoom` config flag. To disable
 * scroll-wheel zoom, the GraphView component should translate
 * `enableZoom: false` into Sigma-native settings (e.g., zoomingRatio: 1
 * or maxCameraRatio: 1, minCameraRatio: 1).
 *
 * IMPORTANT: Phase 48's `GraphView` must translate `enableZoom: false` into
 * Sigma-native settings (`zoomingRatio: 1` or `maxCameraRatio: minCameraRatio: 1`).
 * If Phase 48 does not implement this translation, LocalGraphWidget's zoom
 * disabling will silently not work -- the user will still be able to scroll-zoom
 * inside the mini widget.
 */
export const LOCAL_WIDGET_CONFIG: Partial<GraphConfig> = {
  layout: 'forceatlas2',
  forces: {
    gravity: 3,
    scalingRatio: 5,
    slowDown: 2,
    iterations: 30,
  },
  enableDrag: false,
  enableZoom: false,
  enableEdgeEvents: false,
  labelThreshold: 1e6,
  zIndex: false,
}
