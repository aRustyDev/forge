<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import type { UserNote } from '@forge/sdk'

  interface Props {
    entityType: string
    entityId: string | null | undefined
  }

  let { entityType, entityId }: Props = $props()

  let notes = $state<UserNote[]>([])
  let loading = $state(false)
  let adding = $state(false)
  let newContent = $state('')
  let saving = $state(false)

  $effect(() => {
    if (entityId) {
      loadNotes(entityType, entityId)
    } else {
      notes = []
    }
  })

  async function loadNotes(type: string, id: string) {
    loading = true
    const result = await forge.notes.getNotesForEntity(type, id)
    if (result.ok) {
      notes = result.data
    }
    loading = false
  }

  async function addNote() {
    if (!newContent.trim() || !entityId) return
    saving = true

    const createResult = await forge.notes.create({ content: newContent.trim() })
    if (!createResult.ok) {
      addToast({ message: friendlyError(createResult.error, 'Failed to create note'), type: 'error' })
      saving = false
      return
    }

    const linkResult = await forge.notes.addReference(createResult.data.id, {
      entity_type: entityType,
      entity_id: entityId,
    })
    if (!linkResult.ok) {
      addToast({ message: friendlyError(linkResult.error, 'Note created but failed to link'), type: 'error' })
    }

    notes = [...notes, createResult.data]
    newContent = ''
    adding = false
    saving = false
  }

  async function removeNote(noteId: string) {
    if (!entityId) return
    const result = await forge.notes.removeReference(noteId, entityType, entityId)
    if (result.ok) {
      notes = notes.filter(n => n.id !== noteId)
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to remove note'), type: 'error' })
    }
  }

  function truncate(text: string, max: number = 200): string {
    if (text.length <= max) return text
    return text.slice(0, max) + '...'
  }
</script>

{#if entityId}
  <div class="entity-notes">
    <div class="en-header">
      <span class="en-label">Notes ({notes.length})</span>
      {#if !adding}
        <button class="btn btn-sm btn-ghost" onclick={() => adding = true}>+ Add</button>
      {/if}
    </div>

    {#if adding}
      <div class="en-add">
        <textarea
          class="en-textarea"
          bind:value={newContent}
          placeholder="Write a note..."
          rows="3"
        ></textarea>
        <div class="en-add-actions">
          <button class="btn btn-sm btn-primary" onclick={addNote} disabled={saving || !newContent.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button class="btn btn-sm btn-ghost" onclick={() => { adding = false; newContent = '' }}>Cancel</button>
        </div>
      </div>
    {/if}

    {#if loading}
      <p class="en-loading">Loading...</p>
    {:else if notes.length > 0}
      <ul class="en-list">
        {#each notes as note (note.id)}
          <li class="en-item">
            <p class="en-content">{truncate(note.content)}</p>
            <button class="en-remove" title="Remove note" onclick={() => removeNote(note.id)}>x</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .entity-notes {
    margin-top: 0.5rem;
  }

  .en-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.35rem;
  }

  .en-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
  }

  .en-add {
    margin-bottom: 0.5rem;
  }

  .en-textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-family: inherit;
    color: var(--text-primary);
    background: var(--color-surface);
    resize: vertical;
  }

  .en-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .en-add-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.35rem;
  }

  .en-loading {
    font-size: var(--text-sm);
    color: var(--text-faint);
    font-style: italic;
  }

  .en-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .en-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: var(--color-surface-raised);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .en-content {
    flex: 1;
    font-size: var(--text-sm);
    color: var(--text-primary);
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .en-remove {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    font-size: var(--text-sm);
    padding: 0 0.25rem;
    line-height: 1;
  }

  .en-remove:hover {
    color: var(--color-danger);
  }
</style>
