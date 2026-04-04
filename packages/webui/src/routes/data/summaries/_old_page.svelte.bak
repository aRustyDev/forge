<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, EmptyState, ConfirmDialog } from '$lib/components'
  import type { Summary } from '@forge/sdk'

  let summaries = $state<Summary[]>([])
  let loading = $state(true)
  let confirmDeleteId = $state<string | null>(null)
  let editing = $state<string | null>(null)
  let saving = $state(false)

  // Form fields for inline edit
  let formTitle = $state('')
  let formRole = $state('')
  let formTagline = $state('')
  let formDescription = $state('')
  let formNotes = $state('')

  let templates = $derived(summaries.filter(s => s.is_template))
  let instances = $derived(summaries.filter(s => !s.is_template))

  $effect(() => { loadSummaries() })

  async function loadSummaries() {
    loading = true
    const result = await forge.summaries.list({ limit: 500 })
    if (result.ok) {
      summaries = result.data
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to load summaries'), type: 'error' })
    }
    loading = false
  }

  async function toggleTemplate(id: string) {
    const result = await forge.summaries.toggleTemplate(id)
    if (result.ok) {
      summaries = summaries.map(s => s.id === id ? result.data : s)
      addToast({
        message: result.data.is_template ? 'Promoted to template' : 'Demoted from template',
        type: 'success',
      })
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to toggle template'), type: 'error' })
    }
  }

  async function cloneSummary(id: string) {
    const result = await forge.summaries.clone(id)
    if (result.ok) {
      summaries = [result.data, ...summaries]
      addToast({ message: `Cloned as "${result.data.title}"`, type: 'success' })
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to clone'), type: 'error' })
    }
  }

  async function deleteSummary(id: string) {
    const result = await forge.summaries.delete(id)
    if (result.ok) {
      summaries = summaries.filter(s => s.id !== id)
      confirmDeleteId = null
      if (editing === id) editing = null
      addToast({ message: 'Summary deleted', type: 'success' })
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to delete'), type: 'error' })
    }
  }

  function startEdit(summary: Summary) {
    editing = summary.id
    formTitle = summary.title
    formRole = summary.role ?? ''
    formTagline = summary.tagline ?? ''
    formDescription = summary.description ?? ''
    formNotes = summary.notes ?? ''
  }

  async function saveEdit(id: string) {
    saving = true
    const result = await forge.summaries.update(id, {
      title: formTitle,
      role: formRole || null,
      tagline: formTagline || null,
      description: formDescription || null,
      notes: formNotes || null,
    })
    if (result.ok) {
      summaries = summaries.map(s => s.id === id ? result.data : s)
      editing = null
      addToast({ message: 'Summary updated', type: 'success' })
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to update'), type: 'error' })
    }
    saving = false
  }

  async function createSummary() {
    const result = await forge.summaries.create({ title: 'New Summary' })
    if (result.ok) {
      summaries = [result.data, ...summaries]
      startEdit(result.data)
      addToast({ message: 'Summary created', type: 'success' })
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to create'), type: 'error' })
    }
  }
</script>

