import type { GraphFilterState } from './graph.filters'

/**
 * Generic graph node. The `type` field drives color/shape mapping via the
 * config's colorMap. Custom metadata can be attached via the index signature
 * and accessed in onNodeClick callbacks.
 */
export interface GraphNode {
  id: string
  label: string
  type: string
  size?: number
  color?: string
  x?: number
  y?: number
  [key: string]: unknown
}

/**
 * Generic graph edge. The `type` field drives styling via the config's
 * edgeColorMap (if provided). Weight influences edge thickness.
 */
export interface GraphEdge {
  id: string
  source: string
  target: string
  label?: string
  weight?: number
  type?: string
  color?: string
  [key: string]: unknown
}

/**
 * Force-directed layout parameters for ForceAtlas2.
 */
export interface ForceConfig {
  gravity: number
  scalingRatio: number
  slowDown: number
  barnesHutOptimize?: boolean  // auto-enabled when node count > barnesHutThreshold
  barnesHutThreshold?: number  // default: 100
  iterations?: number          // default: 100
}

/**
 * Full configuration for a GraphView instance.
 */
export interface GraphConfig {
  layout: 'forceatlas2' | 'circular' | 'random'
  forces: ForceConfig
  nodeDefaults: { size: number; color: string }
  edgeDefaults: { color: string; size: number; type: 'arrow' | 'line' }
  colorMap?: Record<string, string>     // node type -> color
  edgeColorMap?: Record<string, string> // edge type -> color
  labelThreshold: number                // zoom level to show labels
  enableDrag: boolean
  enableZoom: boolean
  enableEdgeEvents: boolean
  zIndex: boolean
}

/**
 * Props for the GraphView component.
 */
export interface GraphViewProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  config?: Partial<GraphConfig>
  highlightNode?: string | null
  onNodeClick?: (nodeId: string, data: GraphNode) => void
  onNodeHover?: (nodeId: string | null, data: GraphNode | null) => void
  onEdgeClick?: (edgeId: string, data: GraphEdge) => void
  onEdgeHover?: (edgeId: string | null) => void
  onStageClick?: () => void
  /** Optional filter state. When provided, nodes failing the filter are dimmed. */
  filterState?: GraphFilterState
}
