import type Sigma from 'sigma'
import type Graph from 'graphology'

/**
 * Get the midpoint of an edge in viewport (screen) coordinates.
 * Useful for positioning tooltips near hovered edges.
 *
 * Returns null if either endpoint node has no display data (e.g., hidden node).
 */
export function getEdgeMidpoint(
  sigma: Sigma,
  graph: Graph,
  edgeId: string
): { x: number; y: number } | null {
  try {
    const [src, tgt] = graph.extremities(edgeId)
    const srcDisplay = sigma.getNodeDisplayData(src)
    const tgtDisplay = sigma.getNodeDisplayData(tgt)
    if (!srcDisplay || !tgtDisplay) return null

    // Compute midpoint in graph space, then convert to viewport (screen) pixels.
    const midGraph = {
      x: (srcDisplay.x + tgtDisplay.x) / 2,
      y: (srcDisplay.y + tgtDisplay.y) / 2,
    }
    return sigma.graphToViewport(midGraph)
  } catch {
    return null
  }
}
