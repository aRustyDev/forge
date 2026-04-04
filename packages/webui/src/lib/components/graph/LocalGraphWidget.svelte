<!--
  LocalGraphWidget.svelte — Small embeddable graph showing a node's
  1-hop neighborhood. Read-only mini-view for entity detail pages.

  Usage:
    <LocalGraphWidget centerId="src-42" {nodes} {edges} onNodeClick={handleClick} />
-->
<script lang="ts">
  import GraphView from './GraphView.svelte'
  import { mergeConfig } from './graph.config'
  import {
    extractLocalSubgraph,
    prepareLocalNodes,
    prePositionLocalNodes,
    LOCAL_WIDGET_CONFIG,
  } from './graph.local'
  import type { GraphNode, GraphEdge, GraphConfig } from './graph.types'

  interface LocalGraphWidgetProps {
    /** The ID of the center node to display */
    centerId: string
    /** All graph nodes (the widget extracts the subgraph) */
    nodes: GraphNode[]
    /** All graph edges (the widget extracts the subgraph) */
    edges: GraphEdge[]
    /** Optional config overrides (merged with LOCAL_WIDGET_CONFIG) */
    config?: Partial<GraphConfig>
    /** Width in pixels (default: 300) */
    width?: number
    /** Height in pixels (default: 200) */
    height?: number
    /** Callback when a neighbor node is clicked */
    onNodeClick?: (nodeId: string, data: GraphNode) => void
  }

  let {
    centerId,
    nodes,
    edges,
    config: configOverride = undefined,
    width = 300,
    height = 200,
    onNodeClick = undefined,
  }: LocalGraphWidgetProps = $props()

  // Extract 1-hop subgraph reactively
  let subgraph = $derived(extractLocalSubgraph(centerId, nodes, edges))

  // Merge widget defaults with consumer overrides
  let resolvedConfig = $derived(mergeConfig({
    ...LOCAL_WIDGET_CONFIG,
    ...configOverride,
  }))

  // Emphasize center node and pre-position for layout
  let preparedNodes = $derived(
    prePositionLocalNodes(
      centerId,
      prepareLocalNodes(centerId, subgraph.nodes, resolvedConfig)
    )
  )

  function handleNodeClick(nodeId: string, data: GraphNode) {
    if (nodeId === centerId) return  // clicking center is a no-op
    onNodeClick?.(nodeId, data)
  }
</script>

<div class="local-graph-widget" style:width="{width}px" style:height="{height}px">
  {#if subgraph.nodes.length === 0}
    <p class="widget-empty">Node not found</p>
  {:else if subgraph.edges.length === 0}
    <p class="widget-empty">No connected entities</p>
  {:else}
    <GraphView
      nodes={preparedNodes}
      edges={subgraph.edges}
      config={resolvedConfig}
      highlightNode={centerId}
      onNodeClick={handleNodeClick}
    />
  {/if}
</div>

<style>
  .local-graph-widget {
    position: relative;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-lg, 8px);
    overflow: hidden;
    background: var(--color-surface, #ffffff);
  }

  .widget-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    margin: 0;
    color: var(--text-muted, #9ca3af);
    font-size: var(--text-base, 0.875rem);
  }
</style>
