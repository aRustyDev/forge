<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { ConfirmDialog, LoadingSpinner, EmptyState } from '$lib/components'
  import { addToast } from '$lib/stores/toast.svelte'
  import type { Domain } from '@forge/sdk'

  interface DomainWithUsage extends Domain {
    perspective_count: number
    archetype_count: number
  }

  // ---- State ----
  let domains = $state<DomainWithUsage[]>([])
  let loading = $state(true)

  // Create form
  let showCreateForm = $state(false)
  let createName = $state('')
  let createDescription = $state('')
  let creating = $state(false)

  // Edit state
  let editingId = $state<string | null>(null)
  let editName = $state('')
  let editDescription = $state('')
  let saving = $state(false)

  // Delete confirmation
  let deleteConfirm = $state(false)
  let deleteTarget = $state<DomainWithUsage | null>(null)

  // ---- Load ----
  async function loadDomains() {
    loading = true
    const result = await forge.domains.list({ limit: 200 })
    if (result.ok) {
      domains = result.data as DomainWithUsage[]
    } else {
      addToast(friendlyError(result.error, 'Failed to load domains'), 'error')
    }
    loading = false
  }

  loadDomains()

  // ---- Create ----
  async function handleCreate() {
    if (!createName.trim()) return
    creating = true
    const result = await forge.domains.create({
      name: createName.trim(),
      description: createDescription.trim() || undefined,
    })
    if (result.ok) {
      addToast(`Domain '${result.data.name}' created`, 'success')
      createName = ''
      createDescription = ''
      showCreateForm = false
      await loadDomains()
    } else {
      addToast(friendlyError(result.error, 'Failed to create domain'), 'error')
    }
    creating = false
  }

  // ---- Edit ----
  function startEdit(domain: DomainWithUsage) {
    editingId = domain.id
    editName = domain.name
    editDescription = domain.description ?? ''
  }

  function cancelEdit() {
    editingId = null
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return
    saving = true
    const result = await forge.domains.update(editingId, {
      name: editName.trim(),
      description: editDescription.trim() || null,
    })
    if (result.ok) {
      addToast('Domain updated', 'success')
      editingId = null
      await loadDomains()
    } else {
      addToast(friendlyError(result.error, 'Failed to update domain'), 'error')
    }
    saving = false
  }

  // ---- Delete ----
  function confirmDelete(domain: DomainWithUsage) {
    deleteTarget = domain
    deleteConfirm = true
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const result = await forge.domains.delete(deleteTarget.id)
    if (result.ok) {
      addToast(`Domain '${deleteTarget.name}' deleted`, 'success')
      deleteConfirm = false
      deleteTarget = null
      await loadDomains()
    } else {
      addToast(friendlyError(result.error, 'Cannot delete domain'), 'error')
      deleteConfirm = false
      deleteTarget = null
    }
  }

  function isReferenced(domain: DomainWithUsage): boolean {
    return domain.perspective_count > 0 || domain.archetype_count > 0
  }
</script>

<div class="domains-page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Domains</h1>
      <p class="subtitle">Experience domains used by perspectives and archetypes</p>
    </div>
    <button class="btn btn-primary" onclick={() => (showCreateForm = !showCreateForm)}>
      {showCreateForm ? 'Cancel' : '+ Add Domain'}
    </button>
  </div>

  {#if showCreateForm}
    <div class="create-form">
      <div class="form-row">
        <label>
          <span class="form-label">Name</span>
          <input
            type="text"
            bind:value={createName}
            placeholder="e.g. cloud_engineering"
            class="form-input"
          />
          <span class="form-hint">Lowercase letters, digits, and underscores only</span>
        </label>
        <label>
          <span class="form-label">Description</span>
          <input
            type="text"
            bind:value={createDescription}
            placeholder="Optional description"
            class="form-input"
          />
        </label>
        <button
          class="btn btn-primary"
          onclick={handleCreate}
          disabled={creating || !createName.trim()}
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <LoadingSpinner />
  {:else if domains.length === 0}
    <EmptyState message="No domains found. Create one to get started." />
  {:else}
    <table class="domains-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Description</th>
          <th>Perspectives</th>
          <th>Archetypes</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each domains as domain}
          {#if editingId === domain.id}
            <tr class="editing-row">
              <td>
                <input type="text" bind:value={editName} class="form-input compact" />
              </td>
              <td>
                <input type="text" bind:value={editDescription} class="form-input compact" />
              </td>
              <td>{domain.perspective_count}</td>
              <td>{domain.archetype_count}</td>
              <td class="actions">
                <button class="btn btn-sm btn-primary" onclick={saveEdit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button class="btn btn-sm btn-ghost" onclick={cancelEdit}>Cancel</button>
              </td>
            </tr>
          {:else}
            <tr>
              <td class="domain-name">{domain.name}</td>
              <td class="domain-desc">{domain.description ?? '--'}</td>
              <td class="count">{domain.perspective_count}</td>
              <td class="count">{domain.archetype_count}</td>
              <td class="actions">
                <button class="btn btn-sm btn-ghost" onclick={() => startEdit(domain)}>
                  Edit
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  onclick={() => confirmDelete(domain)}
                  disabled={isReferenced(domain)}
                  title={isReferenced(domain) ? 'Cannot delete: referenced by perspectives or archetypes' : 'Delete domain'}
                >
                  Delete
                </button>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  {/if}
</div>

{#if deleteConfirm && deleteTarget}
  <ConfirmDialog
    title="Delete Domain"
    message={`Are you sure you want to delete '${deleteTarget.name}'? This cannot be undone.`}
    onconfirm={handleDelete}
    oncancel={() => { deleteConfirm = false; deleteTarget = null }}
  />
{/if}

<style>
  .domains-page {
    max-width: 1000px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
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
  }

  .create-form {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
  }

  .form-row label {
    flex: 1;
  }

  .form-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .form-hint {
    display: block;
    font-size: 0.7rem;
    color: #9ca3af;
    margin-top: 0.15rem;
  }

  .form-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .form-input.compact {
    padding: 0.35rem 0.5rem;
    font-size: 0.8rem;
  }

  .domains-table {
    width: 100%;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    border-collapse: collapse;
    overflow: hidden;
  }

  .domains-table th {
    background: #f9fafb;
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid #e5e7eb;
  }

  .domains-table td {
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .domains-table tbody tr:last-child td {
    border-bottom: none;
  }

  .domain-name {
    font-weight: 600;
    color: #1a1a2e;
    font-family: monospace;
  }

  .domain-desc {
    color: #6b7280;
  }

  .count {
    text-align: center;
    color: #374151;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .editing-row {
    background: #f0f9ff;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-sm {
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
  }

  .btn-primary {
    background: #6c63ff;
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    background: #5b54e0;
  }

  .btn-ghost {
    background: transparent;
    color: #6b7280;
    border: 1px solid #d1d5db;
  }

  .btn-ghost:hover {
    background: #f3f4f6;
  }

  .btn-danger {
    background: #fee2e2;
    color: #dc2626;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fecaca;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
