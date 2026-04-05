<!--
  SummaryPickerModal.svelte — Picker for selecting a summary or entering
  freeform text. Used by ResumeSummaryCard when the user clicks
  "Select Summary" or "Change".

  Sort order: is_template DESC, title ASC (templates pinned to top,
  alphabetical within each group).

  Two modes:
    - "pick" (default): flat list of all summaries with a ⭐ badge on
      is_template=1 rows. Click to select.
    - "freeform": single textarea for writing a one-off summary that
      will be stored as resumes.summary_override with summary_id=null.

  Callbacks:
    - onselect(summaryId): user picked an existing summary from the list
    - onfreeform(text): user saved freeform text
    - onclose(): user dismissed without picking

  No picker search in v1 — the list is short (~30 rows). Add search if
  the list grows past ~50-100 entries.
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import type { Summary } from '@forge/sdk'

  let {
    open,
    onselect,
    onfreeform,
    onclose,
  }: {
    open: boolean
    onselect: (summaryId: string) => void
    onfreeform: (text: string) => void
    onclose: () => void
  } = $props()

  let summaries = $state<Summary[]>([])
  let loading = $state(false)
  let mode = $state<'pick' | 'freeform'>('pick')
  let freeformText = $state('')

  // Load summaries when the modal opens, and reset mode on close.
  $effect(() => {
    if (open) {
      mode = 'pick'
      freeformText = ''
      loadSummaries()
    }
  })

  async function loadSummaries() {
    loading = true
    try {
      const result = await forge.summaries.list({ limit: 500 })
      if (result.ok) {
        // Sort: templates first, then alphabetical within each group.
        summaries = [...result.data].sort((a, b) => {
          if (a.is_template !== b.is_template) return a.is_template ? -1 : 1
          return a.title.localeCompare(b.title)
        })
      } else {
        addToast({ message: friendlyError(result.error), type: 'error' })
      }
    } catch {
      addToast({ message: 'Failed to load summaries', type: 'error' })
    } finally {
      loading = false
    }
  }

  function handlePickClick(summary: Summary) {
    onselect(summary.id)
  }

  function handleFreeformSave() {
    const text = freeformText.trim()
    if (!text) return
    onfreeform(text)
  }

  function handleFreeformCancel() {
    mode = 'pick'
    freeformText = ''
  }
</script>

<Modal {open} {onclose} size="lg" title={mode === 'pick' ? 'Select Summary' : 'Write Summary'}>
  {#snippet body()}
    {#if mode === 'pick'}
      {#if loading}
        <div class="picker-loading">Loading summaries…</div>
      {:else if summaries.length === 0}
        <div class="picker-empty">
          No summaries found. Click "Write my own" to create one from scratch.
        </div>
      {:else}
        <div class="picker-list">
          {#each summaries as summary (summary.id)}
            <button
              type="button"
              class="picker-row"
              onclick={() => handlePickClick(summary)}
            >
              <div class="picker-row-header">
                {#if summary.is_template}
                  <span class="picker-template-badge" title="Template">⭐</span>
                {/if}
                <span class="picker-title">{summary.title}</span>
              </div>
              {#if summary.description}
                <p class="picker-description">
                  {summary.description.slice(0, 180)}{summary.description.length > 180 ? '…' : ''}
                </p>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="freeform-mode">
        <p class="freeform-help">
          Write a custom summary for this resume. It stays local to this resume until you
          explicitly promote it to a reusable template.
        </p>
        <textarea
          class="freeform-textarea"
          bind:value={freeformText}
          rows="8"
          placeholder="Write your summary here…"
        ></textarea>
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if mode === 'pick'}
      <div class="picker-footer">
        <button type="button" class="btn btn-ghost" onclick={() => (mode = 'freeform')}>
          + Write my own
        </button>
        <button type="button" class="btn btn-ghost" onclick={onclose}>Close</button>
      </div>
    {:else}
      <div class="picker-footer">
        <button type="button" class="btn btn-ghost" onclick={handleFreeformCancel}>
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onclick={handleFreeformSave}
          disabled={!freeformText.trim()}
        >
          Save freeform
        </button>
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  .picker-loading,
  .picker-empty {
    padding: var(--space-6);
    text-align: center;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .picker-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 55vh;
    overflow-y: auto;
    padding: var(--space-2);
  }

  .picker-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font: inherit;
    color: inherit;
    transition: border-color 0.12s, background 0.12s;
  }

  .picker-row:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
  }

  .picker-row-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .picker-template-badge {
    font-size: var(--text-sm);
  }

  .picker-title {
    font-weight: var(--font-semibold);
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .picker-description {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
    line-height: 1.5;
  }

  .freeform-mode {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .freeform-help {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  .freeform-textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font: inherit;
    font-size: var(--text-sm);
    resize: vertical;
    min-height: 160px;
  }

  .freeform-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .picker-footer {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
  }
</style>
