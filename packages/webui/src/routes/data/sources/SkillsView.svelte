<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, EmptyState, ListSearchInput, SplitPanel, ListPanelHeader, EmptyPanel, EntityNotes } from '$lib/components'
  import type { Skill, SkillCategory, Domain } from '@forge/sdk'

  // SkillCategory enum — matches migration 041 CHECK constraint.
  const CATEGORIES: SkillCategory[] = [
    'ai_ml', 'language', 'framework', 'platform', 'tool', 'library',
    'infrastructure', 'data_systems', 'security',
    'methodology', 'protocol', 'concept', 'soft_skill', 'other',
  ]

  let skills = $state<Skill[]>([])
  let allDomains = $state<Domain[]>([])
  let selectedDomains = $state<Domain[]>([])
  let selectedId = $state<string | null>(null)
  let categoryFilter = $state<'all' | SkillCategory>('all')
  let searchQuery = $state('')
  let loading = $state(true)
  let editing = $state(false)
  let saving = $state(false)

  let formName = $state('')
  let formCategory = $state<SkillCategory>('other')
  let formDomainIds = $state<Set<string>>(new Set())

  // Grouping state — follows SourcesView education grouping pattern
  let groupBy = $state<'flat' | 'by_category'>('flat')
  let collapsedGroups = $state<Record<string, boolean>>({})

  function toggleGroup(group: string) {
    collapsedGroups[group] = !collapsedGroups[group]
  }

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

  let groupedSkills = $derived.by(() => {
    if (groupBy !== 'by_category') return null
    const groups: Record<string, Skill[]> = {}
    for (const skill of filteredSkills) {
      const cat = skill.category ?? 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(skill)
    }
    // Sort groups alphabetically by category name
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  })

  let selectedSkill = $derived(skills.find(s => s.id === selectedId) ?? null)

  $effect(() => { loadInitial() })

  $effect(() => {
    if (selectedSkill && !editing) {
      formName = selectedSkill.name
      formCategory = (selectedSkill.category ?? 'other') as SkillCategory
      // Reload linked domains for the selected skill
      loadSkillDomains(selectedSkill.id)
    }
  })

  async function loadInitial() {
    await Promise.all([loadSkills(), loadDomains()])
  }

  async function loadDomains() {
    const res = await forge.domains.list({ limit: 200 })
    if (res.ok) allDomains = res.data
  }

  async function loadSkillDomains(skillId: string) {
    const res = await forge.skills.listDomains(skillId)
    if (res.ok) {
      selectedDomains = res.data
      formDomainIds = new Set(res.data.map(d => d.id))
    } else {
      selectedDomains = []
      formDomainIds = new Set()
    }
  }

  async function loadSkills() {
    loading = true
    const res = await forge.skills.list({ limit: 500 })
    if (res.ok) {
      skills = res.data
    } else {
      addToast({ message: friendlyError(res.error, 'Failed to load skills'), type: 'error' })
    }
    loading = false
  }

  function startNew() {
    selectedId = null
    editing = true
    formName = ''
    formCategory = 'other'
    formDomainIds = new Set()
    selectedDomains = []
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
    const res = await forge.skills.delete(selectedId)
    if (res.ok) {
      skills = skills.filter(s => s.id !== selectedId)
      selectedId = null
      editing = false
      selectedDomains = []
      formDomainIds = new Set()
      addToast({ message: 'Skill deleted.', type: 'success' })
    } else {
      addToast({ message: friendlyError(res.error, 'Failed to delete skill'), type: 'error' })
    }
  }

  function toggleDomain(domainId: string) {
    const next = new Set(formDomainIds)
    if (next.has(domainId)) next.delete(domainId)
    else next.add(domainId)
    formDomainIds = next
  }

  /**
   * Sync the skill's domain links with formDomainIds by diffing against
   * the currently-linked domains and applying the minimal set of add/remove
   * calls. Runs after create or update.
   */
  async function syncDomains(skillId: string): Promise<boolean> {
    const current = new Set(selectedDomains.map(d => d.id))
    const target = formDomainIds
    const toAdd = [...target].filter(id => !current.has(id))
    const toRemove = [...current].filter(id => !target.has(id))

    for (const domainId of toAdd) {
      const res = await forge.skills.addDomain(skillId, domainId)
      if (!res.ok) {
        addToast({ message: friendlyError(res.error, 'Failed to link domain'), type: 'error' })
        return false
      }
    }
    for (const domainId of toRemove) {
      const res = await forge.skills.removeDomain(skillId, domainId)
      if (!res.ok) {
        addToast({ message: friendlyError(res.error, 'Failed to unlink domain'), type: 'error' })
        return false
      }
    }
    return true
  }

  async function saveSkill() {
    if (!formName.trim()) {
      addToast({ message: 'Name is required.', type: 'error' })
      return
    }

    saving = true

    if (editing && !selectedId) {
      // Create new skill
      const createRes = await forge.skills.create({
        name: formName.trim(),
        category: formCategory,
      })
      if (createRes.ok) {
        skills = [...skills, createRes.data]
        selectedId = createRes.data.id
        // Start from empty link set, then sync selected domains
        selectedDomains = []
        const ok = await syncDomains(createRes.data.id)
        if (ok) await loadSkillDomains(createRes.data.id)
        editing = false
        addToast({ message: 'Skill created.', type: 'success' })
      } else {
        addToast({ message: friendlyError(createRes.error, 'Failed to create skill'), type: 'error' })
      }
    } else if (selectedId) {
      // Update existing skill
      const updateRes = await forge.skills.update(selectedId, {
        name: formName.trim(),
        category: formCategory,
      })
      if (updateRes.ok) {
        skills = skills.map(s => s.id === selectedId ? updateRes.data : s)
        const ok = await syncDomains(selectedId)
        if (ok) await loadSkillDomains(selectedId)
        editing = false
        addToast({ message: 'Skill updated.', type: 'success' })
      } else {
        addToast({ message: friendlyError(updateRes.error, 'Failed to update skill'), type: 'error' })
      }
    }

    saving = false
  }
