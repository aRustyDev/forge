<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { StatusBadge, LoadingSpinner, EmptyState } from '$lib/components'
  import BulletDetailModal from '$lib/components/BulletDetailModal.svelte'
  import type { Bullet, Perspective } from '@forge/sdk'

  type ContentType = 'bullet' | 'perspective'

  let contentType = $state<ContentType>('bullet')
  let items = $state<any[]>([])
  let loading = $state(true)
  let searchQuery = $state('')
  let statusFilter = $state('all')

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
  <h1 class="page-title">Content Atoms</h1>
  <p class="subtitle">Unified view of bullets and perspectives</p>

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
      <option value="pending_review">Pending</option>
      <option value="approved">Approved</option>
      <option value="rejected">Rejected</option>
      <option value="draft">Draft</option>
    </select>
  </div>

  <!-- Item list -->
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
        <div class="item-card" style="cursor: pointer;" onclick={() => detailBulletId = item.id}>
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
            {#if item.status === 'pending_review'}
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
    padding: 1.5rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    font-size: 0.85rem;
    color: #6b7280;
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
    background: #f3f4f6;
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
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s;
  }

  .type-tab.active {
    background: #fff;
    color: #6c63ff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .search-input {
    padding: 0.45rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.825rem;
    color: #1a1a1a;
    flex: 1;
    min-width: 200px;
  }

  .search-input:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .status-select {
    padding: 0.45rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.825rem;
    color: #1a1a1a;
    background: #fff;
  }

  .status-select:focus {
    outline: none;
    border-color: #6c63ff;
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
    background: #fff;
    border: 1px solid #e5e7eb;
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
    color: #374151;
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
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .source-tag {
    display: inline-block;
    padding: 0.12em 0.45em;
    background: #f3f4f6;
    color: #374151;
    border-radius: 3px;
    font-size: 0.72rem;
    font-weight: 500;
  }

  .source-tag.primary {
    background: #dbeafe;
    color: #1e40af;
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
    background: #ede9fe;
    color: #5b21b6;
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

  .meta-tag.archetype { background: #eef2ff; color: #4f46e5; }
  .meta-tag.domain { background: #d1fae5; color: #065f46; }
  .meta-tag.framing { background: #fefce8; color: #a16207; }

  .rejection-reason {
    font-size: 0.78rem;
    color: #ef4444;
    font-style: italic;
    margin-bottom: 0.35rem;
  }

  .item-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #f3f4f6;
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
  .btn-approve { background: #d1fae5; color: #065f46; }
  .btn-approve:hover { background: #bbf7d0; }
  .btn-reject { background: #fee2e2; color: #dc2626; }
  .btn-reject:hover { background: #fecaca; }
  .btn-reopen { background: #fef3c7; color: #92400e; }
  .btn-reopen:hover { background: #fde68a; }
  .btn-primary { background: #6c63ff; color: #fff; }
  .btn-primary:hover:not(:disabled) { background: #5a52e0; }
  .btn-ghost { background: transparent; color: #6b7280; }
  .btn-ghost:hover { color: #374151; background: #f3f4f6; }
  .btn-danger { background: #ef4444; color: #fff; }
  .btn-danger:hover { background: #dc2626; }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal {
    background: #fff;
    border-radius: 8px;
    width: 90%;
    max-width: 480px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a2e;
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
    color: #374151;
    margin-bottom: 0.35rem;
  }

  .required { color: #ef4444; }

  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1a1a1a;
    background: #fff;
    font-family: inherit;
  }

  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
    line-height: 1.5;
  }
</style>
