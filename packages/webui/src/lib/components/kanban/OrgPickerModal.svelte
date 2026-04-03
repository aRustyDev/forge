<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner } from '$lib/components'
  import type { Organization, OrgTag } from '@forge/sdk'

  let { open, onclose, onadd }: {
    open: boolean
    onclose: () => void
    onadd: () => void
  } = $props()

  let allOrgs = $state<Organization[]>([])
  let loading = $state(false)
  let searchQuery = $state('')
  let tagFilter = $state('')
  let adding = $state<string | null>(null)

  // Create New form
  let showCreateForm = $state(false)
  let newName = $state('')
  let newOrgType = $state('company')
  let newWebsite = $state('')
  let creating = $state(false)
  let collisionOrg = $state<Organization | null>(null)

  const ORG_TYPES = ['company', 'nonprofit', 'government', 'military', 'education', 'volunteer', 'freelance', 'other']
  const TAG_OPTIONS: OrgTag[] = ['company', 'vendor', 'platform', 'university', 'school', 'nonprofit', 'government', 'military', 'conference', 'volunteer', 'freelance', 'other']

  // Fetch all orgs when modal opens
  $effect(() => {
    if (open) {
      loadAllOrgs()
      searchQuery = ''
      tagFilter = ''
      showCreateForm = false
      collisionOrg = null
    }
  })

  async function loadAllOrgs() {
    loading = true
    const result = await forge.organizations.list({ limit: 500 })
    if (result.ok) {
      allOrgs = result.data
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to load organizations'), type: 'error' })
    }
    loading = false
  }

  // Filter to only orgs NOT already in pipeline (status IS NULL)
  let availableOrgs = $derived.by(() => {
    let result = allOrgs.filter(o => !o.status)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o => o.name.toLowerCase().includes(q))
    }
    if (tagFilter) {
      result = result.filter(o => o.tags?.includes(tagFilter as OrgTag))
    }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  })

  async function addToPipeline(orgId: string) {
    adding = orgId
    const result = await forge.organizations.update(orgId, { status: 'backlog' })
    if (result.ok) {
      addToast({ message: `${result.data.name} added to Backlog`, type: 'success' })
      onadd()
      onclose()
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to add organization'), type: 'error' })
    }
    adding = null
  }

  function checkNameCollision() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const match = allOrgs.find(o => o.name.toLowerCase() === trimmed.toLowerCase())
    if (match) {
      collisionOrg = match
    } else {
      collisionOrg = null
      createAndAdd()
    }
  }

  async function createAndAdd() {
    if (!newName.trim()) {
      addToast({ message: 'Name is required.', type: 'error' })
      return
    }
    creating = true
    const result = await forge.organizations.create({
      name: newName.trim(),
      org_type: newOrgType,
      website: newWebsite || undefined,
      status: 'backlog',
    })
    if (result.ok) {
      addToast({ message: `${result.data.name} created and added to Backlog`, type: 'success' })
      onadd()
      onclose()
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to create organization'), type: 'error' })
    }
    creating = false
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={onclose} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add Organization to Pipeline">
      <div class="modal-header">
        <h3>Add Organization to Pipeline</h3>
        <button class="close-btn" onclick={onclose}>&times;</button>
      </div>

      <div class="modal-filters">
        <input
          type="text"
          class="search-input"
          placeholder="Search by name..."
          bind:value={searchQuery}
        />
        <select class="tag-select" bind:value={tagFilter}>
          <option value="">All tags</option>
          {#each TAG_OPTIONS as tag}
            <option value={tag}>{tag}</option>
          {/each}
        </select>
      </div>

      <div class="org-list-scroll">
        {#if loading}
          <div class="list-loading">
            <LoadingSpinner size="md" message="Loading organizations..." />
          </div>
        {:else if availableOrgs.length === 0}
          <div class="list-empty">
            <p>No available organizations found.{searchQuery ? ' Try a different search.' : ''}</p>
          </div>
        {:else}
          {#each availableOrgs as org (org.id)}
            <button
              class="picker-card"
              onclick={() => addToPipeline(org.id)}
              disabled={adding === org.id}
            >
              <div class="picker-card-top">
                <span class="picker-name">{org.name}</span>
                {#if org.worked}
                  <span class="picker-worked">Worked</span>
                {/if}
              </div>
              <div class="picker-meta">
                {#if org.industry}<span>{org.industry}</span>{/if}
                {#if org.location}<span>{org.location}</span>{/if}
              </div>
              {#if org.tags && org.tags.length > 0}
                <div class="picker-tags">
                  {#each org.tags as tag}
                    <span class="picker-tag">{tag}</span>
                  {/each}
                </div>
              {/if}
              {#if adding === org.id}
                <span class="adding-text">Adding...</span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>

      <div class="create-section">
        {#if !showCreateForm}
          <button class="create-toggle" onclick={() => { showCreateForm = true; collisionOrg = null }}>
            + Create New Organization
          </button>
        {:else}
          <div class="create-form">
            <h4>Create New Organization</h4>
            <div class="create-row">
              <input
                type="text"
                class="create-input"
                placeholder="Organization name"
                bind:value={newName}
              />
              <select class="create-select" bind:value={newOrgType}>
                {#each ORG_TYPES as t}
                  <option value={t}>{t}</option>
                {/each}
              </select>
            </div>
            <input
              type="url"
              class="create-input create-website"
              placeholder="Website (optional)"
              bind:value={newWebsite}
            />

            {#if collisionOrg}
              <div class="collision-warning">
                <p>An organization named <strong>{collisionOrg.name}</strong> already exists. Add the existing one instead?</p>
                <div class="collision-actions">
                  <button class="btn btn-sm btn-primary" onclick={() => addToPipeline(collisionOrg!.id)}>
                    Add Existing
                  </button>
                  <button class="btn btn-sm btn-ghost" onclick={() => { collisionOrg = null; createAndAdd() }}>
                    Create Anyway
                  </button>
                </div>
              </div>
            {:else}
              <button
                class="btn btn-sm btn-primary create-btn"
                onclick={checkNameCollision}
                disabled={creating || !newName.trim()}
              >
                {creating ? 'Creating...' : 'Create & Add to Backlog'}
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: #fff;
    border-radius: 10px;
    width: 90%;
    max-width: 520px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
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
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.3rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0.2rem;
    line-height: 1;
  }

  .close-btn:hover { color: #374151; }

  .modal-filters {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .search-input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    font-size: 0.82rem;
    color: #374151;
  }

  .search-input:focus {
    outline: none;
    border-color: #6c63ff;
  }

  .tag-select {
    padding: 0.4rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    font-size: 0.78rem;
    color: #374151;
    background: #fff;
  }

  .org-list-scroll {
    flex: 1;
    overflow-y: auto;
    min-height: 120px;
    max-height: 300px;
  }

  .list-loading, .list-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    color: #9ca3af;
    font-size: 0.85rem;
  }

  .picker-card {
    display: block;
    width: 100%;
    padding: 0.6rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
    font-family: inherit;
  }

  .picker-card:hover { background: #f0fdf4; }
  .picker-card:disabled { opacity: 0.6; cursor: wait; }

  .picker-card-top {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.15rem;
  }

  .picker-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: #1a1a2e;
  }

  .picker-worked {
    padding: 0.08em 0.35em;
    background: #d1fae5;
    color: #065f46;
    border-radius: 3px;
    font-size: 0.58rem;
    font-weight: 600;
  }

  .picker-meta {
    display: flex;
    gap: 0.4rem;
    font-size: 0.7rem;
    color: #6b7280;
  }

  .picker-tags {
    display: flex;
    gap: 0.2rem;
    margin-top: 0.15rem;
  }

  .picker-tag {
    padding: 0.05em 0.25em;
    background: #e0e7ff;
    color: #3730a3;
    border-radius: 3px;
    font-size: 0.55rem;
    font-weight: 500;
  }

  .adding-text {
    font-size: 0.7rem;
    color: #6c63ff;
    font-style: italic;
  }

  .create-section {
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #e5e7eb;
  }

  .create-toggle {
    width: 100%;
    padding: 0.5rem;
    background: none;
    border: 1px dashed #d1d5db;
    border-radius: 6px;
    color: #6b7280;
    font-size: 0.82rem;
    cursor: pointer;
    font-family: inherit;
  }

  .create-toggle:hover {
    background: #f9fafb;
    color: #374151;
    border-color: #9ca3af;
  }

  .create-form h4 {
    font-size: 0.85rem;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0 0 0.5rem 0;
  }

  .create-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
  }

  .create-input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    font-size: 0.82rem;
    color: #374151;
  }

  .create-input:focus {
    outline: none;
    border-color: #6c63ff;
  }

  .create-website {
    width: 100%;
    margin-bottom: 0.5rem;
  }

  .create-select {
    padding: 0.4rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    font-size: 0.78rem;
    color: #374151;
    background: #fff;
  }

  .create-btn {
    width: 100%;
  }

  .collision-warning {
    background: #fef3c7;
    border: 1px solid #fbbf24;
    border-radius: 6px;
    padding: 0.6rem;
    font-size: 0.8rem;
    color: #92400e;
  }

  .collision-warning p {
    margin: 0 0 0.5rem 0;
  }

  .collision-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
  .btn-primary { background: #6c63ff; color: #fff; }
  .btn-primary:hover:not(:disabled) { background: #5a52e0; }
  .btn-ghost { background: transparent; color: #6b7280; }
  .btn-ghost:hover { color: #374151; background: #f3f4f6; }
</style>