</script>

<div class="skills-page">
  <SplitPanel listWidth={300}>
    {#snippet list()}
      <ListPanelHeader title="Skills" onNew={startNew} />

      <div class="filter-bar">
        <ListSearchInput
          bind:value={searchQuery}
          placeholder="Search skills..."
        />
        <select class="filter-select" bind:value={categoryFilter}>
          <option value="all">All categories</option>
          {#each CATEGORIES as cat}
            <option value={cat}>{cat.replace(/_/g, ' ')}</option>
          {/each}
        </select>
      </div>

      <div class="group-bar">
        <label for="skill-group-by">Group by:</label>
        <select id="skill-group-by" bind:value={groupBy}>
          <option value="flat">None</option>
          <option value="by_category">Category</option>
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
        >
          {#if !searchQuery}
            <button class="btn btn-primary" onclick={startNew}>New Skill</button>
          {/if}
        </EmptyState>
      {:else if groupBy === 'by_category' && groupedSkills}
        {#each groupedSkills as [category, categorySkills]}
          <div class="group-section">
            <button class="group-header" onclick={() => toggleGroup(category)}>
              <span class="group-chevron" class:collapsed={collapsedGroups[category]}>&#9656;</span>
              <span class="group-label">{category.replace(/_/g, ' ')}</span>
              <span class="group-count">{categorySkills.length}</span>
            </button>
            {#if !collapsedGroups[category]}
              <ul class="skill-list">
                {#each categorySkills as skill (skill.id)}
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
        {/each}
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
    {/snippet}

    {#snippet detail()}
      {#if !selectedSkill && !editing}
        <EmptyPanel message="Select a skill or create a new one." />
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

          <EntityNotes entityType="skill" entityId={selectedSkill?.id} />

          <div class="form-group">
            <span class="form-group-title">Domains</span>
            {#if editing}
              <div class="domain-checkbox-list">
                {#each allDomains as domain (domain.id)}
                  <label class="domain-checkbox">
                    <input
                      type="checkbox"
                      checked={formDomainIds.has(domain.id)}
                      onchange={() => toggleDomain(domain.id)}
                    />
                    <span>{domain.name}</span>
                  </label>
                {/each}
                {#if allDomains.length === 0}
                  <p class="empty-hint">No domains yet. Create domains first to link them.</p>
                {/if}
              </div>
            {:else if selectedDomains.length > 0}
              <div class="domain-tags">
                {#each selectedDomains as domain (domain.id)}
                  <span class="domain-tag">{domain.name}</span>
                {/each}
              </div>
            {:else}
              <p class="empty-hint">No domains linked.</p>
            {/if}
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
    {/snippet}
  </SplitPanel>
</div>

<style>
  .skills-page {
    display: flex;
    gap: 0;
    height: 100%;
  }

  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .filter-select {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
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
    padding: var(--space-2) 0;
  }

  .skill-list li {
    padding: 0 var(--space-3);
    margin-bottom: var(--space-1);
  }

  .skill-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.65rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
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
    font-size: var(--text-base);
    font-weight: var(--font-medium);
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
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }

  /* Editor */
  .editor-content {
    max-width: 480px;
    padding: 2rem;
  }

  .editor-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
  .editor-heading {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
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
  .form-group textarea,
  .form-group select {
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
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-save { background: var(--color-primary); color: var(--text-inverse); }
  .btn-save:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-cancel { background: var(--color-ghost); color: var(--text-muted); }
  .btn-cancel:hover { background: var(--color-ghost-hover); }
  .btn-edit { padding: 0.3rem 0.7rem; background: var(--color-tag-bg); color: var(--color-tag-text); border: none; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--font-medium); cursor: pointer; }
  .btn-edit:hover { background: var(--color-primary-subtle); }
  .btn-delete { background: var(--color-danger-subtle); color: var(--color-danger-text); margin-left: auto; }
  .btn-delete:hover { background: var(--color-danger-subtle); }

  /* Group bar and collapsible sections */
  .group-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .group-bar select {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    background: var(--color-surface);
    color: var(--text-primary);
  }

  .group-section {
    border-bottom: 1px solid var(--color-border);
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-sunken);
    border: none;
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .group-header:hover {
    background: var(--color-surface-raised);
  }

  .group-chevron {
    display: inline-block;
    transition: transform 0.15s ease;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .group-chevron.collapsed {
    transform: rotate(0deg);
  }

  .group-chevron:not(.collapsed) {
    transform: rotate(90deg);
  }

  .group-label {
    text-transform: capitalize;
  }

  .group-count {
    margin-left: auto;
    font-size: var(--text-xs);
    color: var(--text-faint);
    font-weight: var(--font-normal);
  }

  /* Domain multi-select */
  .form-group-title {
    display: block;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    margin-bottom: 0.35rem;
  }

  .domain-checkbox-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    max-height: 180px;
    overflow-y: auto;
  }

  .domain-checkbox {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-primary);
    cursor: pointer;
  }

  .domain-checkbox input[type='checkbox'] {
    margin: 0;
    cursor: pointer;
  }

  .domain-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .domain-tag {
    display: inline-block;
    padding: 0.15em 0.5em;
    background: var(--color-info-subtle);
    color: var(--color-info-text);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
  }

  .empty-hint {
    font-size: var(--text-sm);
    color: var(--text-faint);
    font-style: italic;
    margin: 0;
  }
</style>
