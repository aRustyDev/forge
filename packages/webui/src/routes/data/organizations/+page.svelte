<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, EmptyState, ConfirmDialog } from '$lib/components'
  import type { Organization, OrgTag } from '@forge/sdk'

  const ORG_TYPES = ['company', 'nonprofit', 'government', 'military', 'education', 'volunteer', 'freelance', 'other']
  const ALL_TAGS: OrgTag[] = ['company', 'vendor', 'platform', 'university', 'school', 'nonprofit', 'government', 'military', 'conference', 'volunteer', 'freelance', 'other']
  const EMPLOYMENT_TYPES = ['civilian', 'contractor', 'military_active', 'military_reserve', 'volunteer', 'intern']

  let organizations = $state<Organization[]>([])
  let selectedId = $state<string | null>(null)
  let tagFilter = $state('all')
  let searchQuery = $state('')
  let loading = $state(true)
  let editing = $state(false)
  let saving = $state(false)
  let confirmDeleteOpen = $state(false)

  // Form fields
  let formName = $state('')
  let formOrgType = $state('company')
  let formTags = $state<string[]>([])
  let formIndustry = $state('')
  let formSize = $state('')
  let formWorked = $state(false)
  let formEmploymentType = $state('')
  let formLocation = $state('')
  let formHeadquarters = $state('')
  let formWebsite = $state('')
  let formLinkedinUrl = $state('')
  let formGlassdoorUrl = $state('')
  let formGlassdoorRating = $state<number | null>(null)
  let formReputationNotes = $state('')
  let formNotes = $state('')
  let formStatus = $state<string | null>(null)

  let filteredOrgs = $derived.by(() => {
    let result = organizations
    if (tagFilter !== 'all') {
      result = result.filter(o => o.tags?.includes(tagFilter as OrgTag))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o => o.name.toLowerCase().includes(q))
    }
    return result
  })

  let selectedOrg = $derived(organizations.find(o => o.id === selectedId) ?? null)

  $effect(() => { loadOrganizations() })

  $effect(() => {
    if (selectedOrg && !editing) {
      populateForm(selectedOrg)
    }
  })

  async function loadOrganizations() {
    loading = true
    const result = await forge.organizations.list({ limit: 500 })
    if (result.ok) {
      organizations = result.data
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to load organizations'), type: 'error' })
    }
    loading = false
  }

  function populateForm(org: Organization) {
    formName = org.name
    formOrgType = org.org_type
    formTags = [...(org.tags ?? [])]
    formIndustry = org.industry ?? ''
    formSize = org.size ?? ''
    formWorked = org.worked
    formEmploymentType = org.employment_type ?? ''
    formLocation = org.location ?? ''
    formHeadquarters = org.headquarters ?? ''
    formWebsite = org.website ?? ''
    formLinkedinUrl = org.linkedin_url ?? ''
    formGlassdoorUrl = org.glassdoor_url ?? ''
    formGlassdoorRating = org.glassdoor_rating ?? null
    formReputationNotes = org.reputation_notes ?? ''
    formNotes = org.notes ?? ''
    formStatus = org.status ?? null
  }

  function startNew() {
    selectedId = null
    editing = true
    formName = ''
    formOrgType = 'company'
    formTags = ['company']
    formIndustry = ''
    formSize = ''
    formWorked = false
    formEmploymentType = ''
    formLocation = ''
    formHeadquarters = ''
    formWebsite = ''
    formLinkedinUrl = ''
    formGlassdoorUrl = ''
    formGlassdoorRating = null
    formReputationNotes = ''
    formNotes = ''
    formStatus = null
  }

  function selectOrg(id: string) {
    editing = false
    selectedId = id
  }

  function toggleTag(tag: string) {
    if (formTags.includes(tag)) {
      formTags = formTags.filter(t => t !== tag)
    } else {
      formTags = [...formTags, tag]
    }
  }

  async function saveOrg() {
    if (!formName.trim()) {
      addToast({ message: 'Name is required.', type: 'error' })
      return
    }

    saving = true
    const payload: Record<string, unknown> = {
      name: formName.trim(),
      org_type: formOrgType,
      tags: formTags,
      industry: formIndustry || undefined,
      size: formSize || undefined,
      worked: formWorked,
      employment_type: formWorked ? (formEmploymentType || undefined) : undefined,
      location: formLocation || undefined,
      headquarters: formHeadquarters || undefined,
      website: formWebsite || undefined,
      linkedin_url: formLinkedinUrl || undefined,
      glassdoor_url: formGlassdoorUrl || undefined,
      glassdoor_rating: formGlassdoorRating,
      reputation_notes: formReputationNotes || undefined,
      notes: formNotes || undefined,
      status: formStatus,
    }

    if (editing) {
      const result = await forge.organizations.create(payload as any)
      if (result.ok) {
        organizations = [...organizations, result.data]
        selectedId = result.data.id
        editing = false
        addToast({ message: 'Organization created.', type: 'success' })
      } else {
        addToast({ message: friendlyError(result.error, 'Failed to create organization'), type: 'error' })
      }
    } else if (selectedId) {
      const result = await forge.organizations.update(selectedId, payload as any)
      if (result.ok) {
        organizations = organizations.map(o => o.id === selectedId ? result.data : o)
        addToast({ message: 'Organization updated.', type: 'success' })
      } else {
        addToast({ message: friendlyError(result.error, 'Failed to update organization'), type: 'error' })
      }
    }
    saving = false
  }

  async function deleteOrg() {
    if (!selectedId) return
    confirmDeleteOpen = false

    const id = selectedId
    const result = await forge.organizations.delete(id)
    if (result.ok) {
      organizations = organizations.filter(o => o.id !== id)
      selectedId = null
      editing = false
      addToast({ message: 'Organization deleted.', type: 'success' })
    } else {
      addToast({ message: `Failed to delete: ${result.error.message}`, type: 'error' })
    }
  }
