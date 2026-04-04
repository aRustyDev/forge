<!--
  GraphView.svelte — Generic Sigma.js graph renderer.

  Accepts arbitrary nodes and edges, manages the full Sigma.js WebGL
  lifecycle (init, layout, reducers, events, cleanup), and exposes
  interaction callbacks. Consumers map domain data into the generic
  GraphNode[]/GraphEdge[] interface.

  Cleanup uses dual pattern: $effect return (primary) + onDestroy (backup).
-->
<script lang="ts">
  import { browser } from '$app/environment'
  import { onDestroy } from 'svelte'
  import Graph from 'graphology'
  import type { GraphNode, GraphEdge, GraphViewProps } from './graph.types'
  import { mergeConfig } from './graph.config'
  import type { GraphConfig } from './graph.types'
  import {
    DIM_NODE_COLOR,
    DIM_EDGE_COLOR,
    DIM_EDGE_SIZE,
    HIGHLIGHT_EDGE_SIZE_BUMP,
    Z_FOREGROUND,
    Z_BACKGROUND,
  } from './graph.constants'

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let {
    nodes,
    edges,
    config: configOverride = undefined,
    highlightNode = null,
    onNodeClick = undefined,
    onNodeHover = undefined,
    onEdgeClick = undefined,
    onEdgeHover = undefined,
    onStageClick = undefined,
  }: GraphViewProps = $props()

  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------

  let container = $state<HTMLDivElement | null>(null)
  let sigmaInstance: any = $state(null)
  let graph = $state<Graph | null>(null)
  let selectedNodeId = $state<string | null>(null)
  let hoveredEdge = $state<string | null>(null)
  let initError = $state<string | null>(null)

  // Merged config (recomputed when configOverride changes)
  let resolvedConfig = $derived(mergeConfig(configOverride))

  // ---------------------------------------------------------------------------
  // Layout execution
  // ---------------------------------------------------------------------------

  /**
   * Run the configured layout algorithm on the graph. Dynamically imports
   * layout libraries for SSR safety. ForceAtlas2 auto-enables Barnes-Hut
   * when node count exceeds the threshold.
   */
  async function runLayout(g: Graph, config: GraphConfig): Promise<void> {
    if (config.layout === 'forceatlas2') {
      const forceAtlas2 = await import('graphology-layout-forceatlas2')
      forceAtlas2.default.assign(g, {
        iterations: config.forces.iterations ?? 100,
        settings: {
          gravity: config.forces.gravity,
          scalingRatio: config.forces.scalingRatio,
          slowDown: config.forces.slowDown,
          barnesHutOptimize:
            config.forces.barnesHutOptimize
            ?? g.order > (config.forces.barnesHutThreshold ?? 100),
        },
      })
    } else if (config.layout === 'circular') {
      try {
        const circular = await import('graphology-layout/circular')
        circular.default.assign(g)
      } catch {
        console.warn('graphology-layout not installed; falling back to random positions')
      }
    }
    // 'random' layout: nodes already have random positions from construction
  }

  // ---------------------------------------------------------------------------
  // Graph building (reactive on nodes/edges/config changes)
  // ---------------------------------------------------------------------------

  $effect(() => {
    // Track reactive dependencies
    const _nodes = nodes
    const _edges = edges
    const _config = resolvedConfig

    if (!browser) return

    async function buildAndAssign() {
      const g = new Graph({ type: 'directed', multi: false })

      for (const node of _nodes) {
        // Spread node FIRST so explicit Sigma attributes below take precedence.
        // node.type is the entity classification (source/bullet/perspective).
        // Sigma's node program type is stored separately as type: 'circle'.
        // If ...node came after, node.type would overwrite 'circle'.
        g.addNode(node.id, {
          ...node,
          label: node.label ?? node.id,
          x: node.x ?? Math.random() * 100,
          y: node.y ?? Math.random() * 100,
          size: node.size ?? _config.nodeDefaults.size,
          color: node.color
            ?? _config.colorMap?.[node.type]
            ?? _config.nodeDefaults.color,
          nodeType: node.type,  // entity classification stored separately
          type: 'circle',       // Sigma node program type — MUST come after ...node
        })
      }

      for (const edge of _edges) {
        if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue
        g.addEdge(edge.source, edge.target, {
          ...edge,
          size: edge.weight ?? _config.edgeDefaults.size,
          color: edge.color
            ?? (edge.type ? _config.edgeColorMap?.[edge.type] : undefined)
            ?? _config.edgeDefaults.color,
          type: _config.edgeDefaults.type,
          edgeType: edge.type,  // entity classification stored separately
        })
      }

      // Run layout BEFORE setting graph state. Sigma only initializes after
      // layout is done — no visual jump from random to laid-out positions.
      if (g.order > 0) {
        await runLayout(g, _config)
      }

      graph = g
    }

    buildAndAssign()
  })

  // ---------------------------------------------------------------------------
  // Sigma initialization (reactive on container + graph)
  // ---------------------------------------------------------------------------

  $effect(() => {
    if (!browser || !container || !graph) return

    // When graph state changes (new data), destroy old Sigma instance and
    // re-create. This ensures reducers always reference the current graph.
    // Do NOT guard with `if (sigmaInstance) return` — that is the anti-pattern
    // this component fixes from ChainViewModal.
    if (sigmaInstance) {
      sigmaInstance.kill()
      sigmaInstance = null
    }

    initError = null

    async function initSigma() {
      try {
        const { default: Sigma } = await import('sigma')

        const instance = new Sigma(graph!, container!, {
          renderEdgeLabels: false,
          enableEdgeEvents: resolvedConfig.enableEdgeEvents,
          defaultNodeType: 'circle',
          defaultEdgeType: resolvedConfig.edgeDefaults.type,
          zIndex: resolvedConfig.zIndex,
          labelRenderedSizeThreshold: resolvedConfig.labelThreshold,

          // --- Node reducer: selection highlighting ---
          nodeReducer: (node: string, data: Record<string, any>) => {
            if (!selectedNodeId) return data
            if (
              node === selectedNodeId
              || graph!.hasEdge(selectedNodeId, node)
              || graph!.hasEdge(node, selectedNodeId)
            ) {
              return { ...data, zIndex: Z_FOREGROUND }
            }
            return { ...data, color: DIM_NODE_COLOR, label: '', zIndex: Z_BACKGROUND }
          },

          // --- Edge reducer: selection + hover highlighting ---
          edgeReducer: (edge: string, data: Record<string, any>) => {
            const [src, tgt] = graph!.extremities(edge)
            const srcAttrs = graph!.getNodeAttributes(src)
            const tgtAttrs = graph!.getNodeAttributes(tgt)

            // Hide edges with hidden endpoints (filtered graphs)
            if (srcAttrs.hidden || tgtAttrs.hidden) {
              return { ...data, hidden: true }
            }

            if (selectedNodeId) {
              if (src === selectedNodeId || tgt === selectedNodeId) {
                return {
                  ...data,
                  size: (data.size ?? 1) + HIGHLIGHT_EDGE_SIZE_BUMP,
                  zIndex: Z_FOREGROUND,
                }
              }
              return { ...data, color: DIM_EDGE_COLOR, size: DIM_EDGE_SIZE, zIndex: Z_BACKGROUND }
            }

            if (hoveredEdge === edge) {
              return { ...data, size: (data.size ?? 1) + HIGHLIGHT_EDGE_SIZE_BUMP }
            }

            return data
          },
        })

        // --- Event handlers ---

        instance.on('clickNode', ({ node }: { node: string }) => {
          selectedNodeId = node
          const attrs = graph!.getNodeAttributes(node)
          onNodeClick?.(node, attrs as GraphNode)
        })

        instance.on('enterNode', ({ node }: { node: string }) => {
          const attrs = graph!.getNodeAttributes(node)
          onNodeHover?.(node, attrs as GraphNode)
        })

        instance.on('leaveNode', () => {
          onNodeHover?.(null, null)
        })

        if (resolvedConfig.enableEdgeEvents) {
          instance.on('clickEdge', ({ edge }: { edge: string }) => {
            selectedNodeId = null
            const attrs = graph!.getEdgeAttributes(edge)
            onEdgeClick?.(edge, attrs as GraphEdge)
          })

          instance.on('enterEdge', ({ edge }: { edge: string }) => {
            hoveredEdge = edge
            onEdgeHover?.(edge)
          })

          instance.on('leaveEdge', () => {
            hoveredEdge = null
            onEdgeHover?.(null)
          })
        }

        instance.on('clickStage', () => {
          selectedNodeId = null
          onStageClick?.()
        })

        // --- Drag support ---

        if (resolvedConfig.enableDrag) {
          let draggedNode: string | null = null
          let isDragging = false

          instance.on('downNode', ({ node }: { node: string }) => {
            isDragging = true
            draggedNode = node
            graph!.setNodeAttribute(node, 'fixed', true)
          })

          // Sigma v3 mouse captor event for mouse movement during drag.
          // If 'mousemovebody' does not work with the installed version,
          // try 'mousemove' as a fallback.
          instance.getMouseCaptor().on('mousemovebody', (e: any) => {
            if (!isDragging || !draggedNode) return
            const pos = instance.viewportToGraph(e)
            graph!.setNodeAttribute(draggedNode, 'x', pos.x)
            graph!.setNodeAttribute(draggedNode, 'y', pos.y)
          })

          instance.getMouseCaptor().on('mouseup', () => {
            if (draggedNode) {
              graph!.removeNodeAttribute(draggedNode, 'fixed')
            }
            isDragging = false
            draggedNode = null
          })
        }

        // --- Highlight on open ---

        if (highlightNode && graph!.hasNode(highlightNode)) {
          selectedNodeId = highlightNode
          const displayData = instance.getNodeDisplayData(highlightNode)
          if (displayData) {
            instance.getCamera().animate(
              { x: displayData.x, y: displayData.y, ratio: 0.3 },
              { duration: 300 },
            )
          }
          const attrs = graph!.getNodeAttributes(highlightNode)
          onNodeClick?.(highlightNode, attrs as GraphNode)
        }

        sigmaInstance = instance
      } catch (e) {
        initError = e instanceof Error ? e.message : 'Failed to initialize graph renderer'
        console.error('GraphView: Sigma initialization failed', e)
      }
    }

    initSigma()

    return () => {
      if (sigmaInstance) {
        sigmaInstance.kill()
        sigmaInstance = null
      }
    }
  })

  // ---------------------------------------------------------------------------
  // Refresh on selection/hover state changes
  // ---------------------------------------------------------------------------

  $effect(() => {
    // Track reactive values to trigger Sigma refresh for reducer updates
    const _sel = selectedNodeId
    const _hover = hoveredEdge
    sigmaInstance?.refresh()
  })

  // ---------------------------------------------------------------------------
  // Backup cleanup: onDestroy for abrupt component unmount
  // ---------------------------------------------------------------------------

  onDestroy(() => {
    if (sigmaInstance) {
      sigmaInstance.kill()
      sigmaInstance = null
    }
  })

  // ---------------------------------------------------------------------------
  // Public API: exported accessor functions for H5/H6 consumers
  // ---------------------------------------------------------------------------

  /**
   * Returns the current Sigma instance, or null if not initialized.
   * Used by H5 (sub-graph) and H6 (search/filter controllers).
   */
  export function getSigma(): any {
    return sigmaInstance
  }

  /**
   * Returns the current graphology Graph instance, or null if not built.
   */
  export function getGraph(): Graph | null {
    return graph
  }

  /**
   * Returns the graph container DOM element.
   * Used by GraphToolbar (Phase 55) for fullscreen toggle.
   */
  export function getContainer(): HTMLElement | null {
    return container
  }

  /**
   * Programmatically focus on a node: select it and animate the camera to it.
   * Used by H6 search results to navigate to a found node.
   */
  export function focusNode(nodeId: string): void {
    if (!graph?.hasNode(nodeId) || !sigmaInstance) return
    selectedNodeId = nodeId
    const displayData = sigmaInstance.getNodeDisplayData(nodeId)
    if (displayData) {
      sigmaInstance.getCamera().animate(
        { x: displayData.x, y: displayData.y, ratio: 0.3 },
        { duration: 300 },
      )
    }
    const attrs = graph.getNodeAttributes(nodeId)
    onNodeClick?.(nodeId, attrs as GraphNode)
  }
</script>

{#if initError}
  <div class="graph-error">
    <p>Graph rendering failed: {initError}</p>
  </div>
{/if}

<div class="graph-view" bind:this={container}></div>

<style>
  .graph-view {
    width: 100%;
    height: 100%;
    min-height: 300px;
    position: relative;
  }

  .graph-error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--color-error, #ef4444);
    font-size: 0.85rem;
    text-align: center;
    z-index: 10;
  }
</style>
