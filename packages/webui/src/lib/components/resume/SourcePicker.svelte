<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import type { Source } from '@forge/sdk'

  let {
    resumeId,
    sectionId,
    sourceType,
    onClose,
    onUpdate,
  }: {
    resumeId: string
    sectionId: string
    sourceType: string
    onClose: () => void
    onUpdate: () => Promise<void>
  } = $props()

  let sources = $state<Source[]>([])
  let loading = $state(true)
  let adding = $state<string | null>(null)

  $effect(() => {
    loadSources()
  })

  async function loadSources() {
    loading = true
    try {
      const result = await forge.sources.list({ source_type: sourceType, status: 'approved' })
      if (result.ok) {
        sources = result.data
      }
    } catch (e) {
      addToast({ message: 'Failed to load sources', type: 'error' })
    } finally {
      loading = false
    }
  }

  async function addSource(source: Source) {
    adding = source.id
    try {
      // Check if source has approved perspectives
      const perspResult = await forge.perspectives.list({
        source_id: source.id,
        status: 'approved',
        limit: 50,
      })

      if (perspResult.ok && perspResult.data.length > 0) {
        // Has perspectives -- add the first one as an entry
        const result = await forge.resumes.addEntry(resumeId, {
          section_id: sectionId,
          perspective_id: perspResult.data[0].id,
        })
        if (result.ok) {
          addToast({ message: `Added ${source.title}`, type: 'success' })
          await onUpdate()
        } else {
          addToast({ message: friendlyError(result.error), type: 'error' })
        }
      } else {
        // No perspectives -- add as direct content entry
        const result = await forge.resumes.addEntry(resumeId, {
          section_id: sectionId,
          content: source.description,
        })
        if (result.ok) {
          addToast({ message: `Added ${source.title} (direct)`, type: 'success' })
          await onUpdate()
        } else {
          addToast({ message: friendlyError(result.error), type: 'error' })
        }
      }
    } catch (e) {
      addToast({ message: 'Failed to add source', type: 'error' })
    } finally {
      adding = null
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onClose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="source-picker-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Select Source">
    <div class="picker-header">
      <h3>Select {sourceType === 'education' ? 'Education' : sourceType === 'project' ? 'Project' : 'Clearance'}</h3>
      <button class="btn btn-sm btn-ghost" onclick={onClose}>Close</button>
    </div>

    {#if loading}
      <p class="loading-text">Loading sources...</p>
    {:else if sources.length === 0}
      <p class="empty-text">No {sourceType} sources found.</p>
    {:else}
      <div class="source-list">
        {#each sources as source (source.id)}
          <button
            class="source-item"
            onclick={() => addSource(source)}
            disabled={adding === source.id}
          >
            <span class="source-title">{source.title}</span>
            <span class="source-desc">{source.description.slice(0, 100)}{source.description.length > 100 ? '...' : ''}</span>
            {#if adding === source.id}
              <span class="adding-indicator">Adding...</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

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

  .source-picker-modal {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    max-width: 550px;
    width: 90%;
    max-height: 70vh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }

  .picker-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    color: var(--text-primary);
  }

  .source-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .source-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
  }

  .source-item:hover:not(:disabled) {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
  }

  .source-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .source-title {
    font-weight: var(--font-semibold);
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .source-desc {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-top: 0.15rem;
  }

  .adding-indicator {
    font-size: var(--text-xs);
    color: var(--color-primary);
    font-style: italic;
    margin-top: 0.15rem;
  }

  .loading-text, .empty-text {
    text-align: center;
    color: var(--text-faint);
    font-size: 0.85rem;
    padding: 2rem;
  }

  .btn {
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: var(--text-xs); }
  .btn-ghost { background: transparent; color: var(--text-muted); }
  .btn-ghost:hover { color: var(--text-secondary); background: var(--color-ghost); }
</style>
