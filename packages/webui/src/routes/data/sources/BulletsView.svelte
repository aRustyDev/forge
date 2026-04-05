<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { StatusBadge, LoadingSpinner, EmptyState } from '$lib/components'
  import BulletDetailModal from '$lib/components/BulletDetailModal.svelte'
  import ViewToggle from '$lib/components/ViewToggle.svelte'
  import GenericKanban from '$lib/components/kanban/GenericKanban.svelte'
  import BulletKanbanCard from '$lib/components/kanban/BulletKanbanCard.svelte'
  import PerspectiveKanbanCard from '$lib/components/kanban/PerspectiveKanbanCard.svelte'
  import BulletFilterBar from '$lib/components/filters/BulletFilterBar.svelte'
  import PerspectiveFilterBar from '$lib/components/filters/PerspectiveFilterBar.svelte'
  import { getViewMode, setViewMode } from '$lib/stores/viewMode.svelte'
  import type { Bullet, Perspective } from '@forge/sdk'

  type ContentType = 'bullet' | 'perspective'

  let contentType = $state<ContentType>('bullet')
  let items = $state<any[]>([])
  let loading = $state(true)
  let searchQuery = $state('')
  let statusFilter = $state('all')

  // View mode: list or board
  let viewMode = $state<'list' | 'board'>(getViewMode('bullets'))

  function handleViewChange(mode: 'list' | 'board') {
    viewMode = mode
    setViewMode(contentType === 'bullet' ? 'bullets' : 'perspectives', mode)
  }

  // Column definitions for kanban boards
  const BULLET_COLUMNS = [
    { key: 'draft', label: 'Draft', statuses: ['draft'], accent: '#a5b4fc' },
    { key: 'in_review', label: 'In Review', statuses: ['in_review'], accent: '#fbbf24' },
    { key: 'approved', label: 'Approved', statuses: ['approved'], accent: '#22c55e' },
    { key: 'rejected', label: 'Rejected', statuses: ['rejected'], accent: '#ef4444' },
    { key: 'archived', label: 'Archived', statuses: ['archived'], accent: '#d1d5db' },
  ]

  const PERSPECTIVE_COLUMNS = [
    { key: 'draft', label: 'Draft', statuses: ['draft'], accent: '#a5b4fc' },
    { key: 'in_review', label: 'In Review', statuses: ['in_review'], accent: '#fbbf24' },
    { key: 'approved', label: 'Approved', statuses: ['approved'], accent: '#22c55e' },
    { key: 'rejected', label: 'Rejected', statuses: ['rejected'], accent: '#ef4444' },
    { key: 'archived', label: 'Archived', statuses: ['archived'], accent: '#d1d5db' },
  ]

  // Board filter state
  let bulletBoardFilters = $state<{ source?: string; domain?: string; search?: string }>({})
  let perspectiveBoardFilters = $state<{ archetype?: string; domain?: string; framing?: string; search?: string }>({})

  let boardFilteredItems = $derived.by(() => {
    if (contentType === 'bullet') {
      let result = items
      if (bulletBoardFilters.domain) result = result.filter((b: any) => b.domain === bulletBoardFilters.domain)
      if (bulletBoardFilters.search) {
        const q = bulletBoardFilters.search.toLowerCase()
        result = result.filter((b: any) => b.content.toLowerCase().includes(q))
      }
      return result
    } else {
      let result = items
      if (perspectiveBoardFilters.archetype) result = result.filter((p: any) => p.target_archetype === perspectiveBoardFilters.archetype)
      if (perspectiveBoardFilters.domain) result = result.filter((p: any) => p.domain === perspectiveBoardFilters.domain)
      if (perspectiveBoardFilters.framing) result = result.filter((p: any) => p.framing === perspectiveBoardFilters.framing)
      if (perspectiveBoardFilters.search) {
        const q = perspectiveBoardFilters.search.toLowerCase()
        result = result.filter((p: any) => p.content.toLowerCase().includes(q))
      }
      return result
    }
  })

  async function handleBoardDrop(itemId: string, newStatus: string) {
    if (contentType === 'bullet') {
      const result = await forge.bullets.update(itemId, { status: newStatus } as any)
      if (!result.ok) {
        addToast({ type: 'error', message: friendlyError(result.error, 'Status update failed') })
        throw new Error('Status update failed')
      }
      items = items.map(i => i.id === itemId ? result.data : i)
      addToast({ type: 'success', message: `Bullet moved to ${newStatus.replace('_', ' ')}` })
    } else {
      const result = await forge.perspectives.update(itemId, { status: newStatus } as any)
      if (!result.ok) {
        addToast({ type: 'error', message: friendlyError(result.error, 'Status update failed') })
        throw new Error('Status update failed')
      }
      items = items.map(i => i.id === itemId ? result.data : i)
      addToast({ type: 'success', message: `Perspective moved to ${newStatus.replace('_', ' ')}` })
    }
  }

  // Bullet detail modal
  let detailBulletId = $state<string | null>(null)

  // Reject modal
  let rejectModal = $state<{
    open: boolean
    type: ContentType
    id: string
    reason: string
  }>({ open: false, type: 'bullet', id: '', reason: '' })

  let filteredItems = $derived.by(() => {
    let result = items
    if (statusFilter !== 'all') {
      result = result.filter((i: any) => i.status === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((i: any) => i.content.toLowerCase().includes(q))
    }
    return result
  })

  $effect(() => {
    loadItems()
  })

  async function loadItems() {
    loading = true
    items = []

    if (contentType === 'bullet') {
      const result = await forge.bullets.list({ limit: 500 })
      if (result.ok) items = result.data
      else addToast({ message: friendlyError(result.error, 'Failed to load bullets'), type: 'error' })
    } else if (contentType === 'perspective') {
      const result = await forge.perspectives.list({ limit: 500 })
      if (result.ok) items = result.data
      else addToast({ message: friendlyError(result.error, 'Failed to load perspectives'), type: 'error' })
    }

    loading = false
  }

  function switchType(type: ContentType) {
    contentType = type
    statusFilter = 'all'
    searchQuery = ''
  }

  async function approveItem(id: string) {
    if (contentType === 'bullet') {
      const res = await forge.bullets.approve(id)
      if (res.ok) {
        items = items.map(i => i.id === id ? res.data : i)
        addToast({ message: 'Bullet approved', type: 'success' })
      } else {
        addToast({ message: `Approve failed: ${res.error.message}`, type: 'error' })
      }
    } else if (contentType === 'perspective') {
      const res = await forge.perspectives.approve(id)
      if (res.ok) {
        items = items.map(i => i.id === id ? res.data : i)
        addToast({ message: 'Perspective approved', type: 'success' })
      } else {
        addToast({ message: `Approve failed: ${res.error.message}`, type: 'error' })
      }
    }
  }

  function openReject(id: string) {
    rejectModal = { open: true, type: contentType, id, reason: '' }
  }

  async function submitReject() {
    if (!rejectModal.reason.trim()) {
      addToast({ message: 'Please provide a rejection reason.', type: 'error' })
      return
    }

    const { type, id, reason } = rejectModal

    if (type === 'bullet') {
      const res = await forge.bullets.reject(id, { rejection_reason: reason })
      if (res.ok) {
        items = items.map(i => i.id === id ? res.data : i)
        addToast({ message: 'Bullet rejected', type: 'success' })
      } else {
        addToast({ message: `Reject failed: ${res.error.message}`, type: 'error' })
      }
    } else if (type === 'perspective') {
      const res = await forge.perspectives.reject(id, { rejection_reason: reason })
      if (res.ok) {
        items = items.map(i => i.id === id ? res.data : i)
        addToast({ message: 'Perspective rejected', type: 'success' })
      } else {
        addToast({ message: `Reject failed: ${res.error.message}`, type: 'error' })
      }
    }

    rejectModal = { open: false, type: 'bullet', id: '', reason: '' }
  }

  async function reopenItem(id: string) {
    if (contentType === 'bullet') {
      const res = await forge.bullets.reopen(id)
      if (res.ok) {
        items = items.map(i => i.id === id ? res.data : i)
        addToast({ message: 'Bullet reopened', type: 'success' })
      } else {
        addToast({ message: `Reopen failed: ${res.error.message}`, type: 'error' })
      }
    } else if (contentType === 'perspective') {
      const res = await forge.perspectives.reopen(id)
      if (res.ok) {
        items = items.map(i => i.id === id ? res.data : i)
        addToast({ message: 'Perspective reopened', type: 'success' })
      } else {
        addToast({ message: `Reopen failed: ${res.error.message}`, type: 'error' })
      }
    }
  }

  function truncate(text: string, max: number = 200): string {
    if (text.length <= max) return text
    return text.slice(0, max) + '...'
  }
</script>

<div class="bullets-page">
  <div class="page-header-row">
    <div>
      <h1 class="page-title">Content Atoms</h1>
      <p class="subtitle">Unified view of bullets and perspectives</p>
    </div>
    <ViewToggle mode={viewMode} onchange={handleViewChange} />
  </div>

  <!-- Controls -->
  <div class="controls">
    <div class="type-tabs">
      {#each [
        { value: 'bullet', label: 'Bullets' },
        { value: 'perspective', label: 'Perspectives' },
      ] as tab}
        <button
          class="type-tab"
          class:active={contentType === tab.value}
          onclick={() => switchType(tab.value as ContentType)}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <input
      type="text"
      class="search-input"
      placeholder="Search content..."
      bind:value={searchQuery}
    />

    <select class="status-select" bind:value={statusFilter}>
      <option value="all">All statuses</option>
      <option value="in_review">In Review</option>
      <option value="approved">Approved</option>
      <option value="rejected">Rejected</option>
      <option value="draft">Draft</option>
      <option value="archived">Archived</option>
    </select>
  </div>

  {#if viewMode === 'board'}
    <!-- Board view -->
    {#if contentType === 'bullet'}
      <GenericKanban
        columns={BULLET_COLUMNS}
        items={boardFilteredItems}
        onDrop={handleBoardDrop}
        {loading}
        emptyMessage="No bullets yet. Create sources and derive bullets to populate this board."
        defaultCollapsed="archived"
        sortItems={(a, b) => a.content.localeCompare(b.content)}
      >
        {#snippet filterBar()}
          <BulletFilterBar bind:filters={bulletBoardFilters} onchange={() => {}} />
        {/snippet}

        {#snippet cardContent(bullet)}
          <BulletKanbanCard {bullet} onclick={() => detailBulletId = bullet.id} />
        {/snippet}
      </GenericKanban>
    {:else}
      <GenericKanban
        columns={PERSPECTIVE_COLUMNS}
        items={boardFilteredItems}
        onDrop={handleBoardDrop}
        {loading}
        emptyMessage="No perspectives yet. Derive perspectives from approved bullets."
        defaultCollapsed="archived"
        sortItems={(a, b) => a.content.localeCompare(b.content)}
      >
        {#snippet filterBar()}
          <PerspectiveFilterBar bind:filters={perspectiveBoardFilters} onchange={() => {}} />
        {/snippet}

        {#snippet cardContent(perspective)}
          <PerspectiveKanbanCard {perspective} onclick={() => detailBulletId = perspective.bullet_id} />
        {/snippet}
      </GenericKanban>
    {/if}
  {:else}
  <!-- Item list (list view) -->
  {#if loading}
    <div class="loading-container">
      <LoadingSpinner size="lg" message="Loading {contentType}s..." />
    </div>
  {:else if filteredItems.length === 0}
    <EmptyState
      title="No {contentType}s found"
      description={searchQuery ? 'Try adjusting your search.' : 'No items match the current filters.'}
    />
  {:else}
    <div class="item-list">
      {#each filteredItems as item (item.id)}
        <div class="item-card" style="cursor: pointer;" onclick={() => detailBulletId = contentType === 'perspective' ? item.bullet_id : item.id}>
          <div class="item-header">
            <p class="item-content">{truncate(item.content, 200)}</p>
            <StatusBadge status={item.status} />
          </div>

          <!-- Bullet-specific metadata -->
          {#if contentType === 'bullet'}
            {#if item.sources?.length > 0}
              <div class="meta-row">
                <span class="meta-label">Sources:</span>
                {#each item.sources as src}
                  <span class="source-tag" class:primary={src.is_primary}>
                    {src.title}
                  </span>
                {/each}
              </div>
            {/if}
            {#if item.technologies?.length > 0}
              <div class="tech-tags">
                {#each item.technologies as tech}
                  <span class="tech-tag">{tech}</span>
                {/each}
              </div>
            {/if}
          {/if}

          <!-- Perspective-specific metadata -->
          {#if contentType === 'perspective'}
            <div class="perspective-meta">
              {#if item.target_archetype}
                <span class="meta-tag archetype">{item.target_archetype}</span>
              {/if}
              {#if item.domain}
                <span class="meta-tag domain">{item.domain}</span>
              {/if}
              <span class="meta-tag framing">{item.framing}</span>
            </div>
          {/if}

          {#if item.rejection_reason}
            <p class="rejection-reason">Reason: {item.rejection_reason}</p>
          {/if}

          <!-- Inline actions -->
          <div class="item-actions">
            {#if item.status === 'in_review'}
              <button class="btn btn-approve" onclick={(e) => { e.stopPropagation(); approveItem(item.id) }}>Approve</button>
              <button class="btn btn-reject" onclick={(e) => { e.stopPropagation(); openReject(item.id) }}>Reject</button>
            {/if}
            {#if item.status === 'rejected'}
              <button class="btn btn-reopen" onclick={(e) => { e.stopPropagation(); reopenItem(item.id) }}>Reopen</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
  {/if}
</div>

<!-- Reject Modal -->
{#if rejectModal.open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={() => rejectModal.open = false} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Reject Item">
      <div class="modal-header">
        <h3>Reject {rejectModal.type}</h3>
        <button class="btn btn-ghost" onclick={() => rejectModal.open = false}>Close</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="reject-reason">Reason <span class="required">*</span></label>
          <textarea
            id="reject-reason"
            bind:value={rejectModal.reason}
            rows="4"
            placeholder="Why is this being rejected?"
          ></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick={() => rejectModal.open = false}>Cancel</button>
          <button class="btn btn-danger" onclick={submitReject}>Reject</button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if detailBulletId}
  <BulletDetailModal
    bulletId={detailBulletId}
    onclose={() => detailBulletId = null}
    onupdate={() => loadItems()}
  />
{/if}

<style>
  .bullets-page {
    max-width: 1000px;
  }

  .page-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .type-tabs {
    display: flex;
    background: var(--color-ghost);
    border-radius: 6px;
    padding: 3px;
  }

  .type-tab {
    padding: 0.4rem 0.8rem;
    background: none;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .type-tab.active {
    background: var(--color-surface);
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }

  .search-input {
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    font-size: 0.825rem;
    color: var(--text-primary);
    flex: 1;
    min-width: 200px;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .status-select {
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    font-size: 0.825rem;
    color: var(--text-primary);
    background: var(--color-surface);
  }

  .status-select:focus {
    outline: none;
    border-color: var(--color-border-focus);
  }

  .loading-container {
    display: flex;
    justify-content: center;
    padding: 4rem 0;
  }

  .item-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .item-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
  }

  .item-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .item-content {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
    flex: 1;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
    margin-bottom: 0.35rem;
  }

  .meta-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .source-tag {
    display: inline-block;
    padding: 0.12em 0.45em;
    background: var(--color-tag-neutral-bg);
    color: var(--color-tag-neutral-text);
    border-radius: 3px;
    font-size: 0.72rem;
    font-weight: 500;
  }

  .source-tag.primary {
    background: var(--color-info-subtle);
    color: var(--color-info-text);
  }

  .tech-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.35rem;
  }

  .tech-tag {
    display: inline-block;
    padding: 0.12em 0.45em;
    background: var(--color-tag-bg);
    color: var(--color-tag-text);
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .perspective-meta {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
    margin-bottom: 0.35rem;
  }

  .meta-tag {
    display: inline-block;
    padding: 0.12em 0.45em;
    border-radius: 3px;
    font-size: 0.72rem;
    font-weight: 500;
  }

  .meta-tag.archetype { background: var(--color-primary-subtle); color: var(--color-tag-text); }
  .meta-tag.domain { background: var(--color-success-subtle); color: var(--color-success-text); }
  .meta-tag.framing { background: var(--color-warning-subtle); color: var(--color-warning-text); }

  .rejection-reason {
    font-size: 0.78rem;
    color: var(--color-danger);
    font-style: italic;
    margin-bottom: 0.35rem;
  }

  .item-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-ghost);
  }

  .btn {
    padding: 0.35rem 0.75rem;
    border: none;
    border-radius: 5px;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-approve { background: var(--color-success-subtle); color: var(--color-success-text); }
  .btn-approve:hover { background: var(--color-success-subtle); }
  .btn-reject { background: var(--color-danger-subtle); color: var(--color-danger-text); }
  .btn-reject:hover { background: var(--color-danger-subtle); }
  .btn-reopen { background: var(--color-warning-bg); color: var(--color-warning-text); }
  .btn-reopen:hover { background: var(--color-warning-border); }
  .btn-primary { background: var(--color-primary); color: var(--text-inverse); }
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-ghost { background: transparent; color: var(--text-muted); }
  .btn-ghost:hover { color: var(--text-secondary); background: var(--color-ghost); }
  .btn-danger { background: var(--color-danger); color: var(--text-inverse); }
  .btn-danger:hover { background: var(--color-danger-hover); }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal {
    background: var(--color-surface);
    border-radius: 8px;
    width: 90%;
    max-width: 480px;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-body {
    padding: 1.25rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 0.35rem;
  }

  .required { color: var(--color-danger); }

  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--text-primary);
    background: var(--color-surface);
    font-family: inherit;
  }

  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
    line-height: 1.5;
  }
</style>
