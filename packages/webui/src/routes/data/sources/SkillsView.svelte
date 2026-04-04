<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, EmptyState } from '$lib/components'
  import type { Skill } from '@forge/sdk'

  const CATEGORIES = [
    'ai_ml', 'cloud', 'database', 'devops', 'frameworks',
    'general', 'language', 'languages', 'os', 'security', 'tools',
  ]

  let skills = $state<Skill[]>([])
  let selectedId = $state<string | null>(null)
  let categoryFilter = $state('all')
  let searchQuery = $state('')
  let loading = $state(true)
  let editing = $state(false)
  let saving = $state(false)

  let formName = $state('')
  let formCategory = $state('general')
  let formNotes = $state('')

  let filteredSkills = $derived.by(() => {
    let result = skills
    if (categoryFilter !== 'all') {
      result = result.filter(s => s.category === categoryFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s => s.name.toLowerCase().includes(q))
    }
    return result
  })

  let selectedSkill = $derived(skills.find(s => s.id === selectedId) ?? null)

  $effect(() => { loadSkills() })

  $effect(() => {
    if (selectedSkill && !editing) {
      formName = selectedSkill.name
      formCategory = selectedSkill.category ?? 'general'
      formNotes = selectedSkill.notes ?? ''
    }
  })

  async function loadSkills() {
    loading = true
    // Skills API returns { data: Skill[] } without pagination
    try {
      const response = await fetch('/api/skills')
      if (response.ok) {
        const json = await response.json()
        skills = json.data ?? []
      } else {
        addToast({ message: 'Failed to load skills', type: 'error' })
      }
    } catch {
      addToast({ message: 'Cannot connect to the Forge API server. Start it with: just api', type: 'error' })
    }
    loading = false
  }

  function startNew() {
    selectedId = null
    editing = true
    formName = ''
    formCategory = 'general'
    formNotes = ''
  }

  function selectSkill(id: string) {
    editing = false
    selectedId = id
  }

  function startEditing() {
    editing = true
  }

  async function deleteSkill() {
    if (!selectedId) return
    const res = await fetch(`/api/skills/${selectedId}`, { method: 'DELETE' })
    if (res.ok) {
      skills = skills.filter(s => s.id !== selectedId)
      selectedId = null
      editing = false
      addToast({ message: 'Skill deleted.', type: 'success' })
    } else {
      addToast({ message: 'Failed to delete skill.', type: 'error' })
    }
  }

  async function saveSkill() {
    if (!formName.trim()) {
      addToast({ message: 'Name is required.', type: 'error' })
      return
    }

    saving = true

    if (editing) {
      // Create new skill via API
      try {
        const response = await fetch('/api/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            category: formCategory,
          }),
        })
        if (response.ok) {
          const json = await response.json()
          skills = [...skills, json.data]
          selectedId = json.data.id
          editing = false
          addToast({ message: 'Skill created.', type: 'success' })
        } else {
          const json = await response.json().catch(() => ({}))
          addToast({ message: `Failed to create skill: ${json.error?.message ?? 'Unknown error'}`, type: 'error' })
        }
      } catch {
        addToast({ message: 'Failed to create skill', type: 'error' })
      }
    } else if (selectedId) {
      // Update existing skill
      try {
        const response = await fetch(`/api/skills/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            category: formCategory,
          }),
        })
        if (response.ok) {
          const json = await response.json()
          skills = skills.map(s => s.id === selectedId ? json.data : s)
          editing = false
          addToast({ message: 'Skill updated.', type: 'success' })
        } else {
          const json = await response.json().catch(() => ({}))
          addToast({ message: `Failed to update: ${json.error?.message ?? 'Unknown error'}`, type: 'error' })
        }
      } catch {
        addToast({ message: 'Failed to update skill', type: 'error' })
      }
    }

    saving = false
  }
</script>

<div class="skills-page">
  <!-- Left panel -->
  <div class="list-panel">
    <div class="list-header">
      <h2>Skills</h2>
      <button class="btn-new" onclick={startNew}>+ New</button>
    </div>

    <div class="filter-bar">
      <input
        type="text"
        class="search-input"
        placeholder="Search skills..."
        bind:value={searchQuery}
      />
      <select class="filter-select" bind:value={categoryFilter}>
        <option value="all">All categories</option>
        {#each CATEGORIES as cat}
          <option value={cat}>{cat.replace(/_/g, ' ')}</option>
        {/each}
      </select>
    </div>

    {#if loading}
      <div class="list-loading">
        <LoadingSpinner size="md" message="Loading skills..." />
      </div>
    {:else if filteredSkills.length === 0}
      <EmptyState
        title="No skills found"
        description={searchQuery ? 'Try adjusting your search.' : 'Create your first skill.'}
        action={!searchQuery ? 'New Skill' : undefined}
        onaction={!searchQuery ? startNew : undefined}
      />
    {:else}
      <ul class="skill-list">
        {#each filteredSkills as skill (skill.id)}
          <li>
            <button
              class="skill-card"
              class:selected={selectedId === skill.id}
              onclick={() => selectSkill(skill.id)}
            >
              <span class="card-title">{skill.name}</span>
              {#if skill.category}
                <span class="category-badge">{skill.category.replace(/_/g, ' ')}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Right panel -->
  <div class="editor-panel">
    {#if !selectedSkill && !editing}
      <div class="editor-empty">
        <p>Select a skill or create a new one.</p>
      </div>
    {:else}
      <div class="editor-content">
        <div class="editor-header">
          <h3 class="editor-heading">{editing && !selectedId ? 'New Skill' : editing ? 'Edit Skill' : 'Skill Details'}</h3>
          {#if !editing && selectedSkill}
            <button class="btn btn-edit" onclick={startEditing}>Edit</button>
          {/if}
        </div>

        <div class="form-group">
          <label for="skill-name">Name <span class="required">*</span></label>
          <input id="skill-name" type="text" bind:value={formName} placeholder="e.g. Kubernetes" disabled={!editing} />
        </div>

        <div class="form-group">
          <label for="skill-category">Category</label>
          <select id="skill-category" bind:value={formCategory} disabled={!editing}>
            {#each CATEGORIES as cat}
              <option value={cat}>{cat.replace(/_/g, ' ')}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label for="skill-notes">Notes</label>
          <textarea id="skill-notes" bind:value={formNotes} rows="3"
                    placeholder="Proficiency level, years of experience, context..."
                    disabled={!editing}></textarea>
        </div>

        {#if editing}
          <div class="editor-actions">
            <button class="btn btn-save" onclick={saveSkill} disabled={saving}>
              {#if saving}
                <LoadingSpinner size="sm" />
              {:else}
                {selectedId ? 'Save' : 'Create'}
              {/if}
            </button>
            <button class="btn btn-cancel" onclick={() => { editing = false; if (!selectedId) selectedId = null }}>
              Cancel
            </button>
          </div>
        {:else if selectedId}
          <div class="editor-actions">
            <button class="btn btn-delete" onclick={deleteSkill}>Delete</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .skills-page {
    display: flex;
    gap: 0;
    height: 100%;
  }

  .list-panel {
    width: 300px;
    flex-shrink: 0;
    border-right: 1px solid var(--color-border);
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .list-header h2 {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .btn-new {
    padding: 0.35rem 0.75rem;
    background: var(--color-primary);
    color: var(--text-inverse);
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .btn-new:hover { background: var(--color-primary-hover); }

  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .search-input {
    padding: 0.4rem 0.65rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 5px;
    font-size: 0.8rem;
    color: var(--text-primary);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .filter-select {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 5px;
    font-size: 0.78rem;
    color: var(--text-secondary);
    background: var(--color-surface);
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--color-border-focus);
  }

  .list-loading {
    display: flex;
    justify-content: center;
    padding: 3rem 1rem;
  }

  .skill-list {
    list-style: none;
    overflow-y: auto;
    flex: 1;
  }

  .skill-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.65rem 1rem;
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-ghost);
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
    gap: 0.5rem;
  }

  .skill-card:hover { background: var(--color-surface-raised); }

  .skill-card.selected {
    background: var(--color-primary-subtle);
    border-left: 3px solid var(--color-primary);
    padding-left: calc(1rem - 3px);
  }

  .card-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .category-badge {
    display: inline-block;
    padding: 0.1em 0.4em;
    background: var(--color-tag-bg);
    color: var(--color-tag-text);
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }

  /* Editor */
  .editor-panel {
    flex: 1;
    overflow-y: auto;
    background: var(--color-surface);
  }

  .editor-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-faint);
    font-size: 0.95rem;
  }

  .editor-content {
    max-width: 480px;
    padding: 2rem;
  }

  .editor-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
  .editor-heading {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    margin-bottom: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 0.35rem;
  }

  .required { color: var(--color-danger); }

  .form-group input[type='text'],
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--text-primary);
    background: var(--color-surface);
    transition: border-color 0.15s;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .form-group input:disabled,
  .form-group textarea:disabled,
  .form-group select:disabled {
    background: var(--color-surface-raised);
    color: var(--text-muted);
    cursor: default;
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
    line-height: 1.5;
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
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-save { background: var(--color-primary); color: var(--text-inverse); }
  .btn-save:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-cancel { background: var(--color-ghost); color: var(--text-muted); }
  .btn-cancel:hover { background: var(--color-ghost-hover); }
  .btn-edit { padding: 0.3rem 0.7rem; background: var(--color-tag-bg); color: var(--color-tag-text); border: none; border-radius: 5px; font-size: 0.78rem; font-weight: 500; cursor: pointer; }
  .btn-edit:hover { background: var(--color-primary-subtle); }
  .btn-delete { background: var(--color-danger-subtle); color: var(--color-danger-text); margin-left: auto; }
  .btn-delete:hover { background: var(--color-danger-subtle); }
</style>
