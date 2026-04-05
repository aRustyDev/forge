<!--
  ResumeSummaryCard.svelte — Top-of-resume Summary card with picker,
  inline edit, and promote-to-template support. Rendered by
  DragNDropView above the sections list.

  States (driven by `summary` prop + local `editing` flag):
    1. Empty         — summary === null
    2. Template-only — summary.summary_id set, is_override false
    3. Overridden    — summary.summary_id set, is_override true
    4. Freeform-only — summary.summary_id null, is_override true
    5. Edit mode     — `editing` flag set (substate of 2/3/4)

  All actions route through onUpdateSummary (PATCH /api/resumes/:id)
  except Promote, which two-steps via POST /api/summaries + PATCH.

  See the design spec at refs/specs/2026-04-05-resume-summary-card.md
  for the full state/action table.
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import SummaryPickerModal from './SummaryPickerModal.svelte'
  import type { ResumeSummary } from '@forge/sdk'

  let {
    summary,
    onUpdateSummary,
  }: {
    summary: ResumeSummary | null
    onUpdateSummary: (update: {
      summary_id?: string | null
      summary_override?: string | null
    }) => Promise<void>
  } = $props()

  let pickerOpen = $state(false)
  let editing = $state(false)
  let editText = $state('')
  let saving = $state(false)
  let promoting = $state(false)
  let promoteTitle = $state('')
  let promoteDialogOpen = $state(false)

  function openPicker() {
    pickerOpen = true
  }

  function closePicker() {
    pickerOpen = false
  }

  async function handlePickSelect(summaryId: string) {
    pickerOpen = false
    await onUpdateSummary({ summary_id: summaryId, summary_override: null })
  }

  async function handlePickFreeform(text: string) {
    pickerOpen = false
    await onUpdateSummary({ summary_id: null, summary_override: text })
  }

  async function handleUnlink() {
    await onUpdateSummary({ summary_id: null, summary_override: null })
  }

  async function handleResetToTemplate() {
    await onUpdateSummary({ summary_override: null })
  }

  function startEdit() {
    editText = summary?.content ?? ''
    editing = true
  }

  function cancelEdit() {
    editing = false
    editText = ''
  }

  async function saveEdit() {
    saving = true
    try {
      await onUpdateSummary({ summary_override: editText })
      editing = false
    } finally {
      saving = false
    }
  }

  function openPromoteDialog() {
    promoteTitle = ''
    promoteDialogOpen = true
  }

  function closePromoteDialog() {
    promoteDialogOpen = false
    promoteTitle = ''
  }

  async function handlePromoteSave() {
    const title = promoteTitle.trim()
    if (!title || !summary?.content) return
    promoting = true
    try {
      // Step 1: create a new summary row from the current override content
      const createResult = await forge.summaries.create({
        title,
        description: summary.content,
        is_template: false,
      })
      if (!createResult.ok) {
        addToast({ message: friendlyError(createResult.error), type: 'error' })
        return
      }
      // Step 2: link the resume to the new summary and clear the override
      await onUpdateSummary({
        summary_id: createResult.data.id,
        summary_override: null,
      })
      promoteDialogOpen = false
      addToast({ message: `Promoted to "${title}"`, type: 'success' })
    } finally {
      promoting = false
    }
  }
</script>

<section class="resume-summary-card">
  <div class="summary-header">
    <h3 class="summary-heading">Summary</h3>
    {#if summary && !editing}
      <div class="summary-header-actions">
        <button type="button" class="btn btn-xs btn-ghost" onclick={openPicker}>Change</button>
        <button type="button" class="btn btn-xs btn-ghost" onclick={handleUnlink}>Unlink</button>
      </div>
    {/if}
  </div>

  {#if !summary}
    <!-- State 1: Empty -->
    <div class="summary-empty">
      <p class="summary-empty-text">No summary selected.</p>
      <button type="button" class="btn btn-primary btn-sm" onclick={openPicker}>
        + Select Summary
      </button>
    </div>
  {:else if editing}
    <!-- State 5: Edit mode -->
    {#if summary.title}
      <div class="summary-template-label">{summary.title}</div>
    {/if}
    <textarea
      class="summary-edit-textarea"
      bind:value={editText}
      rows="6"
      placeholder="Write your summary…"
    ></textarea>
    <div class="summary-edit-actions">
      <button type="button" class="btn btn-ghost btn-sm" onclick={cancelEdit} disabled={saving}>
        Cancel
      </button>
      <button type="button" class="btn btn-primary btn-sm" onclick={saveEdit} disabled={saving || !editText.trim()}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  {:else}
    <!-- States 2/3/4: populated, read-only -->
    {#if summary.title}
      <div class="summary-template-label">
        {summary.title}
        {#if summary.is_override}
          <span class="summary-edited-badge">EDITED</span>
        {/if}
      </div>
    {/if}
    <p class="summary-content">{summary.content}</p>
    <div class="summary-content-actions">
      {#if summary.is_override && summary.summary_id}
        <!-- State 3: template overridden → offer reset -->
        <button type="button" class="btn btn-xs btn-ghost" onclick={handleResetToTemplate}>
          Reset to template
        </button>
      {/if}
      {#if summary.is_override && !summary.summary_id}
        <!-- State 4: freeform-only → offer promote -->
        <button type="button" class="btn btn-xs btn-ghost" onclick={openPromoteDialog}>
          Promote to Template…
        </button>
      {/if}
      <button type="button" class="btn btn-xs btn-ghost" onclick={startEdit}>Edit</button>
    </div>
  {/if}
</section>

<SummaryPickerModal
  open={pickerOpen}
  onselect={handlePickSelect}
  onfreeform={handlePickFreeform}
  onclose={closePicker}
/>

{#if promoteDialogOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="promote-overlay" onclick={closePromoteDialog}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="promote-dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <h4>Promote to Template</h4>
      <p class="promote-help">
        Save this summary as a reusable row. Give it a title so you can find it later.
      </p>
      <input
        type="text"
        class="promote-title-input"
        bind:value={promoteTitle}
        placeholder="Summary title"
      />
      <div class="promote-actions">
        <button type="button" class="btn btn-ghost btn-sm" onclick={closePromoteDialog} disabled={promoting}>
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onclick={handlePromoteSave}
          disabled={promoting || !promoteTitle.trim()}
        >
          {promoting ? 'Promoting…' : 'Save as Template'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .resume-summary-card {
    margin-bottom: var(--space-4);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .summary-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-2);
  }

  .summary-heading {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-header-actions {
    display: flex;
    gap: var(--space-1);
  }

  .summary-empty {
    padding: var(--space-3) 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .summary-empty-text {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .summary-template-label {
    font-size: var(--text-xs);
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: var(--space-2);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .summary-edited-badge {
    display: inline-block;
    padding: 0.1em 0.4em;
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
    border-radius: var(--radius-sm);
    font-size: 0.65rem;
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    font-style: normal;
    letter-spacing: 0.05em;
  }

  .summary-content {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-sm);
    color: var(--text-primary);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .summary-content-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-1);
  }

  .summary-edit-textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-md);
    font: inherit;
    font-size: var(--text-sm);
    line-height: 1.6;
    resize: vertical;
    min-height: 140px;
    color: var(--text-primary);
  }

  .summary-edit-textarea:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .summary-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .promote-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
  }

  .promote-dialog {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    max-width: 460px;
    width: 90%;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .promote-dialog h4 {
    margin: 0;
    font-size: var(--text-lg);
    color: var(--text-primary);
  }

  .promote-help {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  .promote-title-input {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font: inherit;
    font-size: var(--text-sm);
  }

  .promote-title-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .promote-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
