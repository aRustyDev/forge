import type { GraphConfig } from './graph.types'

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  layout: 'forceatlas2',
  forces: {
    gravity: 1,
    scalingRatio: 10,
    slowDown: 1,
    barnesHutOptimize: false,  // auto-enabled per barnesHutThreshold
    barnesHutThreshold: 100,
    iterations: 100,
  },
  nodeDefaults: { size: 8, color: '#6b7280' },
  edgeDefaults: { color: '#94a3b8', size: 1, type: 'arrow' },
  colorMap: {},
  edgeColorMap: {},
  labelThreshold: 6,
  enableDrag: true,
  enableZoom: true,
  enableEdgeEvents: true,
  zIndex: true,
}

/**
 * Merge partial user config with defaults. Nested objects (forces, nodeDefaults,
 * edgeDefaults) are shallow-merged independently so that providing
 * `{ forces: { gravity: 2 } }` does not discard `scalingRatio` and `slowDown`.
 */
export function mergeConfig(partial?: Partial<GraphConfig>): GraphConfig {
  if (!partial) return {
    ...DEFAULT_GRAPH_CONFIG,
    forces: { ...DEFAULT_GRAPH_CONFIG.forces },
    nodeDefaults: { ...DEFAULT_GRAPH_CONFIG.nodeDefaults },
    edgeDefaults: { ...DEFAULT_GRAPH_CONFIG.edgeDefaults },
    colorMap: { ...DEFAULT_GRAPH_CONFIG.colorMap },
    edgeColorMap: { ...DEFAULT_GRAPH_CONFIG.edgeColorMap },
  }

  return {
    ...DEFAULT_GRAPH_CONFIG,
    ...partial,
    forces: { ...DEFAULT_GRAPH_CONFIG.forces, ...partial.forces },
    nodeDefaults: { ...DEFAULT_GRAPH_CONFIG.nodeDefaults, ...partial.nodeDefaults },
    edgeDefaults: { ...DEFAULT_GRAPH_CONFIG.edgeDefaults, ...partial.edgeDefaults },
    colorMap: { ...DEFAULT_GRAPH_CONFIG.colorMap, ...partial.colorMap },
    edgeColorMap: { ...DEFAULT_GRAPH_CONFIG.edgeColorMap, ...partial.edgeColorMap },
  }
}

/** Dense graphs: stronger gravity to prevent sprawl */
export const DENSE_GRAPH_CONFIG: Partial<GraphConfig> = {
  forces: { gravity: 3, scalingRatio: 5, slowDown: 2 },
}

/** Sparse/tree-like graphs: weaker gravity, higher scaling to spread branches */
export const TREE_GRAPH_CONFIG: Partial<GraphConfig> = {
  forces: { gravity: 0.5, scalingRatio: 20, slowDown: 1 },
}

/** Small graphs (<20 nodes): no Barnes-Hut, fewer iterations */
export const SMALL_GRAPH_CONFIG: Partial<GraphConfig> = {
  forces: { gravity: 1, scalingRatio: 10, slowDown: 1, iterations: 50 },
}
