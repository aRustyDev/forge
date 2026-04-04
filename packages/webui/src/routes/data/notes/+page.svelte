<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, EmptyState, ConfirmDialog } from '$lib/components'
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

<div class="notes-page">
  <!-- Left panel -->
  <div class="list-panel">
    <div class="list-header">
      <h2>Notes</h2>
      <button class="btn-new" onclick={startNew}>+ New</button>
    </div>

    <div class="filter-bar">
      <input
        type="text"
        class="search-input"
        placeholder="Search notes..."
        bind:value={searchQuery}
      />
    </div>

    {#if loading}
      <div class="list-loading">
        <LoadingSpinner size="md" message="Loading notes..." />
      </div>
    {:else if filteredNotes.length === 0}
      <EmptyState
        title="No notes found"
        description={searchQuery ? 'Try adjusting your search.' : 'Create your first note.'}
        action={!searchQuery ? 'New Note' : undefined}
        onaction={!searchQuery ? startNew : undefined}
      />
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
  </div>

  <!-- Right panel -->
  <div class="editor-panel">
    {#if !selectedNote && !editing}
      <div class="editor-empty">
        <p>Select a note or create a new one.</p>
      </div>
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
  </div>
</div>

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
  .notes-page {
    display: flex;
    gap: 0;
    height: calc(100vh - 4rem);
    margin: -2rem;
  }

  .list-panel {
    width: 320px;
    flex-shrink: 0;
    border-right: 1px solid #e5e7eb;
    background: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .list-header h2 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .btn-new {
    padding: 0.35rem 0.75rem;
    background: #6c63ff;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .btn-new:hover { background: #5a52e0; }

  .filter-bar {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .search-input {
    width: 100%;
    padding: 0.4rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    font-size: 0.8rem;
    color: #1a1a1a;
  }

  .search-input:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
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
  }

  .note-card {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
  }

  .note-card:hover { background: #f9fafb; }

  .note-card.selected {
    background: #eef2ff;
    border-left: 3px solid #6c63ff;
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
    font-size: 0.875rem;
    font-weight: 500;
    color: #1a1a1a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .card-date {
    font-size: 0.7rem;
    color: #9ca3af;
    flex-shrink: 0;
  }

  .card-preview {
    font-size: 0.75rem;
    color: #6b7280;
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
    border-radius: 3px;
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .ref-source { background: #dbeafe; color: #1e40af; }
  .ref-bullet { background: #ede9fe; color: #5b21b6; }
  .ref-perspective { background: #d1fae5; color: #065f46; }
  .ref-resume_entry { background: #fef3c7; color: #92400e; }
  .ref-resume { background: #fce7f3; color: #9d174d; }
  .ref-skill { background: #e0e7ff; color: #3730a3; }
  .ref-organization { background: #f3f4f6; color: #374151; }

  /* Editor */
  .editor-panel {
    flex: 1;
    overflow-y: auto;
    background: #fff;
  }

  .editor-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #9ca3af;
    font-size: 0.95rem;
  }

  .editor-content {
    max-width: 640px;
    padding: 2rem;
  }

  .editor-heading {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.35rem;
  }

  .required { color: #ef4444; }

  .form-group input[type='text'],
  .form-group textarea {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1a1a1a;
    background: #fff;
    transition: border-color 0.15s;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 150px;
    line-height: 1.5;
  }

  .references-section {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid #e5e7eb;
  }

  .references-section h4 {
    font-size: 0.85rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.75rem;
  }

  .no-refs {
    font-size: 0.8rem;
    color: #9ca3af;
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
    background: #f9fafb;
    border-radius: 5px;
  }

  .ref-id {
    font-size: 0.75rem;
    color: #6b7280;
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
    border: 1px solid #d1d5db;
    border-radius: 5px;
    font-size: 0.78rem;
    color: #374151;
  }

  .ref-picker select:focus,
  .ref-picker input:focus {
    outline: none;
    border-color: #6c63ff;
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
    border-top: 1px solid #e5e7eb;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1.1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-save { background: #6c63ff; color: #fff; }
  .btn-save:hover:not(:disabled) { background: #5a52e0; }
  .btn-delete { background: #fee2e2; color: #dc2626; margin-left: auto; }
  .btn-delete:hover { background: #fecaca; }

  .btn-sm {
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
  }

  .btn-primary { background: #6c63ff; color: #fff; }
  .btn-primary:hover:not(:disabled) { background: #5a52e0; }
  .btn-ghost { background: transparent; color: #6b7280; }
  .btn-ghost:hover { color: #374151; background: #f3f4f6; }
  .btn-danger { background: #fee2e2; color: #dc2626; }
  .btn-danger:hover { background: #fecaca; }
  .btn-add { background: #f0fdf4; color: #16a34a; margin-top: 0.5rem; }
  .btn-add:hover { background: #dcfce7; }
</style>