<div class="summaries-page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Summaries</h1>
      <p class="subtitle">Reusable professional summaries and templates</p>
    </div>
    <button class="btn btn-primary" onclick={createSummary}>+ New Summary</button>
  </div>

  {#if loading}
    <LoadingSpinner />
  {:else if summaries.length === 0}
    <EmptyState
      title="No summaries yet"
      description="Create one to get started. Summaries can be linked to resumes or promoted to templates for reuse."
      action="Create Summary"
      onaction={createSummary}
    />
  {:else}
    <!-- Templates Section -->
    {#if templates.length > 0}
      <section class="section">
        <h2 class="section-title"><span class="star">&#9733;</span> Templates</h2>
        <div class="summary-list">
          {#each templates as summary (summary.id)}
            {@render summaryRow(summary, true)}
          {/each}
        </div>
      </section>
    {/if}

    <!-- Regular Summaries Section -->
    <section class="section">
      <h2 class="section-title">Summaries</h2>
      {#if instances.length === 0}
        <p class="empty-note">No regular summaries. All summaries are templates.</p>
      {:else}
        <div class="summary-list">
          {#each instances as summary (summary.id)}
            {@render summaryRow(summary, false)}
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <ConfirmDialog
    open={confirmDeleteId !== null}
    title="Delete Summary"
    message="Are you sure? This will detach this summary from any linked resumes."
    onconfirm={() => confirmDeleteId && deleteSummary(confirmDeleteId)}
    oncancel={() => confirmDeleteId = null}
  />
</div>

{#snippet summaryRow(summary: Summary, isTemplate: boolean)}
  <div class="summary-card" class:template={isTemplate}>
    {#if editing === summary.id}
      <!-- Edit mode -->
      <div class="edit-form">
        <div class="form-field">
          <label class="field-label">Title</label>
          <input bind:value={formTitle} class="field-input" />
        </div>
        <div class="form-field">
          <label class="field-label">Role</label>
          <input bind:value={formRole} class="field-input" placeholder="e.g. Senior Security Engineer" />
        </div>
        <div class="form-field">
          <label class="field-label">Tagline</label>
          <input bind:value={formTagline} class="field-input" placeholder="e.g. Cloud + DevSecOps + Detection Engineering" />
        </div>
        <div class="form-field">
          <label class="field-label">Description</label>
          <textarea bind:value={formDescription} rows="3" class="field-input" placeholder="Full summary paragraph..." />
        </div>
        <div class="form-field">
          <label class="field-label">Notes (internal)</label>
          <textarea bind:value={formNotes} rows="2" class="field-input" />
        </div>

        <!-- Template/multi-resume banners -->
        {#if isTemplate}
          <div class="banner banner-info">
            This is a template. Changes here will NOT affect resumes that were previously created from this template.
          </div>
        {:else if summary.linked_resume_count > 1}
          <div class="banner banner-warn">
            This summary is linked to {summary.linked_resume_count} resumes. Changes will be reflected in all of them.
          </div>
        {/if}

        <div class="edit-actions">
          <button onclick={() => saveEdit(summary.id)} disabled={saving} class="btn btn-primary btn-sm">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onclick={() => editing = null} class="btn btn-ghost btn-sm">Cancel</button>
        </div>
      </div>
    {:else}
      <!-- Display mode -->
      <div class="summary-display">
        <div class="summary-info">
          <div class="summary-header">
            {#if isTemplate}
              <span class="star" title="Template">&#9733;</span>
            {/if}
            <h3 class="summary-title">{summary.title}</h3>
            {#if summary.linked_resume_count > 0}
              <span class="resume-count">
                ({summary.linked_resume_count} resume{summary.linked_resume_count !== 1 ? 's' : ''})
              </span>
            {/if}
          </div>
          {#if summary.role}
            <p class="summary-role">{summary.role}</p>
          {/if}
          {#if summary.tagline}
            <p class="summary-tagline">{summary.tagline}</p>
          {/if}
        </div>
        <div class="summary-actions">
          <button onclick={() => startEdit(summary)} class="btn btn-ghost btn-xs">Edit</button>
          <button onclick={() => cloneSummary(summary.id)} class="btn btn-ghost btn-xs">Clone</button>
          <button onclick={() => toggleTemplate(summary.id)} class="btn btn-ghost btn-xs">
            {isTemplate ? 'Demote' : 'Promote'}
          </button>
          <button onclick={() => confirmDeleteId = summary.id} class="btn btn-danger-ghost btn-xs">Delete</button>
        </div>
      </div>
    {/if}
  </div>
{/snippet}

<style>
  .summaries-page { max-width: 800px; }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }
  .page-title { font-size: 1.5rem; font-weight: 700; color: #1a1a2e; margin-bottom: 0.25rem; }
  .subtitle { font-size: 0.85rem; color: #6b7280; }

  .section { margin-bottom: 2rem; }
  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .star { color: #f59e0b; }
  .empty-note { color: #6b7280; font-size: 0.85rem; }

  .summary-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .summary-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    background: #fff;
  }
  .summary-card.template {
    border-color: #fcd34d;
    background: #fffbeb;
  }

  .summary-display {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .summary-info { flex: 1; min-width: 0; }
  .summary-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .summary-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #1a1a2e;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .resume-count {
    font-size: 0.75rem;
    color: #6b7280;
    white-space: nowrap;
  }
  .summary-role {
    font-size: 0.8rem;
    color: #4b5563;
    margin-top: 0.25rem;
  }
  .summary-tagline {
    font-size: 0.75rem;
    color: #6b7280;
    font-style: italic;
    margin-top: 0.125rem;
  }

  .summary-actions {
    display: flex;
    gap: 0.25rem;
    margin-left: 1rem;
    flex-shrink: 0;
  }

  .edit-form { display: flex; flex-direction: column; gap: 0.75rem; }
  .form-field { display: flex; flex-direction: column; gap: 0.25rem; }
  .field-label { font-size: 0.8rem; font-weight: 500; color: #374151; }
  .field-input {
    padding: 0.375rem 0.625rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.85rem;
  }
  .field-input:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .banner {
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    line-height: 1.4;
  }
  .banner-info {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1e40af;
  }
  .banner-warn {
    background: #fffbeb;
    border: 1px solid #fcd34d;
    color: #92400e;
  }

  .edit-actions { display: flex; gap: 0.5rem; }

  /* Button resets */
  .btn {
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-primary {
    background: #6c63ff;
    color: #fff;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
  .btn-primary:hover { background: #5a52e0; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-ghost {
    background: #f3f4f6;
    color: #374151;
    padding: 0.375rem 0.75rem;
    font-size: 0.8rem;
  }
  .btn-ghost:hover { background: #e5e7eb; }
  .btn-danger-ghost {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.375rem 0.75rem;
    font-size: 0.8rem;
  }
  .btn-danger-ghost:hover { background: #fee2e2; }
  .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.8rem; }
  .btn-xs { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
</style>
