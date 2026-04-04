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
      tagFilter = 'company'  // Default to company for employer pipeline context
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
            <p>No available organizations found.{searchQuery ? ' Try a different search.' : tagFilter ? ' Try selecting All tags.' : ''}</p>
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
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
  }

  .modal-content {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    width: 90%;
    max-width: 520px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.3rem;
    color: var(--text-faint);
    cursor: pointer;
    padding: 0.2rem;
    line-height: 1;
  }

  .close-btn:hover { color: var(--text-secondary); }

  .modal-filters {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--color-border);
  }

  .search-input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.82rem;
    color: var(--text-secondary);
    background: var(--color-surface);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-border-focus);
  }

  .tag-select {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.78rem;
    color: var(--text-secondary);
    background: var(--color-surface);
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
    color: var(--text-faint);
    font-size: 0.85rem;
  }

  .picker-card {
    display: block;
    width: 100%;
    padding: 0.6rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-surface-sunken);
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
    font-family: inherit;
  }

  .picker-card:hover { background: var(--color-success-subtle); }
  .picker-card:disabled { opacity: 0.6; cursor: wait; }

  .picker-card-top {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.15rem;
  }

  .picker-name {
    font-size: 0.82rem;
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .picker-worked {
    padding: 0.08em 0.35em;
    background: var(--color-success-subtle);
    color: var(--color-success-text);
    border-radius: var(--radius-sm);
    font-size: 0.58rem;
    font-weight: var(--font-semibold);
  }

  .picker-meta {
    display: flex;
    gap: 0.4rem;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .picker-tags {
    display: flex;
    gap: 0.2rem;
    margin-top: 0.15rem;
  }

  .picker-tag {
    padding: 0.05em 0.25em;
    background: var(--color-tag-bg);
    color: var(--color-tag-text);
    border-radius: var(--radius-sm);
    font-size: 0.55rem;
    font-weight: var(--font-medium);
  }

  .adding-text {
    font-size: var(--text-xs);
    color: var(--color-primary);
    font-style: italic;
  }

  .create-section {
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--color-border);
  }

  .create-toggle {
    width: 100%;
    padding: var(--space-2);
    background: none;
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: 0.82rem;
    cursor: pointer;
    font-family: inherit;
  }

  .create-toggle:hover {
    background: var(--color-surface-raised);
    color: var(--text-secondary);
    border-color: var(--text-faint);
  }

  .create-form h4 {
    font-size: 0.85rem;
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .create-row {
    display: flex;
    gap: var(--space-2);
    margin-bottom: 0.4rem;
  }

  .create-input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.82rem;
    color: var(--text-secondary);
    background: var(--color-surface);
  }

  .create-input:focus {
    outline: none;
    border-color: var(--color-border-focus);
  }

  .create-website {
    width: 100%;
    margin-bottom: var(--space-2);
  }

  .create-select {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.78rem;
    color: var(--text-secondary);
    background: var(--color-surface);
  }

  .create-btn {
    width: 100%;
  }

  .collision-warning {
    background: var(--color-warning-bg);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
    padding: 0.6rem;
    font-size: var(--text-sm);
    color: var(--color-warning-text);
  }

  .collision-warning p {
    margin: 0 0 var(--space-2) 0;
  }

  .collision-actions {
    display: flex;
    gap: var(--space-2);
  }

  .btn {
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-family: inherit;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: var(--text-xs); }
  .btn-primary { background: var(--color-primary); color: var(--text-inverse); }
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-ghost { background: transparent; color: var(--text-muted); }
  .btn-ghost:hover { color: var(--text-secondary); background: var(--color-ghost); }
</style>
