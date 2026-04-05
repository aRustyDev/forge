<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, EmptyState, ConfirmDialog, PageWrapper, SplitPanel, ListPanelHeader, EmptyPanel, ListSearchInput } from '$lib/components'
  import type { UserNote, NoteReference } from '@forge/sdk'

  const ENTITY_TYPES = ['source', 'bullet', 'perspective', 'resume_entry', 'resume', 'skill', 'organization']

  let notes = $state<UserNote[]>([])
  let selectedId = $state<string | null>(null)
  let searchQuery = $state('')
  let loading = $state(true)
  let editing = $state(false)
  let saving = $state(false)
  let confirmDeleteOpen = $state(false)

  let formTitle = $state('')
  let formContent = $state('')

  // Reference linking
  let showRefPicker = $state(false)
  let refEntityType = $state('source')
  let refEntityId = $state('')

  let filteredNotes = $derived.by(() => {
    if (!searchQuery.trim()) return notes
    const q = searchQuery.toLowerCase()
    return notes.filter(n =>
      n.content.toLowerCase().includes(q) ||
      (n.title && n.title.toLowerCase().includes(q))
    )
  })

  let selectedNote = $derived(notes.find(n => n.id === selectedId) ?? null)

  $effect(() => { loadNotes() })

  $effect(() => {
    if (selectedNote && !editing) {
      formTitle = selectedNote.title ?? ''
      formContent = selectedNote.content
    }
  })

  async function loadNotes() {
    loading = true
    const result = await forge.notes.list({ limit: 500 })
    if (result.ok) {
      notes = result.data
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to load notes'), type: 'error' })
    }
    loading = false
  }

  async function loadNoteDetail(id: string) {
    const result = await forge.notes.get(id)
    if (result.ok) {
      notes = notes.map(n => n.id === id ? result.data : n)
    }
  }

  function startNew() {
    selectedId = null
    editing = true
    formTitle = ''
    formContent = ''
  }

  function selectNote(id: string) {
    editing = false
    selectedId = id
  }

  async function saveNote() {
    if (!formContent.trim()) {
      addToast({ message: 'Content is required.', type: 'error' })
      return
    }

    saving = true

    if (editing) {
      const result = await forge.notes.create({
        title: formTitle.trim() || undefined,
        content: formContent.trim(),
      })
      if (result.ok) {
        notes = [...notes, result.data]
        selectedId = result.data.id
        editing = false
        addToast({ message: 'Note created.', type: 'success' })
      } else {
        addToast({ message: friendlyError(result.error, 'Failed to create note'), type: 'error' })
      }
    } else if (selectedId) {
      const result = await forge.notes.update(selectedId, {
        title: formTitle.trim() || null,
        content: formContent.trim(),
      })
      if (result.ok) {
        notes = notes.map(n => n.id === selectedId ? result.data : n)
        addToast({ message: 'Note updated.', type: 'success' })
      } else {
        addToast({ message: friendlyError(result.error, 'Failed to update note'), type: 'error' })
      }
    }

    saving = false
  }

  async function deleteNote() {
    if (!selectedId) return
    confirmDeleteOpen = false

    const id = selectedId
    const result = await forge.notes.delete(id)
    if (result.ok) {
      notes = notes.filter(n => n.id !== id)
      selectedId = null
      editing = false
      addToast({ message: 'Note deleted.', type: 'success' })
    } else {
      addToast({ message: `Failed to delete note: ${result.error.message}`, type: 'error' })
    }
  }

  async function linkEntity() {
    if (!selectedId || !refEntityId.trim()) {
      addToast({ message: 'Entity ID is required.', type: 'error' })
      return
    }
    const result = await forge.notes.addReference(selectedId, {
      entity_type: refEntityType,
      entity_id: refEntityId.trim(),
    })
    if (result.ok) {
      addToast({ message: 'Entity linked', type: 'success' })
      await loadNoteDetail(selectedId)
      showRefPicker = false
      refEntityId = ''
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to link entity'), type: 'error' })
    }
  }

  async function unlinkEntity(ref: NoteReference) {
    if (!selectedId) return
    const result = await forge.notes.removeReference(selectedId, ref.entity_type, ref.entity_id)
    if (result.ok) {
      addToast({ message: 'Entity unlinked', type: 'success' })
      await loadNoteDetail(selectedId)
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to unlink entity'), type: 'error' })
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function truncate(text: string, max: number = 100): string {
    if (text.length <= max) return text
    return text.slice(0, max) + '...'
  }
</script>

<PageWrapper>
  <SplitPanel>
    {#snippet list()}
      <ListPanelHeader title="Notes" onNew={startNew} />

    <div class="filter-bar">
      <ListSearchInput bind:value={searchQuery} placeholder="Search notes..." />
    </div>

    {#if loading}
      <div class="list-loading">
        <LoadingSpinner size="md" message="Loading notes..." />
      </div>
    {:else if filteredNotes.length === 0}
      <EmptyState
        title="No notes found"
        description={searchQuery ? 'Try adjusting your search.' : 'Create your first note.'}
      >
        {#if !searchQuery}
          <button class="btn btn-primary" onclick={startNew}>New Note</button>
        {/if}
      </EmptyState>
    {:else}
      <ul class="note-list">
        {#each filteredNotes as note (note.id)}
          <li>
            <button
              class="note-card"
              class:selected={selectedId === note.id}
              onclick={() => selectNote(note.id)}
            >
              <div class="card-top">
                <span class="card-title">{note.title || 'Untitled'}</span>
                <span class="card-date">{formatDate(note.updated_at)}</span>
              </div>
              <p class="card-preview">{truncate(note.content, 100)}</p>
              {#if note.references?.length > 0}
                <div class="ref-tags">
                  {#each note.references as ref}
                    <span class="ref-tag ref-{ref.entity_type}">
                      {ref.entity_type}
                    </span>
                  {/each}
                </div>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {/snippet}
    {#snippet detail()}
    {#if !selectedNote && !editing}
      <EmptyPanel message="Select a note or create a new one." />
    {:else}
      <div class="editor-content">
        <h3 class="editor-heading">{editing ? 'New Note' : 'Edit Note'}</h3>

        <div class="form-group">
          <label for="note-title">Title</label>
          <input id="note-title" type="text" bind:value={formTitle} placeholder="Optional title" />
        </div>

        <div class="form-group">
          <label for="note-content">Content <span class="required">*</span></label>
          <textarea id="note-content" bind:value={formContent} rows="10"
                    placeholder="Write your note..."></textarea>
        </div>

        <!-- Linked entities -->
        {#if selectedNote}
          <div class="references-section">
            <h4>Linked Entities</h4>
            {#if !selectedNote.references || selectedNote.references.length === 0}
              <p class="no-refs">No linked entities.</p>
            {:else}
              <div class="ref-list">
                {#each selectedNote.references as ref}
                  <div class="ref-item">
                    <span class="ref-tag ref-{ref.entity_type}">{ref.entity_type}</span>
                    <span class="ref-id">{ref.entity_id.slice(0, 8)}...</span>
                    <button class="btn btn-sm btn-danger" onclick={() => unlinkEntity(ref)}>
                      Unlink
                    </button>
                  </div>
                {/each}
              </div>
            {/if}

            {#if showRefPicker}
              <div class="ref-picker">
                <select bind:value={refEntityType}>
                  {#each ENTITY_TYPES as et}
                    <option value={et}>{et}</option>
                  {/each}
                </select>
                <input
                  type="text"
                  placeholder="Entity ID"
                  bind:value={refEntityId}
                />
                <button class="btn btn-sm btn-primary" onclick={linkEntity}>Link</button>
                <button class="btn btn-sm btn-ghost" onclick={() => showRefPicker = false}>Cancel</button>
              </div>
            {:else}
              <button class="btn btn-sm btn-add" onclick={() => showRefPicker = true}>
                + Link Entity
              </button>
            {/if}
          </div>
        {/if}

        <div class="editor-actions">
          <button class="btn btn-save" onclick={saveNote} disabled={saving}>
            {#if saving}
              <LoadingSpinner size="sm" />
            {:else}
              {editing ? 'Create' : 'Save'}
            {/if}
          </button>

          {#if !editing && selectedNote}
            <button
              class="btn btn-delete"
              onclick={() => confirmDeleteOpen = true}
            >
              Delete
            </button>
          {/if}
        </div>
      </div>
    {/if}
    {/snippet}
  </SplitPanel>
</PageWrapper>

<ConfirmDialog
  open={confirmDeleteOpen}
  title="Delete Note"
  message="Are you sure you want to delete this note? This action cannot be undone."
  confirmLabel="Delete"
  onconfirm={deleteNote}
  oncancel={() => confirmDeleteOpen = false}
  destructive
/>

<style>
  .filter-bar {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .list-loading {
    display: flex;
    justify-content: center;
    padding: 3rem 1rem;
  }

  .note-list {
    list-style: none;
    overflow-y: auto;
    flex: 1;
    padding: var(--space-2) 0;
  }

  .note-list li {
    padding: 0 var(--space-3);
    margin-bottom: var(--space-1);
  }

  .note-card {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
  }

  .note-card:hover { background: var(--color-surface-raised); }

  .note-card.selected {
    background: var(--color-primary-subtle);
    border-left: 3px solid var(--color-primary);
    padding-left: calc(1rem - 3px);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .card-title {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .card-date {
    font-size: var(--text-xs);
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .card-preview {
    font-size: var(--text-sm);
    color: var(--text-muted);
    line-height: 1.4;
    margin-bottom: 0.25rem;
  }

  .ref-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .ref-tag {
    display: inline-block;
    padding: 0.1em 0.35em;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .ref-source { background: var(--color-info-border); color: var(--color-info-text); }
  .ref-bullet { background: #ede9fe; color: #5b21b6; } /* semantic: no token -- bullet reference type color */
  .ref-perspective { background: #d1fae5; color: var(--color-success-text); } /* semantic: no token -- perspective reference type color */
  .ref-resume_entry { background: var(--color-warning-bg); color: var(--color-warning-text); }
  .ref-resume { background: #fce7f3; color: #9d174d; } /* semantic: no token -- resume reference type color */
  .ref-skill { background: var(--color-tag-bg); color: var(--color-tag-text); }
  .ref-organization { background: var(--color-tag-neutral-bg); color: var(--color-tag-neutral-text); }

  .editor-content {
    max-width: 640px;
    padding: 2rem;
  }

  .editor-heading {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    margin-bottom: 0.35rem;
  }

  .required { color: var(--color-danger); }

  .form-group input[type='text'],
  .form-group textarea {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    color: var(--text-primary);
    background: var(--color-surface);
    transition: border-color 0.15s;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 150px;
    line-height: 1.5;
  }

  .references-section {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border);
  }

  .references-section h4 {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }

  .no-refs {
    font-size: var(--text-sm);
    color: var(--text-faint);
    font-style: italic;
    margin-bottom: 0.5rem;
  }

  .ref-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .ref-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    background: var(--color-surface-raised);
    border-radius: var(--radius-md);
  }

  .ref-id {
    font-size: var(--text-sm);
    color: var(--text-muted);
    font-family: monospace;
    flex: 1;
  }

  .ref-picker {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }

  .ref-picker select,
  .ref-picker input {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .ref-picker select:focus,
  .ref-picker input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .ref-picker input {
    flex: 1;
    min-width: 120px;
  }

  .editor-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1.1rem;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-save { background: var(--color-primary); color: var(--color-surface); }
  .btn-save:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-delete { background: var(--color-danger-subtle); color: var(--color-danger-text); margin-left: auto; }
  .btn-delete:hover { background: var(--color-danger-subtle); }

  .btn-sm {
    padding: 0.3rem 0.6rem;
    font-size: var(--text-sm);
  }

  .btn-primary { background: var(--color-primary); color: var(--color-surface); }
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-ghost { background: transparent; color: var(--text-muted); }
  .btn-ghost:hover { color: var(--text-secondary); background: var(--color-ghost); }
  .btn-danger { background: var(--color-danger-subtle); color: var(--color-danger-text); }
  .btn-danger:hover { background: var(--color-danger-subtle); }
  .btn-add { background: var(--color-success-subtle); color: var(--color-success-strong); margin-top: 0.5rem; }
  .btn-add:hover { background: var(--color-success-subtle); }
</style>
