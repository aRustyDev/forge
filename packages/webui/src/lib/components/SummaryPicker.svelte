<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner } from '$lib/components'
  import type { Summary } from '@forge/sdk'

  interface Props {
    open: boolean
    /** Called when the user picks a summary. `id` is the summary to link, or null to skip. */
    onpick: (summaryId: string | null) => void
    oncancel: () => void
  }

  let { open, onpick, oncancel }: Props = $props()

  let summaries = $state<Summary[]>([])
  let loading = $state(true)
  let showCreateForm = $state(false)
  let creating = $state(false)
  let warningForId = $state<string | null>(null)
  let warningResumeName = $state<string | null>(null)

  // Create form fields
  let newTitle = $state('')
  let newRole = $state('')
  let newTagline = $state('')
  let newDescription = $state('')

  let templates = $derived(summaries.filter(s => s.is_template))
  let instances = $derived(summaries.filter(s => !s.is_template))

  $effect(() => {
    if (open) {
      loadSummaries()
      // Reset form state on re-open
      showCreateForm = false
      warningForId = null
      warningResumeName = null
      newTitle = ''
      newRole = ''
      newTagline = ''
      newDescription = ''
    }
  })

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

  /** [Use] a template: clone it, then link the clone */
  async function useTemplate(id: string) {
    const result = await forge.summaries.clone(id)
    if (result.ok) {
      onpick(result.data.id)
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to clone template'), type: 'error' })
    }
  }

  /** [Link] an existing summary directly */
  async function linkSummary(id: string) {
    // Check if this summary is already linked to another resume
    const summary = summaries.find(s => s.id === id)
    if (summary && summary.linked_resume_count > 0) {
      // Fetch linked resumes to show the warning
      const linkedResult = await forge.summaries.linkedResumes(id, { limit: 1 })
      if (linkedResult.ok && linkedResult.data.length > 0) {
        warningForId = id
        warningResumeName = linkedResult.data[0].name
        return
      }
    }
    onpick(id)
  }

  /** User confirmed [Link Anyway] after seeing the shared-summary warning */
  function confirmLink() {
    if (warningForId) {
      onpick(warningForId)
      warningForId = null
    }
  }

  /** User chose [Clone] from the shared-summary warning dialog */
  async function cloneInstead() {
    if (warningForId) {
      const result = await forge.summaries.clone(warningForId)
      if (result.ok) {
        onpick(result.data.id)
      } else {
        addToast({ message: friendlyError(result.error, 'Failed to clone'), type: 'error' })
      }
      warningForId = null
    }
  }

  /** [Create New] inline form submission */
  async function createAndLink() {
    if (!newTitle.trim()) {
      addToast({ message: 'Title is required', type: 'error' })
      return
    }
    creating = true
    const result = await forge.summaries.create({
      title: newTitle.trim(),
      role: newRole.trim() || undefined,
      tagline: newTagline.trim() || undefined,
      description: newDescription.trim() || undefined,
    })
    if (result.ok) {
      onpick(result.data.id)
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to create summary'), type: 'error' })
    }
    creating = false
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" onclick={oncancel}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="picker-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="picker-header">
        <h2 class="picker-title">Pick a Summary</h2>
        <button onclick={() => { showCreateForm = true; warningForId = null }}
                class="btn btn-primary btn-sm">
          Create New
        </button>
      </div>

      <div class="picker-body">
        {#if loading}
          <LoadingSpinner />
        {:else if showCreateForm}
          <!-- Inline creation form -->
          <div class="create-form">
            <div class="form-field">
              <label class="field-label">Title *</label>
              <input bind:value={newTitle} class="field-input"
                     placeholder="e.g. Security Engineer - Cloud Focus" />
            </div>
            <div class="form-field">
              <label class="field-label">Role</label>
              <input bind:value={newRole} class="field-input"
                     placeholder="e.g. Senior Security Engineer" />
            </div>
            <div class="form-field">
              <label class="field-label">Tagline</label>
              <input bind:value={newTagline} class="field-input"
                     placeholder="e.g. Cloud + DevSecOps + Detection Engineering" />
            </div>
            <div class="form-field">
              <label class="field-label">Description</label>
              <textarea bind:value={newDescription} rows="3"
                        class="field-input"
                        placeholder="Full summary paragraph..." />
            </div>
            <div class="form-actions">
              <button onclick={createAndLink} disabled={creating} class="btn btn-primary btn-sm">
                {creating ? 'Creating...' : 'Create & Link'}
              </button>
              <button onclick={() => showCreateForm = false} class="btn btn-ghost btn-sm">Back</button>
            </div>
          </div>
        {:else if warningForId}
          <!-- Shared summary warning -->
          <div class="warning-box">
            <p class="warning-text">
              This summary is also used by <strong>{warningResumeName}</strong>.
              Changes will affect both resumes. Clone instead?
            </p>
            <div class="form-actions">
              <button onclick={cloneInstead} class="btn btn-primary btn-sm">Clone</button>
              <button onclick={confirmLink} class="btn btn-ghost btn-sm">Link Anyway</button>
              <button onclick={() => warningForId = null} class="btn btn-ghost btn-sm">Cancel</button>
            </div>
          </div>
        {:else}
          <!-- Templates -->
          {#if templates.length > 0}
            <div class="picker-section">
              <h3 class="picker-section-title">Templates</h3>
              <div class="picker-list">
                {#each templates as summary (summary.id)}
                  <div class="picker-item template">
                    <div class="picker-item-info">
                      <span class="star">&#9733;</span>
                      <span class="picker-item-title">{summary.title}</span>
                    </div>
                    <button onclick={() => useTemplate(summary.id)}
                            class="btn btn-primary btn-xs">Use</button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Existing Summaries -->
          {#if instances.length > 0}
            <div class="picker-section">
              <h3 class="picker-section-title">Existing Summaries</h3>
              <div class="picker-list">
                {#each instances as summary (summary.id)}
                  <div class="picker-item">
                    <span class="picker-item-title">{summary.title}</span>
                    <button onclick={() => linkSummary(summary.id)}
                            class="btn btn-ghost btn-xs">Link</button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if templates.length === 0 && instances.length === 0}
            <p class="empty-note">No summaries yet. Create one or skip for now.</p>
          {/if}
        {/if}
      </div>

      <!-- Footer -->
      <div class="picker-footer">
        <button onclick={oncancel} class="btn btn-ghost btn-sm">Cancel</button>
        <button onclick={() => onpick(null)} class="btn btn-ghost btn-sm">Skip</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .picker-dialog {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    max-width: 480px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }
  .picker-title { font-size: 1.1rem; font-weight: 600; color: #1a1a2e; }

  .picker-body {
    overflow-y: auto;
    flex: 1;
    padding: 1rem 1.25rem;
  }

  .picker-section { margin-bottom: 1rem; }
  .picker-section-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .picker-list { display: flex; flex-direction: column; gap: 0.25rem; }

  .picker-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }
  .picker-item.template {
    border-color: #fcd34d;
    background: #fffbeb;
  }
  .picker-item-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  .picker-item-title {
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .star { color: #f59e0b; flex-shrink: 0; }

  .picker-footer {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 0 0 8px 8px;
  }

  .create-form { display: flex; flex-direction: column; gap: 0.75rem; }
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
  .form-actions { display: flex; gap: 0.5rem; }

  .warning-box {
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-radius: 6px;
    padding: 1rem;
  }
  .warning-text {
    font-size: 0.85rem;
    color: #92400e;
    margin-bottom: 0.75rem;
    line-height: 1.5;
  }
  .empty-note {
    font-size: 0.85rem;
    color: #6b7280;
    text-align: center;
    padding: 1.5rem 0;
  }

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
  }
  .btn-primary:hover { background: #5a52e0; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-ghost {
    background: #f3f4f6;
    color: #374151;
  }
  .btn-ghost:hover { background: #e5e7eb; }
  .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.8rem; }
  .btn-xs { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
</style>
