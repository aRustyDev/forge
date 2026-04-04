<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, EmptyState, ConfirmDialog } from '$lib/components'
  import type { Organization, OrgTag, OrgCampus } from '@forge/sdk'

  const ORG_TYPES = ['company', 'nonprofit', 'government', 'military', 'education', 'volunteer', 'freelance', 'other']
  const ALL_TAGS: OrgTag[] = ['company', 'vendor', 'platform', 'university', 'school', 'nonprofit', 'government', 'military', 'conference', 'volunteer', 'freelance', 'other']
  const EMPLOYMENT_TYPES = ['civilian', 'contractor', 'military_active', 'military_reserve', 'volunteer', 'intern']
  const MODALITY_LABELS: Record<string, string> = { in_person: 'In Person', remote: 'Remote', hybrid: 'Hybrid' }

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
  let formWebsite = $state('')
  let formLinkedinUrl = $state('')
  let formGlassdoorUrl = $state('')
  let formGlassdoorRating = $state<number | null>(null)
  let formReputationNotes = $state('')
  let formNotes = $state('')
  let formStatus = $state<string | null>(null)

  // Campus management
  let orgCampuses = $state<OrgCampus[]>([])
  let showAddCampus = $state(false)
  let newCampusName = $state('')
  let newCampusModality = $state('in_person')
  let newCampusCity = $state('')
  let newCampusState = $state('')
  let newCampusAddress = $state('')
  let newCampusZipcode = $state('')
  let newCampusCountry = $state('')
  let newCampusIsHQ = $state(false)
  let savingCampus = $state(false)
  let deletingCampusId = $state<string | null>(null)

  // Campus inline editing
  let editingCampusId = $state<string | null>(null)
  let editCampusName = $state('')
  let editCampusModality = $state('in_person')
  let editCampusAddress = $state('')
  let editCampusCity = $state('')
  let editCampusState = $state('')
  let editCampusZipcode = $state('')
  let editCampusCountry = $state('')
  let editCampusIsHQ = $state(false)
  let savingCampusEdit = $state(false)

  // Alias management
  let orgAliases = $state<{ id: string; alias: string }[]>([])
  let newAlias = $state('')
  let savingAlias = $state(false)

  // Enrichment data: alias counts and HQ locations per org
  let aliasCountMap = $state<Map<string, number>>(new Map())
  let hqLocationMap = $state<Map<string, string>>(new Map())

  // Grouping state — follows SourcesView education grouping pattern
  let groupBy = $state<'flat' | 'by_org_type' | 'by_tag'>('flat')
  let collapsedGroups = $state<Record<string, boolean>>({})

  function toggleGroup(group: string) {
    collapsedGroups[group] = !collapsedGroups[group]
  }

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

  let groupedOrgs = $derived.by(() => {
    if (groupBy === 'flat') return null
    const groups: Record<string, Organization[]> = {}

    for (const org of filteredOrgs) {
      let key: string
      if (groupBy === 'by_org_type') {
        key = org.org_type ?? 'other'
      } else {
        // by_tag: use first tag, or "No tags" if untagged
        key = (org.tags && org.tags.length > 0) ? org.tags[0] : 'No tags'
      }
      if (!groups[key]) groups[key] = []
      groups[key].push(org)
    }

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
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
      loadEnrichmentData(result.data)
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to load organizations'), type: 'error' })
    }
    loading = false
  }

  async function loadEnrichmentData(orgs: Organization[]) {
    const aliasMap = new Map<string, number>()
    const hqMap = new Map<string, string>()

    const promises = orgs.map(async (org) => {
      try {
        const [aliasRes, campusRes] = await Promise.all([
          fetch(`/api/organizations/${org.id}/aliases`),
          fetch(`/api/organizations/${org.id}/campuses`),
        ])
        if (aliasRes.ok) {
          const aliasBody = await aliasRes.json()
          const aliases = aliasBody.data ?? []
          if (aliases.length > 0) {
            aliasMap.set(org.id, aliases.length)
          }
        }
        if (campusRes.ok) {
          const campusBody = await campusRes.json()
          const campuses = campusBody.data ?? []
          const hq = campuses.find((c: OrgCampus) => c.is_headquarters)
          if (hq && (hq.city || hq.state)) {
            hqMap.set(org.id, [hq.city, hq.state].filter(Boolean).join(', '))
          }
        }
      } catch {
        // Silently skip enrichment failures
      }
    })

    await Promise.all(promises)
    aliasCountMap = aliasMap
    hqLocationMap = hqMap
  }

  function populateForm(org: Organization) {
    formName = org.name
    formOrgType = org.org_type
    formTags = [...(org.tags ?? [])]
    formIndustry = org.industry ?? ''
    formSize = org.size ?? ''
    formWorked = org.worked
    formEmploymentType = org.employment_type ?? ''
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
    orgCampuses = []
    orgAliases = []
    resetCampusForm()
    formName = ''
    formOrgType = 'company'
    formTags = ['company']
    formIndustry = ''
    formSize = ''
    formWorked = false
    formEmploymentType = ''
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
    resetCampusForm()
    loadCampuses(id)
    loadAliases(id)
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

  // ── Campus functions ──────────────────────────────────────────────

  async function loadCampuses(orgId: string) {
    const res = await fetch(`/api/organizations/${orgId}/campuses`)
    if (res.ok) {
      const body = await res.json()
      orgCampuses = body.data ?? []
    } else {
      orgCampuses = []
    }
  }

  function resetCampusForm() {
    newCampusName = ''
    newCampusModality = 'in_person'
    newCampusCity = ''
    newCampusState = ''
    newCampusAddress = ''
    newCampusZipcode = ''
    newCampusCountry = ''
    newCampusIsHQ = false
    showAddCampus = false
  }

  async function addCampus() {
    if (!newCampusName.trim() || !selectedId) return
    savingCampus = true
    const res = await fetch(`/api/organizations/${selectedId}/campuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newCampusName.trim(),
        modality: newCampusModality,
        city: newCampusCity.trim() || undefined,
        state: newCampusState.trim() || undefined,
        zipcode: newCampusZipcode.trim() || undefined,
        address: newCampusAddress.trim() || undefined,
        country: newCampusCountry.trim() || undefined,
        is_headquarters: newCampusIsHQ,
      }),
    })
    if (res.ok) {
      const body = await res.json()
      orgCampuses = [...orgCampuses, body.data]
      resetCampusForm()
      addToast({ message: `Campus "${body.data.name}" added.`, type: 'success' })
    } else {
      addToast({ message: 'Failed to create campus.', type: 'error' })
    }
    savingCampus = false
  }

  async function deleteCampus(campusId: string) {
    deletingCampusId = campusId
    const res = await fetch(`/api/campuses/${campusId}`, { method: 'DELETE' })
    if (res.ok) {
      orgCampuses = orgCampuses.filter(c => c.id !== campusId)
      addToast({ message: 'Campus deleted.', type: 'success' })
    } else {
      addToast({ message: 'Failed to delete campus.', type: 'error' })
    }
    deletingCampusId = null
  }

  function startEditCampus(campus: OrgCampus) {
    editingCampusId = campus.id
    editCampusName = campus.name
    editCampusModality = campus.modality
    editCampusAddress = campus.address ?? ''
    editCampusCity = campus.city ?? ''
    editCampusState = campus.state ?? ''
    editCampusZipcode = campus.zipcode ?? ''
    editCampusCountry = campus.country ?? ''
    editCampusIsHQ = !!campus.is_headquarters
  }

  function cancelEditCampus() {
    editingCampusId = null
  }

  async function saveEditCampus() {
    if (!editingCampusId || !editCampusName.trim()) return
    savingCampusEdit = true
    const res = await fetch(`/api/campuses/${editingCampusId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editCampusName.trim(),
        modality: editCampusModality,
        address: editCampusAddress.trim() || null,
        city: editCampusCity.trim() || null,
        state: editCampusState.trim() || null,
        zipcode: editCampusZipcode.trim() || null,
        country: editCampusCountry.trim() || null,
        is_headquarters: editCampusIsHQ,
      }),
    })
    if (res.ok) {
      const body = await res.json()
      orgCampuses = orgCampuses.map(c => c.id === editingCampusId ? body.data : c)
      editingCampusId = null
      addToast({ message: 'Campus updated.', type: 'success' })
    } else {
      addToast({ message: 'Failed to update campus.', type: 'error' })
    }
    savingCampusEdit = false
  }

  // ── Alias functions ───────────────────────────────────────────────

  async function loadAliases(orgId: string) {
    const res = await fetch(`/api/organizations/${orgId}/aliases`)
    if (res.ok) {
      const body = await res.json()
      orgAliases = body.data ?? []
    } else {
      orgAliases = []
    }
  }

  async function addAlias() {
    if (!newAlias.trim() || !selectedId) return
    savingAlias = true
    const res = await fetch(`/api/organizations/${selectedId}/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: newAlias.trim() }),
    })
    if (res.ok) {
      const body = await res.json()
      orgAliases = [...orgAliases, body.data]
      newAlias = ''
      addToast({ message: `Alias "${body.data.alias}" added.`, type: 'success' })
    } else {
      const body = await res.json().catch(() => ({}))
      addToast({ message: body.error?.message ?? 'Failed to add alias.', type: 'error' })
    }
    savingAlias = false
  }

  async function deleteAlias(aliasId: string) {
    const res = await fetch(`/api/aliases/${aliasId}`, { method: 'DELETE' })
    if (res.ok) {
      orgAliases = orgAliases.filter(a => a.id !== aliasId)
      addToast({ message: 'Alias removed.', type: 'success' })
    } else {
      addToast({ message: 'Failed to remove alias.', type: 'error' })
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

    <div class="group-bar">
      <label for="org-group-by">Group by:</label>
      <select id="org-group-by" bind:value={groupBy}>
        <option value="flat">None</option>
        <option value="by_org_type">Type</option>
        <option value="by_tag">Tag</option>
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
    {:else if groupBy !== 'flat' && groupedOrgs}
      {#each groupedOrgs as [groupName, groupOrgs]}
        <div class="group-section">
          <button class="group-header" onclick={() => toggleGroup(groupName)}>
            <span class="group-chevron" class:collapsed={collapsedGroups[groupName]}>&#9656;</span>
            <span class="group-label">{groupName.replace(/_/g, ' ')}</span>
            <span class="group-count">{groupOrgs.length}</span>
          </button>
          {#if !collapsedGroups[groupName]}
            <ul class="org-list">
              {#each groupOrgs as org (org.id)}
                <li>
                  <button
                    class="org-card"
                    class:selected={selectedId === org.id}
                    onclick={() => selectOrg(org.id)}
                  >
                    <div class="card-top">
                      <span class="card-title">{org.name}</span>
                      {#if aliasCountMap.get(org.id)}
                        <span class="alias-count">({aliasCountMap.get(org.id)})</span>
                      {/if}
                      {#if org.worked}
                        <span class="worked-badge">Worked</span>
                      {/if}
                    </div>
                    <div class="card-tags">
                      {#each (org.tags ?? []) as tag}
                        <span class="tag-pill">{tag}</span>
                      {/each}
                    </div>
                    {#if org.industry || hqLocationMap.get(org.id)}
                      <div class="card-meta">
                        {#if org.industry}<span class="meta-item">{org.industry}</span>{/if}
                        {#if hqLocationMap.get(org.id)}<span class="meta-item">{hqLocationMap.get(org.id)}</span>{/if}
                      </div>
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
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
                {#if aliasCountMap.get(org.id)}
                  <span class="alias-count">({aliasCountMap.get(org.id)})</span>
                {/if}
                {#if org.worked}
                  <span class="worked-badge">Worked</span>
                {/if}
              </div>
              <div class="card-tags">
                {#each (org.tags ?? []) as tag}
                  <span class="tag-pill">{tag}</span>
                {/each}
              </div>
              {#if org.industry || hqLocationMap.get(org.id)}
                <div class="card-meta">
                  {#if org.industry}<span class="meta-item">{org.industry}</span>{/if}
                  {#if hqLocationMap.get(org.id)}<span class="meta-item">{hqLocationMap.get(org.id)}</span>{/if}
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
          {#if formOrgType !== 'education'}
            <div class="form-group">
              <label for="org-industry">Industry</label>
              <input id="org-industry" type="text" bind:value={formIndustry} placeholder="e.g. AI Safety" />
            </div>
          {:else}
            <div class="form-group"><!-- spacer --></div>
          {/if}
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

        <!-- Location and Headquarters are now managed via Campuses section below -->

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

        <!-- Campuses section (only for existing orgs, not during create) -->
        {#if !editing && selectedOrg}
          <div class="campuses-section">
            <div class="section-header">
              <h4>Campuses / Locations</h4>
              <button class="btn-new-sm" onclick={() => showAddCampus = !showAddCampus}>
                {showAddCampus ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {#if showAddCampus}
              <div class="campus-add-form">
                <div class="form-group">
                  <label for="campus-name">Name *</label>
                  <input id="campus-name" type="text" bind:value={newCampusName} placeholder="e.g. Main Campus, Online" />
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="campus-modality">Modality</label>
                    <select id="campus-modality" bind:value={newCampusModality}>
                      <option value="in_person">In Person</option>
                      <option value="remote">Remote / Online</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="campus-address">Address</label>
                    <input id="campus-address" type="text" bind:value={newCampusAddress} placeholder="e.g. 123 Main St" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="campus-city">City</label>
                    <input id="campus-city" type="text" bind:value={newCampusCity} />
                  </div>
                  <div class="form-group">
                    <label for="campus-state">State</label>
                    <input id="campus-state" type="text" bind:value={newCampusState} placeholder="e.g. VA" />
                  </div>
                  <div class="form-group">
                    <label for="campus-zip">Zip</label>
                    <input id="campus-zip" type="text" bind:value={newCampusZipcode} placeholder="e.g. 20148" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="campus-country">Country</label>
                    <input id="campus-country" type="text" bind:value={newCampusCountry} placeholder="e.g. US" />
                  </div>
                  <div class="form-group checkbox-group">
                    <label>
                      <input type="checkbox" bind:checked={newCampusIsHQ} /> Headquarters
                    </label>
                  </div>
                </div>
                <button class="btn btn-save btn-sm" onclick={addCampus} disabled={savingCampus || !newCampusName.trim()}>
                  {savingCampus ? 'Adding...' : 'Add Campus'}
                </button>
              </div>
            {/if}

            {#if orgCampuses.length === 0 && !showAddCampus}
              <p class="campus-empty">No campuses defined. Click + Add to create one.</p>
            {:else}
              <ul class="campus-list">
                {#each orgCampuses as campus (campus.id)}
                  {#if editingCampusId === campus.id}
                    <li class="campus-item campus-editing">
                      <div class="campus-edit-form">
                        <div class="form-row">
                          <div class="form-group">
                            <label for="edit-campus-name">Name *</label>
                            <input id="edit-campus-name" type="text" bind:value={editCampusName} />
                          </div>
                          <div class="form-group">
                            <label for="edit-campus-modality">Modality</label>
                            <select id="edit-campus-modality" bind:value={editCampusModality}>
                              <option value="in_person">In Person</option>
                              <option value="remote">Remote / Online</option>
                              <option value="hybrid">Hybrid</option>
                            </select>
                          </div>
                        </div>
                        <div class="form-row">
                          <div class="form-group">
                            <label for="edit-campus-address">Address</label>
                            <input id="edit-campus-address" type="text" bind:value={editCampusAddress} />
                          </div>
                        </div>
                        <div class="form-row">
                          <div class="form-group">
                            <label for="edit-campus-city">City</label>
                            <input id="edit-campus-city" type="text" bind:value={editCampusCity} />
                          </div>
                          <div class="form-group">
                            <label for="edit-campus-state">State</label>
                            <input id="edit-campus-state" type="text" bind:value={editCampusState} />
                          </div>
                          <div class="form-group">
                            <label for="edit-campus-zip">Zip</label>
                            <input id="edit-campus-zip" type="text" bind:value={editCampusZipcode} />
                          </div>
                        </div>
                        <div class="form-row">
                          <div class="form-group">
                            <label for="edit-campus-country">Country</label>
                            <input id="edit-campus-country" type="text" bind:value={editCampusCountry} />
                          </div>
                          <div class="form-group checkbox-group">
                            <label>
                              <input type="checkbox" bind:checked={editCampusIsHQ} /> Headquarters
                            </label>
                          </div>
                        </div>
                        <div class="campus-edit-actions">
                          <button class="btn btn-save btn-sm" onclick={saveEditCampus} disabled={savingCampusEdit || !editCampusName.trim()}>
                            {savingCampusEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button class="btn btn-cancel btn-sm" onclick={cancelEditCampus} disabled={savingCampusEdit}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </li>
                  {:else}
                    <li class="campus-item">
                      <div class="campus-info" role="button" tabindex="0"
                        onclick={() => startEditCampus(campus)}
                        onkeydown={(e) => { if (e.key === 'Enter') startEditCampus(campus) }}
                        title="Click to edit"
                      >
                        <span class="campus-name">{campus.name}</span>
                        {#if campus.is_headquarters}
                          <span class="campus-hq-badge">HQ</span>
                        {/if}
                        <span class="campus-modality">{MODALITY_LABELS[campus.modality] ?? campus.modality}</span>
                        {#if campus.city || campus.state || campus.zipcode}
                          <span class="campus-location">
                            {[campus.city, campus.state, campus.zipcode].filter(Boolean).join(', ')}
                          </span>
                        {/if}
                        {#if campus.address}
                          <span class="campus-address">{campus.address}</span>
                        {/if}
                      </div>
                      <button
                        class="btn-delete-sm"
                        onclick={() => deleteCampus(campus.id)}
                        disabled={deletingCampusId === campus.id}
                        title="Delete campus"
                      >
                        {deletingCampusId === campus.id ? '...' : '×'}
                      </button>
                    </li>
                  {/if}
                {/each}
              </ul>
            {/if}
          </div>
        {/if}

        <!-- Aliases section (only for existing orgs) -->
        {#if !editing && selectedOrg}
          <div class="campuses-section">
            <div class="section-header">
              <h4>Aliases</h4>
            </div>
            <div class="alias-add-row">
              <input
                type="text"
                bind:value={newAlias}
                placeholder="e.g. WGU, USAF"
                onkeydown={(e) => { if (e.key === 'Enter') addAlias() }}
              />
              <button class="btn-new-sm" onclick={addAlias} disabled={savingAlias || !newAlias.trim()}>
                {savingAlias ? '...' : '+'}
              </button>
            </div>
            {#if orgAliases.length > 0}
              <div class="alias-pills">
                {#each orgAliases as a (a.id)}
                  <span class="alias-pill">
                    {a.alias}
                    <button class="alias-remove" onclick={() => deleteAlias(a.id)} title="Remove">×</button>
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

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
  .list-panel { width: 340px; flex-shrink: 0; border-right: 1px solid var(--color-border); background: var(--color-surface); display: flex; flex-direction: column; overflow: hidden; }
  .list-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1rem; border-bottom: 1px solid var(--color-border); }
  .list-header h2 { font-size: var(--text-xl); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0; }
  .btn-new { padding: 0.35rem 0.75rem; background: var(--color-primary); color: var(--text-inverse); border: none; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--font-medium); cursor: pointer; }
  .btn-new:hover { background: var(--color-primary-hover); }

  .filter-bar { display: flex; gap: 0.5rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); }
  .search-input { flex: 1; padding: 0.35rem 0.5rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); font-size: var(--text-sm); }
  .search-input:focus { outline: none; border-color: var(--color-border-focus); }
  .filter-select { padding: 0.35rem 0.5rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); font-size: var(--text-sm); }
  .filter-select:focus { outline: none; border-color: var(--color-border-focus); }

  .list-loading { display: flex; justify-content: center; padding: 3rem 1rem; }
  .org-list { list-style: none; overflow-y: auto; flex: 1; padding: var(--space-2) 0; margin: 0; }
  .org-list li { padding: 0 var(--space-3); margin-bottom: var(--space-1); }

  .org-card { display: block; width: 100%; padding: 0.75rem 1rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; text-align: left; transition: background 0.12s; }
  .org-card:hover { background: var(--color-surface-raised); }
  .org-card.selected { background: var(--color-primary-subtle); border-left: 3px solid var(--color-primary); padding-left: calc(1rem - 3px); }

  .card-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
  .card-title { font-size: var(--text-base); font-weight: var(--font-medium); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .worked-badge { display: inline-block; padding: 0.1em 0.4em; background: var(--color-success-subtle); color: var(--color-success-text); border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: var(--font-semibold); flex-shrink: 0; }
  .alias-count { font-size: var(--text-xs); color: var(--text-faint); font-weight: var(--font-normal); flex-shrink: 0; }

  .card-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.2rem; }
  .tag-pill { display: inline-block; padding: 0.1em 0.4em; background: var(--color-tag-bg); color: var(--color-tag-text); border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: var(--font-medium); text-transform: capitalize; }

  .card-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .meta-item { font-size: var(--text-xs); color: var(--text-muted); }

  /* Editor */
  .editor-panel { flex: 1; overflow-y: auto; background: var(--color-surface); }
  .editor-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-faint); font-size: var(--text-base); }
  .editor-content { max-width: 640px; padding: 2rem; }
  .editor-heading { font-size: var(--text-xl); font-weight: var(--font-semibold); color: var(--text-primary); margin-bottom: 1.5rem; }

  .form-group { margin-bottom: 1.25rem; }
  .form-group label { display: block; font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-secondary); margin-bottom: 0.35rem; }
  .checkbox-group label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
  .required { color: var(--color-danger); }

  .form-group input[type='text'],
  .form-group input[type='url'],
  .form-group input[type='number'],
  .form-group textarea,
  .form-group select { width: 100%; padding: 0.5rem 0.65rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); font-size: var(--text-base); color: var(--text-primary); background: var(--color-surface); font-family: inherit; }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus { outline: none; border-color: var(--color-border-focus); box-shadow: 0 0 0 2px var(--color-primary-subtle); }

  .form-group textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
  .form-row { display: flex; gap: 1rem; }
  .form-row .form-group { flex: 1; }

  .tag-grid { display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; }
  .tag-check { display: flex; align-items: center; gap: 0.25rem; font-size: var(--text-sm); color: var(--text-secondary); cursor: pointer; }
  .tag-check input[type='checkbox'] { margin: 0; }

  .editor-actions { display: flex; align-items: center; gap: 0.75rem; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border); }
  .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.1rem; border: none; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--font-medium); cursor: pointer; }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-save { background: var(--color-primary); color: var(--text-inverse); }
  .btn-save:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-sm { padding: 0.35rem 0.8rem; font-size: var(--text-sm); }

  /* Campuses */
  .campuses-section { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border); }
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
  .section-header h4 { margin: 0; font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-secondary); }
  .btn-new-sm { padding: 0.25rem 0.6rem; background: var(--color-primary); color: var(--text-inverse); border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); font-weight: var(--font-medium); }
  .btn-new-sm:hover { background: var(--color-primary-hover); }
  .campus-add-form { background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 0.75rem; }
  .campus-empty { font-size: var(--text-sm); color: var(--text-faint); font-style: italic; margin: 0; }
  .campus-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  .campus-item { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
  .campus-info { display: flex; flex-wrap: wrap; gap: 0.3rem 0.75rem; align-items: center; flex: 1; min-width: 0; }
  .campus-name { font-weight: var(--font-medium); font-size: var(--text-sm); color: var(--text-primary); }
  .campus-modality { font-size: var(--text-xs); padding: 0.1rem 0.4rem; border-radius: var(--radius-sm); background: var(--color-tag-bg); color: var(--color-tag-text); }
  .campus-location { font-size: var(--text-sm); color: var(--text-muted); }
  .campus-address { font-size: var(--text-xs); color: var(--text-faint); }
  .btn-delete-sm { background: none; border: none; color: var(--color-border-strong); cursor: pointer; font-size: var(--text-xl); padding: 0.2rem 0.4rem; border-radius: var(--radius-sm); line-height: 1; }
  .campus-hq-badge { font-size: var(--text-xs); padding: 0.1rem 0.35rem; border-radius: var(--radius-sm); background: var(--color-warning-bg); color: var(--color-warning-text); font-weight: var(--font-semibold); }
  .alias-add-row { display: flex; gap: 0.4rem; margin-bottom: 0.5rem; }
  .alias-add-row input { flex: 1; padding: 0.35rem 0.5rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); font-size: var(--text-sm); }
  .alias-add-row input:focus { outline: none; border-color: var(--color-border-focus); }
  .alias-pills { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .alias-pill { display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.15rem 0.5rem; background: var(--color-tag-bg); color: var(--color-tag-text); border-radius: var(--radius-full); font-size: var(--text-sm); font-weight: var(--font-medium); }
  .alias-remove { background: none; border: none; color: var(--color-primary); cursor: pointer; font-size: var(--text-sm); padding: 0; line-height: 1; }
  .alias-remove:hover { color: var(--color-danger); }
  .btn-delete-sm:hover { color: var(--color-danger); background: var(--color-danger-subtle); }

  .campus-edit-form label { display: block; font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 0.15rem; }
  .campus-edit-form input, .campus-edit-form select { width: 100%; padding: 0.3rem 0.5rem; font-size: var(--text-sm); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); }
  .btn-delete { background: var(--color-danger-subtle); color: var(--color-danger-text); margin-left: auto; }
  .btn-delete:hover { background: var(--color-danger-subtle); }
  .campus-editing { padding: 0.75rem; }
  .campus-edit-form { width: 100%; }
  .campus-edit-form .form-row { display: flex; gap: 0.5rem; margin-bottom: 0.4rem; }
  .campus-edit-form .form-group { flex: 1; min-width: 0; }
  .campus-edit-actions { display: flex; gap: 0.4rem; margin-top: 0.4rem; }
  .campus-info[role="button"] { cursor: pointer; }
  .campus-info[role="button"]:hover { opacity: 0.8; }
  .btn-cancel { background: var(--color-ghost); color: var(--text-secondary); border: 1px solid var(--color-border-strong); }
  .btn-cancel:hover:not(:disabled) { background: var(--color-ghost-hover); }

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
</style>