</script>

<div class="orgs-page">
  <!-- Left panel: Org list -->
  <div class="list-panel">
    <div class="list-header">
      <h2>All Organizations</h2>
      <button class="btn-new" onclick={startNew}>+ New</button>
    </div>

    <div class="filter-bar">
      <input class="search-input" type="text" placeholder="Search..." bind:value={searchQuery} />
      <select class="filter-select" bind:value={tagFilter}>
        <option value="all">All tags</option>
        {#each ALL_TAGS as t}
          <option value={t}>{t}</option>
        {/each}
      </select>
    </div>

    {#if loading}
      <div class="list-loading">
        <LoadingSpinner size="md" message="Loading organizations..." />
      </div>
    {:else if filteredOrgs.length === 0}
      <EmptyState
        title="No organizations found"
        description="Create your first organization."
        action="New Organization"
        onaction={startNew}
      />
    {:else}
      <ul class="org-list">
        {#each filteredOrgs as org (org.id)}
          <li>
            <button
              class="org-card"
              class:selected={selectedId === org.id}
              onclick={() => selectOrg(org.id)}
            >
              <div class="card-top">
                <span class="card-title">{org.name}</span>
                {#if org.worked}
                  <span class="worked-badge">Worked</span>
                {/if}
              </div>
              <div class="card-tags">
                {#each (org.tags ?? []) as tag}
                  <span class="tag-pill">{tag}</span>
                {/each}
              </div>
              {#if org.industry || org.location}
                <div class="card-meta">
                  {#if org.industry}<span class="meta-item">{org.industry}</span>{/if}
                  {#if org.location}<span class="meta-item">{org.location}</span>{/if}
                </div>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Right panel: Editor -->
  <div class="editor-panel">
    {#if !selectedOrg && !editing}
      <div class="editor-empty">
        <p>Select an organization or create a new one.</p>
      </div>
    {:else}
      <div class="editor-content">
        <h3 class="editor-heading">{editing ? 'New Organization' : 'Edit Organization'}</h3>

        <div class="form-group">
          <label for="org-name">Name <span class="required">*</span></label>
          <input id="org-name" type="text" bind:value={formName} placeholder="e.g. Anthropic" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="org-type">Primary Type</label>
            <select id="org-type" bind:value={formOrgType}>
              {#each ORG_TYPES as t}
                <option value={t}>{t}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label for="org-industry">Industry</label>
            <input id="org-industry" type="text" bind:value={formIndustry} placeholder="e.g. AI Safety" />
          </div>
        </div>

        <div class="form-group">
          <label>Tags</label>
          <div class="tag-grid">
            {#each ALL_TAGS as tag}
              <label class="tag-check">
                <input type="checkbox" checked={formTags.includes(tag)} onchange={() => toggleTag(tag)} />
                {tag}
              </label>
            {/each}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="org-size">Size</label>
            <input id="org-size" type="text" bind:value={formSize} placeholder="e.g. 100-500" />
          </div>
          <div class="form-group">
            <label for="org-status">Status</label>
            <select id="org-status" bind:value={formStatus}>
              <option value={null}>No status</option>
              <option value="backlog">Backlog</option>
              <option value="researching">Researching</option>
              <option value="exciting">Exciting</option>
              <option value="interested">Interested</option>
              <option value="acceptable">Acceptable</option>
              <option value="excluded">Excluded</option>
            </select>
          </div>
        </div>

        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" bind:checked={formWorked} /> I have worked here
          </label>
        </div>

        {#if formWorked}
          <div class="form-group">
            <label for="org-employment">Employment Type</label>
            <select id="org-employment" bind:value={formEmploymentType}>
              <option value="">Not specified</option>
              {#each EMPLOYMENT_TYPES as t}
                <option value={t}>{t.replace(/_/g, ' ')}</option>
              {/each}
            </select>
          </div>
        {/if}

        <div class="form-row">
          <div class="form-group">
            <label for="org-location">Location</label>
            <input id="org-location" type="text" bind:value={formLocation} />
          </div>
          <div class="form-group">
            <label for="org-hq">Headquarters</label>
            <input id="org-hq" type="text" bind:value={formHeadquarters} />
          </div>
        </div>

        <div class="form-group">
          <label for="org-website">Website</label>
          <input id="org-website" type="url" bind:value={formWebsite} />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="org-linkedin">LinkedIn URL</label>
            <input id="org-linkedin" type="url" bind:value={formLinkedinUrl} />
          </div>
          <div class="form-group">
            <label for="org-glassdoor">Glassdoor URL</label>
            <input id="org-glassdoor" type="url" bind:value={formGlassdoorUrl} />
          </div>
        </div>

        <div class="form-group">
          <label for="org-rating">Glassdoor Rating</label>
          <input id="org-rating" type="number" step="0.1" min="0" max="5" bind:value={formGlassdoorRating} />
        </div>

        <div class="form-group">
          <label for="org-reputation">Reputation Notes</label>
          <textarea id="org-reputation" bind:value={formReputationNotes} rows="3"></textarea>
        </div>

        <div class="form-group">
          <label for="org-notes">Notes</label>
          <textarea id="org-notes" bind:value={formNotes} rows="3"></textarea>
        </div>

        <div class="editor-actions">
          <button class="btn btn-save" onclick={saveOrg} disabled={saving}>
            {#if saving}
              <LoadingSpinner size="sm" />
            {:else}
              {editing ? 'Create' : 'Save'}
            {/if}
          </button>

          {#if !editing && selectedOrg}
            <button class="btn btn-delete" onclick={() => confirmDeleteOpen = true}>Delete</button>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<ConfirmDialog
  open={confirmDeleteOpen}
  title="Delete Organization"
  message="Are you sure you want to delete this organization? This action cannot be undone."
  confirmLabel="Delete"
  onconfirm={deleteOrg}
  oncancel={() => confirmDeleteOpen = false}
  destructive
/>

<style>
  .orgs-page { display: flex; gap: 0; height: calc(100vh - 4rem); margin: -2rem; }
  .list-panel { width: 340px; flex-shrink: 0; border-right: 1px solid #e5e7eb; background: #fff; display: flex; flex-direction: column; overflow: hidden; }
  .list-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1rem; border-bottom: 1px solid #e5e7eb; }
  .list-header h2 { font-size: 1.1rem; font-weight: 600; color: #1a1a1a; margin: 0; }
  .btn-new { padding: 0.35rem 0.75rem; background: #6c63ff; color: #fff; border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 500; cursor: pointer; }
  .btn-new:hover { background: #5a52e0; }

  .filter-bar { display: flex; gap: 0.5rem; padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; }
  .search-input { flex: 1; padding: 0.35rem 0.5rem; border: 1px solid #d1d5db; border-radius: 5px; font-size: 0.78rem; }
  .search-input:focus { outline: none; border-color: #6c63ff; }
  .filter-select { padding: 0.35rem 0.5rem; border: 1px solid #d1d5db; border-radius: 5px; font-size: 0.78rem; }
  .filter-select:focus { outline: none; border-color: #6c63ff; }

  .list-loading { display: flex; justify-content: center; padding: 3rem 1rem; }
  .org-list { list-style: none; overflow-y: auto; flex: 1; padding: 0; margin: 0; }

  .org-card { display: block; width: 100%; padding: 0.75rem 1rem; background: none; border: none; border-bottom: 1px solid #f3f4f6; cursor: pointer; text-align: left; transition: background 0.12s; }
  .org-card:hover { background: #f9fafb; }
  .org-card.selected { background: #eef2ff; border-left: 3px solid #6c63ff; padding-left: calc(1rem - 3px); }

  .card-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
  .card-title { font-size: 0.875rem; font-weight: 500; color: #1a1a1a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .worked-badge { display: inline-block; padding: 0.1em 0.4em; background: #d1fae5; color: #065f46; border-radius: 3px; font-size: 0.65rem; font-weight: 600; flex-shrink: 0; }

  .card-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.2rem; }
  .tag-pill { display: inline-block; padding: 0.1em 0.4em; background: #e0e7ff; color: #4338ca; border-radius: 3px; font-size: 0.6rem; font-weight: 500; text-transform: capitalize; }

  .card-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .meta-item { font-size: 0.72rem; color: #6b7280; }

  /* Editor */
  .editor-panel { flex: 1; overflow-y: auto; background: #fff; }
  .editor-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af; font-size: 0.95rem; }
  .editor-content { max-width: 640px; padding: 2rem; }
  .editor-heading { font-size: 1.1rem; font-weight: 600; color: #1a1a1a; margin-bottom: 1.5rem; }

  .form-group { margin-bottom: 1.25rem; }
  .form-group label { display: block; font-size: 0.8rem; font-weight: 500; color: #374151; margin-bottom: 0.35rem; }
  .checkbox-group label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
  .required { color: #ef4444; }

  .form-group input[type='text'],
  .form-group input[type='url'],
  .form-group input[type='number'],
  .form-group textarea,
  .form-group select { width: 100%; padding: 0.5rem 0.65rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; color: #1a1a1a; background: #fff; font-family: inherit; }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus { outline: none; border-color: #6c63ff; box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15); }

  .form-group textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
  .form-row { display: flex; gap: 1rem; }
  .form-row .form-group { flex: 1; }

  .tag-grid { display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; }
  .tag-check { display: flex; align-items: center; gap: 0.25rem; font-size: 0.8rem; color: #4b5563; cursor: pointer; }
  .tag-check input[type='checkbox'] { margin: 0; }

  .editor-actions { display: flex; align-items: center; gap: 0.75rem; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid #e5e7eb; }
  .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.1rem; border: none; border-radius: 6px; font-size: 0.85rem; font-weight: 500; cursor: pointer; }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-save { background: #6c63ff; color: #fff; }
  .btn-save:hover:not(:disabled) { background: #5a52e0; }
  .btn-delete { background: #fee2e2; color: #dc2626; margin-left: auto; }
  .btn-delete:hover { background: #fecaca; }
</style>
