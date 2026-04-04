<!--
  GraphToolbar.svelte — Floating toolbar overlay for graph interactions.
  Provides zoom, layout toggle, reset, and fullscreen controls.

  Keyboard shortcuts:
    Ctrl/Cmd + =    Zoom in
    Ctrl/Cmd + -    Zoom out
    Ctrl/Cmd + 0    Fit to screen
    Space           Toggle layout (when graph focused)
    F / F11         Toggle fullscreen
-->
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { zoomIn, zoomOut, fitToScreen, toggleFullscreen, isInputFocused } from './graph.toolbar'
  import type { GraphConfig } from './graph.types'
  import type Graph from 'graphology'

  interface GraphToolbarProps {
    /** Reference to the GraphView component */
    graphView: any
    /** The graph config (for layout parameters) */
    config: GraphConfig
    /**
     * The graphology Graph instance, passed as a direct prop from the parent.
     * CRITICAL: The `$effect` tracking `graphView?.getGraph?.()` will not detect
     * inner state changes. Instead, accept `graph` as a direct prop. Svelte 5
     * reactivity tracks prop changes, so when the parent rebuilds the graph and
     * passes a new reference, this component reacts correctly.
     */
    graph?: Graph | null
    /** Position of the toolbar */
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
    /** Show fullscreen toggle */
    showFullscreen?: boolean
  }

  let {
    graphView,
    config,
    graph = null,
    position = 'top-right',
    showFullscreen = true,
  }: GraphToolbarProps = $props()

  // Layout state -- NOT $state for the FA2 instance (mutable external object)
  let fa2Instance: any = null
  let layoutRunning = $state(false)
  let isFullscreen = $state(false)

  // Track graph changes to kill stale FA2 instances.
  // Uses the `graph` prop (direct reference) instead of `graphView?.getGraph?.()`.
  // Svelte 5 reactivity tracks prop changes, so this $effect runs when the
  // parent passes a new Graph reference.
  $effect(() => {
    const _graph = graph  // track reactive dependency on the prop
    // Kill stale instance when graph reference changes
    if (fa2Instance) {
      fa2Instance.kill()
      fa2Instance = null
      layoutRunning = false
    }
  })

  // Listen for fullscreen changes
  $effect(() => {
    function handleFullscreenChange() {
      isFullscreen = !!document.fullscreenElement
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  })

  async function toggleLayout() {
    if (!graph) return

    if (layoutRunning && fa2Instance) {
      fa2Instance.stop()
      layoutRunning = false
      return
    }

    if (!fa2Instance) {
      try {
        const { default: FA2Layout } = await import('graphology-layout-forceatlas2/worker')
        fa2Instance = new FA2Layout(graph, {
          settings: {
            gravity: config.forces.gravity,
            scalingRatio: config.forces.scalingRatio,
            slowDown: config.forces.slowDown,
            barnesHutOptimize: config.forces.barnesHutOptimize
              ?? graph.order > (config.forces.barnesHutThreshold ?? 100),
          },
        })
      } catch (e) {
        console.warn('GraphToolbar: Failed to initialize FA2 worker', e)
        return
      }
    }

    fa2Instance.start()
    layoutRunning = true
  }

  function stopLayout() {
    if (fa2Instance) {
      fa2Instance.stop()
      fa2Instance.kill()
      fa2Instance = null
      layoutRunning = false
    }
  }

  async function resetGraph() {
    const sigma = graphView?.getSigma?.()
    if (!sigma || !graph) return

    stopLayout()

    // Re-run one-shot layout
    try {
      const forceAtlas2 = await import('graphology-layout-forceatlas2')
      forceAtlas2.default.assign(graph, {
        iterations: config.forces.iterations ?? 100,
        settings: {
          gravity: config.forces.gravity,
          scalingRatio: config.forces.scalingRatio,
          slowDown: config.forces.slowDown,
        },
      })
    } catch (e) {
      console.warn('GraphToolbar: Failed to re-run layout', e)
    }

    sigma.refresh()
    sigma.getCamera().animatedReset({ duration: 300 })
  }

  function handleKeydown(e: KeyboardEvent) {
    const sigma = graphView?.getSigma?.()
    if (!sigma) return

    const mod = e.metaKey || e.ctrlKey

    if (mod && e.key === '=') {
      e.preventDefault()
      zoomIn(sigma)
    }
    if (mod && e.key === '-') {
      e.preventDefault()
      zoomOut(sigma)
    }
    if (mod && e.key === '0') {
      e.preventDefault()
      fitToScreen(sigma)
    }
    if (
      e.key === ' '
      && !isInputFocused(e)
      && graphView?.getContainer?.()?.contains(document.activeElement)
    ) {
      e.preventDefault()
      toggleLayout()
    }
    if ((e.key === 'f' || e.key === 'F11') && !isInputFocused(e)) {
      const container = graphView?.getContainer?.()
      if (container) {
        e.preventDefault()
        toggleFullscreen(container)
      }
    }
  }

  // Register keyboard listener on mount
  $effect(() => {
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  })

  // Cleanup FA2 worker on unmount
  onDestroy(() => {
    if (fa2Instance) {
      fa2Instance.kill()
      fa2Instance = null
    }
  })

  let sigmaReady = $derived(!!graphView?.getSigma?.())
</script>

<div class="graph-toolbar {position}">
  <div class="toolbar-group">
    <button
      class="toolbar-btn"
      title="Zoom In (Ctrl/Cmd + =)"
      disabled={!sigmaReady}
      onclick={() => { const s = graphView?.getSigma?.(); if (s) zoomIn(s) }}
    >+</button>
    <button
      class="toolbar-btn"
      title="Zoom Out (Ctrl/Cmd + -)"
      disabled={!sigmaReady}
      onclick={() => { const s = graphView?.getSigma?.(); if (s) zoomOut(s) }}
    >-</button>
    <button
      class="toolbar-btn"
      title="Fit to Screen (Ctrl/Cmd + 0)"
      disabled={!sigmaReady}
      onclick={() => { const s = graphView?.getSigma?.(); if (s) fitToScreen(s) }}
    >&#8862;</button>
  </div>

  <div class="toolbar-separator"></div>

  <div class="toolbar-group">
    <button
      class="toolbar-btn"
      class:active={layoutRunning}
      title={layoutRunning ? 'Pause Layout (Space)' : 'Start Layout (Space)'}
      disabled={!sigmaReady}
      onclick={toggleLayout}
    >{layoutRunning ? '&#9208;' : '&#9654;'}</button>
    <button
      class="toolbar-btn"
      title="Reset Graph"
      disabled={!sigmaReady}
      onclick={resetGraph}
    >&#8634;</button>
    {#if showFullscreen}
      <button
        class="toolbar-btn"
        class:active={isFullscreen}
        title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
        onclick={() => { const c = graphView?.getContainer?.(); if (c) toggleFullscreen(c) }}
      >&#9974;</button>
    {/if}
  </div>
</div>

<style>
  .graph-toolbar {
    position: absolute;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 4px);
    padding: var(--space-1, 4px);
    background: var(--color-surface, rgba(255, 255, 255, 0.9));
    border-radius: var(--radius-lg, 8px);
    box-shadow: var(--shadow-sm, 0 1px 4px rgba(0, 0, 0, 0.1));
    backdrop-filter: blur(4px);
  }

  .graph-toolbar.top-right {
    top: var(--space-2, 8px);
    right: var(--space-2, 8px);
  }

  .graph-toolbar.top-left {
    top: var(--space-2, 8px);
    left: var(--space-2, 8px);
  }

  .graph-toolbar.bottom-right {
    bottom: var(--space-2, 8px);
    right: var(--space-2, 8px);
  }

  .graph-toolbar.bottom-left {
    bottom: var(--space-2, 8px);
    left: var(--space-2, 8px);
  }

  .toolbar-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toolbar-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface, white);
    cursor: pointer;
    font-size: 16px;
    color: var(--text-primary, #1a1a2e);
    transition: background-color 0.15s;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: var(--color-ghost, #f3f4f6);
  }

  .toolbar-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toolbar-btn.active {
    background: var(--color-primary-subtle, #dbeafe);
    border-color: var(--color-primary, #3b82f6);
  }

  .toolbar-separator {
    width: 24px;
    height: 1px;
    background: var(--color-border, #e5e7eb);
    margin: 2px auto;
  }
</style>
