<!--
  ChainViewModal.svelte — Dual-mode chain view component.

  When isModal=true (default), renders as a full-screen modal overlay with
  backdrop, close button, and escape-key dismissal. When isModal=false,
  renders inline without modal chrome (used by the /chain route).

  The component manages its own Sigma.js WebGL lifecycle with dual cleanup:
  $effect return (primary, handles re-runs) and onDestroy (backup, handles
  abrupt unmount).
-->
<script lang="ts">
  import { browser } from '$app/environment'
  import { page } from '$app/state'
  import { onDestroy } from 'svelte'
  import { forge } from '$lib/sdk'
  import { StatusBadge, LoadingSpinner, EmptyState, ListSearchInput } from '$lib/components'
  import { NODE_COLORS, type ChainNode } from '$lib/graph/types'
  import { closeChainView } from '$lib/stores/chain-view.svelte'
  import type { Source, Bullet, Perspective } from '@forge/sdk'
  import Graph from 'graphology'

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  /** @param highlightNode — graph node key to highlight on open (e.g. "source-550e8400-...") */
  /** @param isModal — when true, renders with modal chrome; when false, renders inline */
  /** @param onClose — callback invoked when the modal is dismissed */
  let {
    highlightNode = null,
    isModal = true,
    onClose,
  }: {
    highlightNode?: string | null
    isModal?: boolean
    onClose?: () => void
  } = $props()

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let container = $state<HTMLDivElement | null>(null)
  let sigmaInstance: any = $state(null)
  let graph = $state<Graph | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  // Modal backdrop ref for focus management
  let backdropRef = $state<HTMLDivElement | null>(null)

  // Interaction state
  let selectedNodeId = $state<string | null>(null)
  let selectedNodeData = $state<ChainNode | null>(null)
  let searchQuery = $state('')
  let sourceTypeFilter = $state('all')
  let statusFilter = $state('all')
  let archetypeFilter = $state('all')

  // Edge interaction state
  let selectedEdgeData = $state<Record<string, unknown> | null>(null)
  let hoveredEdge = $state<string | null>(null)
  let edgeTooltip = $state<Record<string, unknown> | null>(null)
  let edgeTooltipPosition = $state({ x: 0, y: 0 })

  // Component-scope data for related entity lookups
  let allSources = $state<Source[]>([])
  let allBullets = $state<Bullet[]>([])
  let allPerspectives = $state<Perspective[]>([])

  // Stats
  let nodeCount = $state(0)
  let edgeCount = $state(0)
  let driftedCount = $state(0)

  // ---------------------------------------------------------------------------
  // Close handler
  // ---------------------------------------------------------------------------

  function close() {
    if (onClose) onClose()
    else closeChainView()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (isModal && e.key === 'Escape') close()
  }

  function handleBackdropClick() {
    close()
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function truncate(text: string, len = 60): string {
    if (!text) return ''
    if (text.length <= len) return text
    return text.slice(0, len) + '...'
  }

  function selectNodeInGraph(nodeKey: string) {
    if (!graph?.hasNode(nodeKey) || !sigmaInstance) return
    const attrs = graph.getNodeAttributes(nodeKey)
    selectedNodeId = nodeKey
    selectedNodeData = {
      id: attrs.entityId,
      label: attrs.label,
      type: attrs.entityType,
      content: attrs.content,
      status: attrs.status,
      sourceType: attrs.sourceType,
      archetype: attrs.archetype,
      domain: attrs.domain,
    }
    selectedEdgeData = null
    const displayData = sigmaInstance.getNodeDisplayData(nodeKey)
    if (displayData) {
      sigmaInstance.getCamera().animate(
        { x: displayData.x, y: displayData.y, ratio: 0.3 },
        { duration: 300 }
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Retry handler — must reset sigmaInstance before rebuilding
  // ---------------------------------------------------------------------------

  function handleRetry() {
    if (sigmaInstance) {
      sigmaInstance.kill()
      sigmaInstance = null
    }
    buildGraph()
  }

  // ---------------------------------------------------------------------------
  // Derived state for related entities
  // ---------------------------------------------------------------------------

  let relatedPerspectives = $derived(
    selectedNodeData?.type === 'bullet'
      ? allPerspectives.filter(p => p.bullet_id === selectedNodeData!.id)
      : []
  )

  let relatedBullets = $derived(
    selectedNodeData?.type === 'source'
      ? allBullets.filter(b => b.sources?.some(s => s.id === selectedNodeData!.id))
      : []
  )

  let parentBullet = $derived(
    selectedNodeData?.type === 'perspective'
      ? allBullets.find(b => {
          const persp = allPerspectives.find(p => p.id === selectedNodeData!.id)
          return persp ? b.id === persp.bullet_id : false
        }) ?? null
      : null
  )

  // ---------------------------------------------------------------------------
  // Graph building
  // ---------------------------------------------------------------------------

  async function buildGraph() {
    loading = true
    error = null

    try {
      const [sourcesRes, bulletsRes, perspectivesRes] = await Promise.all([
        forge.sources.list({ limit: 1000 }),
        forge.bullets.list({ limit: 1000 }),
        forge.perspectives.list({ limit: 1000 }),
      ])

      if (!sourcesRes.ok || !bulletsRes.ok || !perspectivesRes.ok) {
        error = 'Failed to load chain data'
        loading = false
        return
      }

      const sourcesData = sourcesRes.data
      const bulletsData = bulletsRes.data
      const perspectivesData = perspectivesRes.data

      // Promote to component scope for related-entity lookups
      allSources = sourcesData
      allBullets = bulletsData
      allPerspectives = perspectivesData

      const g = new Graph({ type: 'directed', multi: false })

      // Add source nodes
      for (const source of sourcesData) {
        g.addNode(`source-${source.id}`, {
          label: source.title,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 12,
          color: NODE_COLORS.source,
          type: 'circle',
          entityId: source.id,
          entityType: 'source',
          content: source.description,
          status: source.status,
          sourceType: source.source_type,
        })
      }

      // Add bullet nodes and edges to sources
      let drifted = 0
      for (const bullet of bulletsData) {
        g.addNode(`bullet-${bullet.id}`, {
          label: truncate(bullet.content, 60),
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 8,
          color: NODE_COLORS.bullet,
          type: 'circle',
          entityId: bullet.id,
          entityType: 'bullet',
          content: bullet.content,
          status: bullet.status,
          domain: bullet.domain,
        })

        // Edges from source(s) to bullet
        for (const src of bullet.sources ?? []) {
          const sourceNodeKey = `source-${src.id}`
          if (!g.hasNode(sourceNodeKey)) continue

          const sourceNode = sourcesData.find(s => s.id === src.id)
          if (!sourceNode) continue

          const snapshotMatch = bullet.source_content_snapshot === sourceNode.description
          if (!snapshotMatch) drifted++

          g.addEdge(sourceNodeKey, `bullet-${bullet.id}`, {
            size: src.is_primary ? 2 : 1,
            color: snapshotMatch ? '#94a3b8' : '#ef4444',
            type: 'arrow',
            drifted: !snapshotMatch,
            isPrimary: src.is_primary,
          })
        }
      }

      // Add perspective nodes and edges to bullets
      for (const perspective of perspectivesData) {
        g.addNode(`perspective-${perspective.id}`, {
          label: truncate(perspective.content, 60),
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 6,
          color: NODE_COLORS.perspective,
          type: 'circle',
          entityId: perspective.id,
          entityType: 'perspective',
          content: perspective.content,
          status: perspective.status,
          archetype: perspective.target_archetype,
          domain: perspective.domain,
        })

        const bulletNodeKey = `bullet-${perspective.bullet_id}`
        if (g.hasNode(bulletNodeKey)) {
          const parentBulletData = bulletsData.find(b => b.id === perspective.bullet_id)
          if (parentBulletData) {
            const snapshotMatch = perspective.bullet_content_snapshot === parentBulletData.content
            if (!snapshotMatch) drifted++

            g.addEdge(bulletNodeKey, `perspective-${perspective.id}`, {
              size: 1,
              color: snapshotMatch ? '#94a3b8' : '#ef4444',
              type: 'arrow',
              drifted: !snapshotMatch,
            })
          }
        }
      }

      // Run ForceAtlas2 layout
      if (g.order > 0) {
        const forceAtlas2 = await import('graphology-layout-forceatlas2')
        forceAtlas2.default.assign(g, {
          iterations: 100,
          settings: {
            gravity: 1,
            scalingRatio: 10,
            barnesHutOptimize: g.order > 100,
          },
        })
      }

      graph = g
      nodeCount = g.order
      edgeCount = g.size
      driftedCount = drifted
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to build graph'
    } finally {
      loading = false
    }
  }

  // ---------------------------------------------------------------------------
  // Sigma.js rendering (client-side only)
  // ---------------------------------------------------------------------------

  // Kick off data loading
  $effect(() => {
    buildGraph()
  })

  // Initialize Sigma when container and graph are ready
  $effect(() => {
    if (!browser || !container || !graph || sigmaInstance) return

    async function initSigma() {
      const { default: Sigma } = await import('sigma')

      const instance = new Sigma(graph!, container!, {
        renderEdgeLabels: false,
        enableEdgeEvents: true,
        defaultNodeType: 'circle',
        defaultEdgeType: 'arrow',
        zIndex: true,
        labelRenderedSizeThreshold: 6,
        nodeReducer: (node: string, data: Record<string, any>) => {
          if (!selectedNodeId) return data
          if (node === selectedNodeId || graph!.hasEdge(selectedNodeId, node) || graph!.hasEdge(node, selectedNodeId)) {
            return { ...data, zIndex: 1 }
          }
          return { ...data, color: '#e5e7eb', label: '', zIndex: 0 }
        },
        edgeReducer: (edge: string, data: Record<string, any>) => {
          const [src, tgt] = graph!.extremities(edge)
          const srcAttrs = graph!.getNodeAttributes(src)
          const tgtAttrs = graph!.getNodeAttributes(tgt)

          // Hide edges with hidden endpoints (filtered graphs)
          if (srcAttrs.hidden || tgtAttrs.hidden) {
            return { ...data, hidden: true }
          }

          // Node selection dimming
          if (selectedNodeId) {
            if (src === selectedNodeId || tgt === selectedNodeId) {
              return { ...data, size: (data.size ?? 1) + 1, zIndex: 1 }
            }
            return { ...data, color: '#f3f4f6', size: 0.5, zIndex: 0 }
          }

          // Edge hover highlight
          if (hoveredEdge === edge) {
            return { ...data, size: (data.size ?? 1) + 1 }
          }

          return data
        },
      })

      // Click handler
      instance.on('clickNode', ({ node }: { node: string }) => {
        const attrs = graph!.getNodeAttributes(node)
        selectedNodeId = node
        selectedNodeData = {
          id: attrs.entityId,
          label: attrs.label,
          type: attrs.entityType,
          content: attrs.content,
          status: attrs.status,
          sourceType: attrs.sourceType,
          archetype: attrs.archetype,
          domain: attrs.domain,
        }
        selectedEdgeData = null
      })

      // Click on background to deselect
      instance.on('clickStage', () => {
        selectedNodeId = null
        selectedNodeData = null
        selectedEdgeData = null
      })

      // Edge hover
      instance.on('enterEdge', ({ edge }: { edge: string }) => {
        const attrs = graph!.getEdgeAttributes(edge)
        const [sourceNode, targetNode] = graph!.extremities(edge)
        const sourceAttrs = graph!.getNodeAttributes(sourceNode)
        const targetAttrs = graph!.getNodeAttributes(targetNode)

        hoveredEdge = edge

        edgeTooltip = {
          sourceLabel: sourceAttrs.label,
          sourceType: sourceAttrs.entityType,
          targetLabel: targetAttrs.label,
          targetType: targetAttrs.entityType,
          isPrimary: attrs.isPrimary ?? false,
          drifted: attrs.drifted ?? false,
        }

        const canvasRect = container!.getBoundingClientRect()
        const sourceCoords = instance.graphToViewport({ x: sourceAttrs.x, y: sourceAttrs.y })
        const targetCoords = instance.graphToViewport({ x: targetAttrs.x, y: targetAttrs.y })
        edgeTooltipPosition = {
          x: canvasRect.left + (sourceCoords.x + targetCoords.x) / 2,
          y: canvasRect.top + (sourceCoords.y + targetCoords.y) / 2,
        }
      })

      instance.on('leaveEdge', () => {
        hoveredEdge = null
        edgeTooltip = null
      })

      // Edge click
      instance.on('clickEdge', ({ edge }: { edge: string }) => {
        const attrs = graph!.getEdgeAttributes(edge)
        const [sourceNode, targetNode] = graph!.extremities(edge)
        const sourceAttrs = graph!.getNodeAttributes(sourceNode)
        const targetAttrs = graph!.getNodeAttributes(targetNode)

        selectedNodeId = null
        selectedNodeData = null
        selectedEdgeData = {
          sourceLabel: sourceAttrs.label,
          sourceType: sourceAttrs.entityType,
          sourceId: sourceAttrs.entityId,
          sourceStatus: sourceAttrs.status,
          targetLabel: targetAttrs.label,
          targetType: targetAttrs.entityType,
          targetId: targetAttrs.entityId,
          targetStatus: targetAttrs.status,
          isPrimary: attrs.isPrimary ?? false,
          drifted: attrs.drifted ?? false,
        }
      })

      sigmaInstance = instance

      // Highlight handling — unified modal/standalone path.
      // In modal mode, use the highlightNode prop.
      // In standalone mode, read from URL query param.
      const nodeToHighlight = isModal ? highlightNode : page.url.searchParams.get('highlight')
      if (nodeToHighlight && graph!.hasNode(nodeToHighlight)) {
        // Enlarge and mark the highlighted node
        const attrs = graph!.getNodeAttributes(nodeToHighlight)
        graph!.setNodeAttribute(nodeToHighlight, 'size', (attrs.size ?? 8) * 2)
        graph!.setNodeAttribute(nodeToHighlight, 'highlighted', true)

        // Select and center via existing helper
        selectNodeInGraph(nodeToHighlight)
      }
    }

    initSigma()

    // Primary cleanup: handles re-runs (Retry button)
    return () => {
      if (sigmaInstance) {
        sigmaInstance.kill()
        sigmaInstance = null
      }
    }
  })

  // Belt-and-suspenders: onDestroy handles final component teardown
  onDestroy(() => {
    if (sigmaInstance) {
      sigmaInstance.kill()
      sigmaInstance = null
    }
  })

  // Body scroll lock (isModal treated as immutable prop)
  $effect(() => {
    if (isModal) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  })

  // Focus backdrop for keyboard events
  $effect(() => {
    if (isModal) backdropRef?.focus()
  })

  // Search and filter
  $effect(() => {
    if (!graph || !sigmaInstance) return

    graph.forEachNode((node: string, attrs: Record<string, any>) => {
      let visible = true

      // Source type filter
      if (sourceTypeFilter !== 'all' && attrs.entityType === 'source') {
        visible = attrs.sourceType === sourceTypeFilter
      }

      // Status filter
      if (statusFilter !== 'all') {
        visible = visible && attrs.status === statusFilter
      }

      // Archetype filter (perspectives only)
      if (archetypeFilter !== 'all' && attrs.entityType === 'perspective') {
        visible = visible && attrs.archetype === archetypeFilter
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        visible = visible && (
          (attrs.content?.toLowerCase().includes(q) ?? false) ||
          (attrs.label?.toLowerCase().includes(q) ?? false)
        )
      }

      graph!.setNodeAttribute(node, 'hidden', !visible)
    })

    sigmaInstance.refresh()
  })

  // Refresh Sigma on selection/hover state changes
  $effect(() => {
    const _sel = selectedNodeId
    const _edge = selectedEdgeData
    const _hover = hoveredEdge
    sigmaInstance?.refresh()
  })
</script>

{#snippet chainContent()}
  <!-- Controls -->
  <div class="controls">
    <div class="search-wrap">
      <ListSearchInput
        bind:value={searchQuery}
        placeholder="Search nodes by content..."
      />
    </div>

    <select class="filter-select" bind:value={sourceTypeFilter}>
      <option value="all">All source types</option>
      <option value="role">Roles</option>
      <option value="project">Projects</option>
      <option value="education">Education</option>
      <option value="clearance">Clearances</option>
      <option value="general">General</option>
    </select>

    <select class="filter-select" bind:value={statusFilter}>
      <option value="all">All statuses</option>
      <option value="draft">Draft</option>
      <option value="in_review">In Review</option>
      <option value="approved">Approved</option>
      <option value="rejected">Rejected</option>
      <option value="archived">Archived</option>
    </select>

    <select class="filter-select" bind:value={archetypeFilter}>
      <option value="all">All archetypes</option>
      <option value="agentic-ai">Agentic AI</option>
      <option value="infrastructure">Infrastructure</option>
      <option value="security-engineer">Security Engineer</option>
      <option value="solutions-architect">Solutions Architect</option>
      <option value="public-sector">Public Sector</option>
      <option value="hft">HFT</option>
    </select>
  </div>

  <!-- Stats bar -->
  <div class="stats-bar">
    <span class="stat"><strong>{nodeCount}</strong> nodes</span>
    <span class="stat"><strong>{edgeCount}</strong> edges</span>
    {#if driftedCount > 0}
      <span class="stat drift-stat"><strong>{driftedCount}</strong> drifted</span>
    {/if}
    <div class="legend">
      <span class="legend-item"><span class="legend-dot" style:background={NODE_COLORS.source}></span> Source</span>
      <span class="legend-item"><span class="legend-dot" style:background={NODE_COLORS.bullet}></span> Bullet</span>
      <span class="legend-item"><span class="legend-dot" style:background={NODE_COLORS.perspective}></span> Perspective</span>
      <span class="legend-item"><span class="legend-dot" style:background={NODE_COLORS.resume_entry}></span> Entry</span>
      <span class="legend-divider">|</span>
      <span class="legend-item"><span class="legend-line" style:background="#94a3b8"></span> Matching</span>
      <span class="legend-item"><span class="legend-line" style:background="#ef4444"></span> Drifted</span>
    </div>
  </div>

  {#if loading}
    <div class="loading-container">
      <LoadingSpinner size="lg" message="Building chain graph..." />
    </div>
  {:else if error}
    <div class="error-banner">
      <p>{error}</p>
      <button class="retry-btn" onclick={handleRetry}>Retry</button>
    </div>
  {:else if nodeCount === 0}
    <EmptyState
      title="No chain data"
      description="Create sources and derive bullets to see the provenance graph."
    />
  {:else}
    <div class="graph-layout" class:graph-layout-standalone={!isModal}>
      <!-- Graph container -->
      <div class="graph-container" bind:this={container}></div>

      <!-- Detail panel (shown when node selected) -->
      {#if selectedNodeData}
        <div class="detail-panel">
          <div class="detail-header">
            <span class="node-type-icon" style:background={NODE_COLORS[selectedNodeData.type]}>
              {selectedNodeData.type[0].toUpperCase()}
            </span>
            <h3 class="detail-title">{selectedNodeData.label}</h3>
            <button class="close-btn" onclick={() => { selectedNodeId = null; selectedNodeData = null }}>
              Close
            </button>
          </div>

          <div class="detail-body">
            <div class="detail-field">
              <span class="field-label">Type</span>
              <span class="field-value">{selectedNodeData.type}</span>
            </div>

            <div class="detail-field">
              <span class="field-label">Status</span>
              <StatusBadge status={selectedNodeData.status} />
            </div>

            {#if selectedNodeData.sourceType}
              <div class="detail-field">
                <span class="field-label">Source Type</span>
                <span class="field-value">{selectedNodeData.sourceType}</span>
              </div>
            {/if}

            {#if selectedNodeData.archetype}
              <div class="detail-field">
                <span class="field-label">Archetype</span>
                <span class="field-value">{selectedNodeData.archetype}</span>
              </div>
            {/if}

            {#if selectedNodeData.domain}
              <div class="detail-field">
                <span class="field-label">Domain</span>
                <span class="field-value">{selectedNodeData.domain}</span>
              </div>
            {/if}

            <div class="detail-field">
              <span class="field-label">Content</span>
              <p class="field-content">{selectedNodeData.content}</p>
            </div>

            <div class="detail-field">
              <span class="field-label">ID</span>
              <span class="field-value mono">{selectedNodeData.id}</span>
            </div>

            <!-- Related entities -->
            {#if selectedNodeData.type === 'bullet'}
              <div class="related-section">
                <h4 class="related-header">
                  Perspectives ({relatedPerspectives.length})
                </h4>
                {#each relatedPerspectives as persp}
                  <button class="related-card"
                    onclick={() => selectNodeInGraph(`perspective-${persp.id}`)}
                  >
                    <div class="related-content">{truncate(persp.content, 80)}</div>
                    <div class="related-meta">
                      {#if persp.target_archetype}
                        <span class="archetype-tag">{persp.target_archetype}</span>
                      {/if}
                      {#if persp.domain}
                        <span class="domain-tag">{persp.domain}</span>
                      {/if}
                      <StatusBadge status={persp.status} />
                    </div>
                  </button>
                {/each}
              </div>
            {/if}

            {#if selectedNodeData.type === 'source'}
              <div class="related-section">
                <h4 class="related-header">
                  Bullets ({relatedBullets.length})
                </h4>
                {#each relatedBullets as bullet}
                  <button class="related-card"
                    onclick={() => selectNodeInGraph(`bullet-${bullet.id}`)}
                  >
                    <div class="related-content">{truncate(bullet.content, 80)}</div>
                    <div class="related-meta">
                      {#if bullet.domain}
                        <span class="domain-tag">{bullet.domain}</span>
                      {/if}
                      <StatusBadge status={bullet.status} />
                    </div>
                  </button>
                {/each}
              </div>
            {/if}

            {#if selectedNodeData.type === 'perspective' && parentBullet}
              <div class="related-section">
                <h4 class="related-header">Parent Bullet</h4>
                <button class="related-card"
                  onclick={() => selectNodeInGraph(`bullet-${parentBullet.id}`)}
                >
                  <div class="related-content">{truncate(parentBullet.content, 80)}</div>
                  <div class="related-meta">
                    {#if parentBullet.domain}
                      <span class="domain-tag">{parentBullet.domain}</span>
                    {/if}
                    <StatusBadge status={parentBullet.status} />
                  </div>
                </button>
              </div>
            {/if}
          </div>
        </div>
      {:else if selectedEdgeData}
        <div class="detail-panel">
          <div class="detail-header">
            <h3 class="detail-title">Edge Detail</h3>
            <button class="close-btn" onclick={() => { selectedEdgeData = null }}>
              Close
            </button>
          </div>
          <div class="detail-body">
            <div class="edge-detail-row">
              <span class="edge-detail-icon" style:background={NODE_COLORS[String(selectedEdgeData.sourceType)]}>
                {String(selectedEdgeData.sourceType).charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{selectedEdgeData.sourceLabel}</strong>
                <StatusBadge status={String(selectedEdgeData.sourceStatus)} />
              </div>
            </div>
            <div class="edge-detail-arrow">&rarr;</div>
            <div class="edge-detail-row">
              <span class="edge-detail-icon" style:background={NODE_COLORS[String(selectedEdgeData.targetType)]}>
                {String(selectedEdgeData.targetType).charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{selectedEdgeData.targetLabel}</strong>
                <StatusBadge status={String(selectedEdgeData.targetStatus)} />
              </div>
            </div>
            <div class="edge-detail-meta">
              {#if selectedEdgeData.isPrimary}
                <span class="primary-badge">Primary</span>
              {/if}
              {#if selectedEdgeData.drifted}
                <span class="drift-badge">Drifted</span>
              {:else}
                <span class="match-badge">Matches</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Edge tooltip: OUTSIDE .graph-layout to avoid overflow: hidden clipping -->
    {#if edgeTooltip}
      <div class="edge-tooltip" style="left: {edgeTooltipPosition.x}px; top: {edgeTooltipPosition.y}px;">
        <div class="edge-tooltip-row">
          <span class="edge-node-type" style:background={NODE_COLORS[String(edgeTooltip.sourceType)]}>
            {String(edgeTooltip.sourceType).charAt(0).toUpperCase()}
          </span>
          <span class="edge-tooltip-label">{truncate(String(edgeTooltip.sourceLabel), 40)}</span>
          <span class="edge-arrow">&rarr;</span>
          <span class="edge-node-type" style:background={NODE_COLORS[String(edgeTooltip.targetType)]}>
            {String(edgeTooltip.targetType).charAt(0).toUpperCase()}
          </span>
          <span class="edge-tooltip-label">{truncate(String(edgeTooltip.targetLabel), 40)}</span>
        </div>
        <div class="edge-tooltip-meta">
          {#if edgeTooltip.isPrimary}<span class="primary-badge">Primary</span>{/if}
          {#if edgeTooltip.drifted}<span class="drift-badge">Snapshot drifted</span>
          {:else}<span class="match-badge">Snapshot matches</span>{/if}
        </div>
      </div>
    {/if}
  {/if}
{/snippet}

{#if isModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="chain-modal-backdrop"
    bind:this={backdropRef}
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    tabindex="-1"
  >
    <div
      class="chain-modal-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chain-modal-title"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="chain-modal-header">
        <h2 id="chain-modal-title">Chain View</h2>
        <button class="modal-close-btn" onclick={close}>Close</button>
      </div>
      {@render chainContent()}
    </div>
  </div>
{:else}
  {@render chainContent()}
{/if}

<style>
  /* Controls */
  .controls {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .search-wrap {
    flex: 1;
    min-width: 200px;
  }

  .filter-select {
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    background: var(--color-surface);
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  /* Stats bar */
  .stats-bar {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    margin-bottom: 0.75rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .drift-stat {
    color: var(--color-danger);
  }

  .legend {
    display: flex;
    gap: 0.75rem;
    margin-left: auto;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  /* Loading / error */
  .loading-container {
    display: flex;
    justify-content: center;
    padding: 4rem 0;
  }

  .error-banner {
    background: var(--color-danger-subtle);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-lg);
    padding: 1.25rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    color: var(--color-danger-text);
    font-size: 0.9rem;
  }

  .retry-btn {
    padding: 0.4rem 1rem;
    background: var(--color-danger);
    color: var(--text-inverse);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    transition: background 0.15s;
  }

  .retry-btn:hover {
    background: var(--color-danger-hover);
  }

  /* Graph layout */
  .graph-layout {
    display: flex;
    gap: 0;
    flex: 1;
    min-height: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--color-surface);
  }

  .graph-layout-standalone {
    height: calc(100vh - 260px);
  }

  .graph-container {
    flex: 1;
    min-width: 0;
  }

  /* Detail panel */
  .detail-panel {
    width: 320px;
    border-left: 1px solid var(--color-border);
    overflow-y: auto;
    flex-shrink: 0;
  }

  .detail-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-raised);
  }

  .node-type-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }

  .detail-title {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close-btn {
    padding: 0.3rem 0.65rem;
    background: none;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
    transition: background 0.1s;
  }

  .close-btn:hover {
    background: var(--color-ghost);
  }

  .detail-body {
    padding: 1rem;
  }

  .detail-field {
    margin-bottom: 1rem;
  }

  .field-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.25rem;
  }

  .field-value {
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .field-content {
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .mono {
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 0.8rem;
  }

  /* Edge tooltip */
  .edge-tooltip {
    position: fixed;
    background: var(--color-sidebar-bg);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    pointer-events: none;
    z-index: 100;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transform: translate(-50%, -100%);
    margin-top: -8px;
  }

  .edge-tooltip-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .edge-node-type {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
  }

  .edge-tooltip-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }

  .edge-arrow { color: var(--text-muted); font-size: 0.9rem; }

  .edge-tooltip-meta {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.35rem;
    font-size: 0.75rem;
  }

  .primary-badge {
    background: var(--color-info-subtle);
    color: var(--color-info-text);
    padding: 0.1em 0.4em;
    border-radius: 3px;
    font-weight: 600;
  }

  .drift-badge { color: var(--color-danger); }
  .match-badge { color: var(--color-success); }

  /* Edge detail panel */
  .edge-detail-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .edge-detail-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }

  .edge-detail-arrow {
    text-align: center;
    font-size: 1.2rem;
    color: var(--text-muted);
    margin: 0.25rem 0;
  }

  .edge-detail-meta {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
  }

  /* Related entities */
  .related-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .related-header {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.5rem;
  }

  .related-card {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.5rem;
    margin-bottom: 0.35rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s, border-color 0.1s;
  }

  .related-card:hover {
    background: var(--color-surface-raised);
    border-color: var(--color-primary);
  }

  .related-content {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.4;
    margin-bottom: 0.25rem;
  }

  .related-meta {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .archetype-tag, .domain-tag {
    display: inline-block;
    padding: 0.1em 0.35em;
    font-size: 0.65rem;
    font-weight: 600;
    border-radius: 3px;
    background: var(--color-surface-sunken);
    color: var(--text-secondary);
  }

  .archetype-tag {
    background: #ede9fe;
    color: #5b21b6;
  }

  .domain-tag {
    background: var(--color-success-subtle);
    color: var(--color-success-text);
  }

  /* Legend additions */
  .legend-line {
    display: inline-block;
    width: 16px;
    height: 2px;
    vertical-align: middle;
    margin-right: 4px;
  }

  .legend-divider {
    color: var(--color-border-strong);
    margin: 0 0.25rem;
  }

  /* Modal chrome */
  .chain-modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    z-index: var(--z-modal);
  }

  .chain-modal-backdrop:focus {
    outline: none;
  }

  .chain-modal-content {
    position: absolute;
    inset: 2rem;
    background: var(--color-surface);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .chain-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-raised);
    flex-shrink: 0;
  }

  .chain-modal-header h2 {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-close-btn {
    padding: 0.35rem 0.75rem;
    background: none;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s;
  }

  .modal-close-btn:hover {
    background: var(--color-ghost);
  }
</style>
