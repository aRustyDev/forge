<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { StatusBadge, LoadingSpinner, EmptyState, ConfirmDialog } from '$lib/components'
  import OrgCombobox from '$lib/components/OrgCombobox.svelte'
  import type { Source, Organization, ClearanceLevel, ClearancePolygraph, ClearanceStatus, ClearanceType, ClearanceAccessProgram } from '@forge/sdk'
  import {
    CLEARANCE_LEVELS,
    CLEARANCE_POLYGRAPHS,
    CLEARANCE_STATUSES,
    CLEARANCE_TYPES,
    CLEARANCE_ACCESS_PROGRAMS,
    CLEARANCE_LEVEL_LABELS,
    CLEARANCE_POLYGRAPH_LABELS,
    CLEARANCE_ACCESS_PROGRAM_LABELS,
  } from '@forge/sdk'

  const SOURCE_TABS = [
    { value: 'all', label: 'All' },
    { value: 'role', label: 'Roles' },
    { value: 'project', label: 'Projects' },
    { value: 'education', label: 'Education' },
    { value: 'clearance', label: 'Clearances' },
    { value: 'general', label: 'General' },
  ]

  let sources = $state<Source[]>([])
  let organizations = $state<Organization[]>([])
  let activeTab = $state('all')
  let selectedId = $state<string | null>(null)
  let loading = $state(true)
  let editing = $state(false)
  let saving = $state(false)
  let deriving = $state(false)
  let confirmDeleteOpen = $state(false)

  // Base form fields
  let formTitle = $state('')
  let formDescription = $state('')
  let formSourceType = $state<string>('general')
  let formNotes = $state('')

  // Role extension fields
  let formOrgId = $state<string | null>(null)
  let formStartDate = $state('')
  let formEndDate = $state('')
  let formIsCurrent = $state(false)
  let formWorkArrangement = $state('')
  let formBaseSalary = $state<number | null>(null)
  let formTotalCompNotes = $state('')

  // Education extension fields
  let formEducationType = $state('certificate')
  let formEduOrgId = $state<string | null>(null)
  let formField = $state('')
  let formIsInProgress = $state(false)
  let formCredentialId = $state('')
  let formExpirationDate = $state('')
  let formUrl = $state('')

  // Quick-create org modal
  let showOrgModal = $state(false)
  let newOrgName = $state('')
  let newOrgType = $state('education')
  let newOrgWebsite = $state('')
  let creatingOrg = $state(false)

  // Education sub-type fields
  let formDegreeLevel = $state<string>('bachelors')
  let formDegreeType = $state('')
  let formCertificateSubtype = $state<string>('vendor')
  let formGpa = $state('')
  let formLocation = $state('')
  let formEduDescription = $state('')

  // Project extension fields
  let formIsPersonal = $state(false)
  let formProjectUrl = $state('')

  // Clearance extension fields
  let formLevel = $state<ClearanceLevel>('secret')
  let formPolygraph = $state<ClearancePolygraph | ''>('')
  let formClearanceStatus = $state<ClearanceStatus>('active')
  let formClearanceType = $state<ClearanceType>('personnel')
  let formSponsorOrgId = $state('')
  let formContinuousInvestigation = $state(false)
  let formAccessPrograms = $state<ClearanceAccessProgram[]>([])

  // Education grouping
  type GroupMode = 'flat' | 'by_type' | 'by_cert' | 'by_issuer'
  const GROUP_OPTIONS: { value: GroupMode; label: string }[] = [
    { value: 'flat', label: 'Flat' },
    { value: 'by_type', label: 'By Type' },
    { value: 'by_cert', label: 'By Cert Type' },
    { value: 'by_issuer', label: 'By Issuer' },
  ]
  let eduGroupBy = $state<GroupMode>('by_type')
  let collapsedGroups = $state<Record<string, boolean>>({})

  function toggleGroupCollapse(key: string) {
    collapsedGroups[key] = !collapsedGroups[key]
  }

  const EDU_TYPE_LABELS: Record<string, string> = {
    degree: 'Degrees',
    certificate: 'Certificates',
    course: 'Courses',
    self_taught: 'Self-Taught',
  }

  const CERT_SUBTYPE_LABELS: Record<string, string> = {
    professional: 'Professional',
    vendor: 'Vendor',
    completion: 'Completion',
    unknown: 'Other',
  }

  let filteredSources = $derived(
    activeTab === 'all'
      ? sources
      : sources.filter(s => s.source_type === activeTab)
  )

  /** Group education sources into labeled sections */
  let groupedEducation = $derived.by(() => {
    if (activeTab !== 'education' || eduGroupBy === 'flat') return null
    const eduSources = sources.filter(s => s.source_type === 'education')
    const groups = new Map<string, { label: string; sources: Source[] }>()

    for (const s of eduSources) {
      let key: string
      let label: string

      if (eduGroupBy === 'by_type') {
        key = s.education?.education_type ?? 'unknown'
        label = EDU_TYPE_LABELS[key] ?? key
      } else if (eduGroupBy === 'by_cert') {
        if (s.education?.education_type !== 'certificate') {
          key = '_non_cert'
          label = 'Non-Certificates'
        } else {
          key = s.education?.certificate_subtype ?? 'unknown'
          label = CERT_SUBTYPE_LABELS[key] ?? key
        }
      } else {
        // by_issuer — group by organization
        const orgId = s.education?.organization_id
        if (orgId) {
          key = orgId
          label = getOrgName(orgId)
        } else {
          key = '_unknown'
          label = 'No Organization'
        }
      }

      if (!groups.has(key)) {
        groups.set(key, { label, sources: [] })
      }
      groups.get(key)!.sources.push(s)
    }

    // Sort groups: for by_type use a fixed order, otherwise alphabetical
    const entries = [...groups.entries()]
    if (eduGroupBy === 'by_type') {
      const order = ['degree', 'certificate', 'course', 'self_taught']
      entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    } else {
      entries.sort((a, b) => a[1].label.localeCompare(b[1].label))
    }

    return entries.map(([key, group]) => ({ key, ...group }))
  })

  let selectedSource = $derived(sources.find(s => s.id === selectedId) ?? null)

  $effect(() => {
    loadSources()
    loadOrganizations()
  })

  $effect(() => {
    if (selectedSource && !editing) {
      populateFormFromSource(selectedSource)
    }
  })

  $effect(() => {
    if (formIsPersonal) {
      formOrgId = null
    }
  })

  // Education type change handler — resets irrelevant sub-fields when user
  // switches education type via the dropdown. NOT an $effect (which would
  // fire during populateFormFromSource and clobber loaded values).
  function handleEducationTypeChange(newType: string) {
    formEducationType = newType
    if (newType !== 'degree') {
      formDegreeLevel = ''
      formDegreeType = ''
      formGpa = ''
    }
    if (newType !== 'certificate') {
      formCertificateSubtype = 'vendor'
    }
    if (newType !== 'degree' && newType !== 'course') {
      formLocation = ''
    }
    // Reset org selection when type changes (different org filter per type)
    formEduOrgId = null
  }

  async function loadSources() {
    loading = true
    const result = await forge.sources.list({ limit: 500 })
    if (result.ok) {
      sources = result.data
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to load sources'), type: 'error' })
    }
    loading = false
  }

  async function loadOrganizations() {
    const orgResult = await forge.organizations.list({ limit: 500 })
    if (orgResult.ok) {
      // Filter to orgs that have at least one role source
      const sourceResult = await forge.sources.list({ source_type: 'role', limit: 500 })
      if (sourceResult.ok) {
        const workedOrgIds = new Set(
          sourceResult.data
            .map(s => s.role?.organization_id)
            .filter((id): id is string => id != null)
        )
        organizations = orgResult.data.filter(o => workedOrgIds.has(o.id))
      } else {
        organizations = orgResult.data
      }
    }
  }

  function getOrgName(id: string): string {
    return organizations.find(o => o.id === id)?.name ?? 'Unknown'
  }

  function populateFormFromSource(source: Source) {
    formTitle = source.title
    formDescription = source.description
    formSourceType = source.source_type
    formNotes = source.notes ?? ''
    // Reset all extension fields
    formOrgId = null
    formStartDate = ''
    formEndDate = ''
    formIsCurrent = false
    formWorkArrangement = ''
    formBaseSalary = null
    formTotalCompNotes = ''
    formEducationType = 'certificate'
    formEduOrgId = null
    formField = ''
    formIsInProgress = false
    formCredentialId = ''
    formExpirationDate = ''
    // formIssuingBody removed — use formEduOrgId
    formUrl = ''
    formDegreeLevel = ''
    formDegreeType = ''
    formCertificateSubtype = 'vendor'
    formGpa = ''
    formLocation = ''
    formEduDescription = ''
    formIsPersonal = false
    formProjectUrl = ''
    formLevel = 'secret'
    formPolygraph = ''
    formClearanceStatus = 'active'
    formClearanceType = 'personnel'
    formSponsorOrgId = ''
    formContinuousInvestigation = false
    formAccessPrograms = []

    if (source.source_type === 'role' && source.role) {
      formOrgId = source.role.organization_id ?? null
      formStartDate = source.role.start_date ?? ''
      formEndDate = source.role.end_date ?? ''
      formIsCurrent = !!source.role.is_current
      formWorkArrangement = source.role.work_arrangement ?? ''
      formBaseSalary = source.role.base_salary ?? null
      formTotalCompNotes = source.role.total_comp_notes ?? ''
    } else if (source.source_type === 'education' && source.education) {
      formEducationType = source.education.education_type
      formEduOrgId = source.education.organization_id ?? null
      formField = source.education.field ?? ''
      formStartDate = source.education.start_date ?? ''
      formEndDate = source.education.end_date ?? ''
      formIsInProgress = !!source.education.is_in_progress
      formCredentialId = source.education.credential_id ?? ''
      formExpirationDate = source.education.expiration_date ?? ''
      // issuing_body now comes from organization_id
      formUrl = source.education.url ?? ''
      formDegreeLevel = source.education.degree_level ?? ''
      formDegreeType = source.education.degree_type ?? ''
      formCertificateSubtype = source.education.certificate_subtype ?? 'vendor'
      formGpa = source.education.gpa ?? ''
      formLocation = source.education.location ?? ''
      formEduDescription = source.education.edu_description ?? ''
    } else if (source.source_type === 'project' && source.project) {
      formOrgId = source.project.organization_id ?? null
      formIsPersonal = !!source.project.is_personal
      formProjectUrl = source.project.url ?? ''
      formStartDate = source.project.start_date ?? ''
      formEndDate = source.project.end_date ?? ''
    } else if (source.source_type === 'clearance' && source.clearance) {
      formLevel = source.clearance.level
      formPolygraph = source.clearance.polygraph ?? ''
      formClearanceStatus = source.clearance.status
      formClearanceType = source.clearance.type
      formSponsorOrgId = source.clearance.sponsor_organization_id ?? ''
      formContinuousInvestigation = !!source.clearance.continuous_investigation
      formAccessPrograms = source.clearance.access_programs ?? []
    }
  }

  function startNew() {
    selectedId = null
    editing = true
    formTitle = ''
    formDescription = ''
    formSourceType = 'general'
    formNotes = ''
    formOrgId = null
    formStartDate = ''
    formEndDate = ''
    formIsCurrent = false
    formWorkArrangement = ''
    formBaseSalary = null
    formTotalCompNotes = ''
    formEducationType = 'certificate'
    formEduOrgId = null
    formField = ''
    formIsInProgress = false
    formCredentialId = ''
    formExpirationDate = ''
    // formIssuingBody removed — use formEduOrgId
    formUrl = ''
    formDegreeLevel = ''
    formDegreeType = ''
    formCertificateSubtype = 'vendor'
    formGpa = ''
    formLocation = ''
    formEduDescription = ''
    formIsPersonal = false
    formProjectUrl = ''
    formLevel = 'secret'
    formPolygraph = ''
    formClearanceStatus = 'active'
    formClearanceType = 'personnel'
    formSponsorOrgId = ''
    formContinuousInvestigation = false
    formAccessPrograms = []
  }

  async function selectSource(id: string) {
    editing = false
    selectedId = id
    // Fetch full source with extension data (list endpoint doesn't include extensions)
    const result = await forge.sources.get(id)
    if (result.ok) {
      // Replace the list entry with the full source (includes education/role/project/clearance)
      sources = sources.map(s => s.id === id ? result.data : s)
    }
  }

  async function saveSource() {
    if (!formTitle.trim() || !formDescription.trim()) {
      addToast({ message: 'Title and description are required.', type: 'error' })
      return
    }

    saving = true
    const basePayload: Record<string, unknown> = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      notes: formNotes || undefined,
    }

    // Build extension payload based on source_type
    if (formSourceType === 'role') {
      basePayload.role = {
        organization_id: formOrgId,
        start_date: formStartDate || undefined,
        end_date: formEndDate || undefined,
        is_current: formIsCurrent,
        work_arrangement: formWorkArrangement || undefined,
        base_salary: formBaseSalary,
        total_comp_notes: formTotalCompNotes || undefined,
      }
    } else if (formSourceType === 'education') {
      basePayload.education = {
        education_type: formEducationType,
        education_organization_id: formEduOrgId || undefined,
        field: formField || undefined,
        start_date: formStartDate || undefined,
        end_date: formEndDate || undefined,
        is_in_progress: formIsInProgress,
        credential_id: formCredentialId || undefined,
        expiration_date: formExpirationDate || undefined,
        // issuing_body replaced by education_organization_id
        url: formUrl || undefined,
        degree_level: formDegreeLevel || undefined,
        degree_type: formDegreeType || undefined,
        certificate_subtype: formCertificateSubtype || undefined,
        gpa: formGpa || undefined,
        location: formLocation || undefined,
        edu_description: formEduDescription || undefined,
      }
    } else if (formSourceType === 'project') {
      basePayload.project = {
        organization_id: formOrgId,
        is_personal: formIsPersonal,
        url: formProjectUrl || undefined,
        start_date: formStartDate || undefined,
        end_date: formEndDate || undefined,
      }
    } else if (formSourceType === 'clearance') {
      basePayload.clearance = {
        level: formLevel,
        polygraph: formPolygraph || undefined,
        status: formClearanceStatus,
        type: formClearanceType,
        sponsor_organization_id: formSponsorOrgId || undefined,
        continuous_investigation: formContinuousInvestigation ? 1 : 0,
        access_programs: formAccessPrograms,
      }
    }

    if (editing) {
      const result = await forge.sources.create({
        ...basePayload,
        source_type: formSourceType as any,
      } as any)
      if (result.ok) {
        sources = [...sources, result.data]
        selectedId = result.data.id
        editing = false
        addToast({ message: 'Source created.', type: 'success' })
      } else {
        addToast({ message: friendlyError(result.error, 'Failed to create source'), type: 'error' })
      }
    } else if (selectedId) {
      const result = await forge.sources.update(selectedId, basePayload as any)
      if (result.ok) {
        sources = sources.map(s => s.id === selectedId ? result.data : s)
        addToast({ message: 'Source updated.', type: 'success' })
      } else {
        addToast({ message: friendlyError(result.error, 'Failed to update source'), type: 'error' })
      }
    }
    saving = false
  }

  async function deleteSource() {
    if (!selectedId) return
    confirmDeleteOpen = false

    const id = selectedId
    const result = await forge.sources.delete(id)
    if (result.ok) {
      sources = sources.filter(s => s.id !== id)
      selectedId = null
      editing = false
      addToast({ message: 'Source deleted.', type: 'success' })
    } else {
      addToast({ message: `Failed to delete source: ${result.error.message}`, type: 'error' })
    }
  }

  async function deriveBullets() {
    if (!selectedId) return
    deriving = true

    const result = await forge.sources.deriveBullets(selectedId)
    if (result.ok) {
      const count = result.data.length
      addToast({ message: `Derived ${count} bullet${count === 1 ? '' : 's'} from source.`, type: 'success' })
      await loadSources()
    } else {
      addToast({ message: `Derivation failed: ${result.error.message}`, type: 'error' })
    }

    deriving = false
  }

  /** Filter orgs by relevant tags for the current education type + cert subtype. */
  let eduFilteredOrgs = $derived.by(() => {
    if (formEducationType === 'degree') {
      return organizations.filter(o => o.tags?.some(t => t === 'university' || t === 'school'))
    }
    if (formEducationType === 'certificate') {
      if (formCertificateSubtype === 'vendor') {
        return organizations.filter(o => o.tags?.some(t => t === 'vendor' || t === 'company'))
      }
      if (formCertificateSubtype === 'professional') {
        return organizations.filter(o => o.tags?.some(t => t === 'nonprofit' || t === 'government' || t === 'company'))
      }
      if (formCertificateSubtype === 'completion') {
        return organizations.filter(o => o.tags?.some(t => t === 'platform' || t === 'company' || t === 'university'))
      }
      return organizations
    }
    if (formEducationType === 'course') {
      return organizations.filter(o => o.tags?.some(t => t === 'university' || t === 'platform' || t === 'conference' || t === 'company'))
    }
    // self_taught — show all
    return organizations
  })

  // Infer default tags for new org based on education context
  let newOrgTags = $state<string[]>([])

  function openOrgModal() {
    newOrgName = ''
    newOrgWebsite = ''
    // Infer org_type and tags from education context
    if (formEducationType === 'degree') {
      newOrgType = 'education'
      newOrgTags = ['university']
    } else if (formEducationType === 'course') {
      newOrgType = 'education'
      newOrgTags = ['platform']
    } else if (formEducationType === 'certificate') {
      newOrgType = 'company'
      if (formCertificateSubtype === 'vendor') newOrgTags = ['company', 'vendor']
      else if (formCertificateSubtype === 'professional') newOrgTags = ['company']
      else newOrgTags = ['company', 'platform']
    } else {
      newOrgType = 'company'
      newOrgTags = ['company']
    }
    showOrgModal = true
  }

  async function createOrgAndSelect() {
    if (!newOrgName.trim()) return
    creatingOrg = true
    const result = await forge.organizations.create({
      name: newOrgName.trim(),
      org_type: newOrgType,
      website: newOrgWebsite.trim() || undefined,
      tags: newOrgTags,
    } as any)
    if (result.ok) {
      organizations = [...organizations, result.data]
      formEduOrgId = result.data.id
      showOrgModal = false
      addToast({ message: `Organization "${result.data.name}" created.`, type: 'success' })
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to create organization'), type: 'error' })
    }
    creatingOrg = false
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
</script>

{#snippet sourceCard(source: Source)}
  <button
    class="source-card"
    class:selected={selectedId === source.id}
    onclick={() => selectSource(source.id)}
  >
    <div class="card-top">
      <span class="card-title">{source.title}</span>
      <StatusBadge status={source.status} />
    </div>
    <div class="card-meta">
      <span class="type-badge type-{source.source_type}">{source.source_type}</span>
      {#if source.source_type === 'project' && source.project?.is_personal}
        <span class="personal-badge">Personal</span>
      {/if}
      {#if source.source_type === 'role' && source.role?.organization_id}
        <span class="card-org">{getOrgName(source.role.organization_id)}</span>
      {/if}
      {#if source.source_type === 'project' && !source.project?.is_personal && source.project?.organization_id}
        <span class="card-org">{getOrgName(source.project.organization_id)}</span>
      {/if}
      {#if source.source_type === 'education' && source.education?.organization_id}
        <span class="card-org">{getOrgName(source.education.organization_id)}</span>
      {:else if source.source_type === 'education' && source.education?.institution}
        <span class="card-org">{source.education.institution}</span>
      {/if}
      {#if source.source_type === 'education' && source.education?.education_type}
        <span class="edu-type-badge">{source.education.education_type}</span>
      {/if}
    </div>
    <span class="card-date">{formatDate(source.updated_at)}</span>
  </button>
{/snippet}

<div class="sources-page">
  <!-- Left panel: Source list -->
  <div class="list-panel">
    <div class="list-header">
      <h2>Sources</h2>
      <button class="btn-new" onclick={startNew}>+ New Source</button>
    </div>

    <div class="filter-tabs">
      {#each SOURCE_TABS as tab}
        <button
          class="filter-tab"
          class:active={activeTab === tab.value}
          onclick={() => activeTab = tab.value}
        >
          {tab.label}
          <span class="tab-count">
            {tab.value === 'all'
              ? sources.length
              : sources.filter(s => s.source_type === tab.value).length}
          </span>
        </button>
      {/each}
    </div>

    {#if activeTab === 'education'}
      <div class="group-bar">
        <label for="edu-group">Group:</label>
        <select id="edu-group" bind:value={eduGroupBy}>
          {#each GROUP_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if loading}
      <div class="list-loading">
        <LoadingSpinner size="md" message="Loading sources..." />
      </div>
    {:else if filteredSources.length === 0}
      <EmptyState
        title="No sources found"
        description={activeTab === 'all'
          ? 'Create your first source to get started.'
          : `No ${activeTab} sources found.`}
        action={activeTab === 'all' ? 'New Source' : undefined}
        onaction={activeTab === 'all' ? startNew : undefined}
      />
    {:else if groupedEducation}
      <!-- Grouped education list -->
      {#each groupedEducation as group (group.key)}
        <div class="group-section">
          <button
            class="group-header"
            onclick={() => toggleGroupCollapse(group.key)}
          >
            <span class="group-chevron" class:collapsed={collapsedGroups[group.key]}>&#9662;</span>
            <span class="group-label">{group.label}</span>
            <span class="group-count">{group.sources.length}</span>
          </button>
          {#if !collapsedGroups[group.key]}
            <ul class="source-list grouped">
              {#each group.sources as source (source.id)}
                <li>
                  {@render sourceCard(source)}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    {:else}
      <!-- Flat list -->
      <ul class="source-list">
        {#each filteredSources as source (source.id)}
          <li>
            {@render sourceCard(source)}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Right panel: Editor -->
  <div class="editor-panel">
    {#if !selectedSource && !editing}
      <div class="editor-empty">
        <p>Select a source or create a new one.</p>
      </div>
    {:else}
      <div class="editor-content">
        <h3 class="editor-heading">{editing ? 'New Source' : 'Edit Source'}</h3>

        <!-- Base fields -->
        <div class="form-group">
          <label for="source-type">Type</label>
          <select id="source-type" bind:value={formSourceType} disabled={!editing}>
            <option value="general">General</option>
            <option value="role">Role</option>
            <option value="project">Project</option>
            <option value="education">Education</option>
            <option value="clearance">Clearance</option>
          </select>
        </div>

        <div class="form-group">
          <label for="source-title">Title <span class="required">*</span></label>
          <input
            id="source-title"
            type="text"
            bind:value={formTitle}
            placeholder="e.g. Cloud Migration Project"
          />
        </div>

        <div class="form-group">
          <label for="source-description">Description <span class="required">*</span></label>
          <textarea
            id="source-description"
            bind:value={formDescription}
            rows="6"
            placeholder="Describe what you did, the context, technologies used..."
          ></textarea>
        </div>

        <!-- Role-specific fields -->
        {#if formSourceType === 'role'}
          <div class="form-group">
            <label for="role-org">Organization</label>
            <select id="role-org" bind:value={formOrgId}>
              <option value={null}>None</option>
              {#each organizations as org}
                <option value={org.id}>{org.name}</option>
              {/each}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="role-start">Start Date</label>
              <input id="role-start" type="date" bind:value={formStartDate} />
            </div>
            <div class="form-group">
              <label for="role-end">End Date</label>
              <input id="role-end" type="date" bind:value={formEndDate} />
            </div>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" bind:checked={formIsCurrent} /> Currently employed
            </label>
          </div>
          <div class="form-group">
            <label for="role-arrangement">Work Arrangement</label>
            <input id="role-arrangement" type="text" bind:value={formWorkArrangement}
                   placeholder="e.g. remote, hybrid, on-site" />
          </div>
        {/if}

        <!-- Education-specific fields -->
        {#if formSourceType === 'education'}
          <div class="form-group">
            <label for="edu-type">Education Type</label>
            <select id="edu-type" value={formEducationType} onchange={(e) => handleEducationTypeChange((e.target as HTMLSelectElement).value)}>
              <option value="degree">Degree</option>
              <option value="certificate">Certificate</option>
              <option value="course">Course</option>
              <option value="self_taught">Self-Taught</option>
            </select>
          </div>

          {#if formEducationType === 'degree'}
            <!-- Degree fields -->
            <div class="form-row">
              <div class="form-group">
                <label for="edu-degree-level">Degree Level <span class="required">*</span></label>
                <select id="edu-degree-level" bind:value={formDegreeLevel}>
                  <option value="" disabled>-- Select Degree Level --</option>
                  <option value="associate">Associate</option>
                  <option value="bachelors">Bachelor's</option>
                  <option value="masters">Master's</option>
                  <option value="doctoral">Doctoral</option>
                  <option value="graduate_certificate">Graduate Certificate</option>
                </select>
              </div>
              <div class="form-group">
                <label for="edu-degree-type">Degree Type <span class="required">*</span></label>
                <input id="edu-degree-type" type="text" bind:value={formDegreeType}
                       placeholder="e.g. BS, MS, PhD, MBA" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="edu-org">Institution</label>
                <div class="org-select-row">
                  <OrgCombobox
                    id="edu-org"
                    organizations={eduFilteredOrgs}
                    bind:value={formEduOrgId}
                    placeholder="Search institutions..."
                    oncreate={openOrgModal}
                  />
                </div>
              </div>
              <div class="form-group">
                <label for="edu-location">Location</label>
                <input id="edu-location" type="text" bind:value={formLocation}
                       placeholder="e.g. Cambridge, MA" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="edu-field">Field (Major)</label>
                <input id="edu-field" type="text" bind:value={formField} />
              </div>
              <div class="form-group">
                <label for="edu-gpa">GPA</label>
                <input id="edu-gpa" type="text" bind:value={formGpa}
                       placeholder="e.g. 3.8/4.0" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="edu-start">Start Date</label>
                <input id="edu-start" type="date" bind:value={formStartDate} />
              </div>
              <div class="form-group">
                <label for="edu-end">End Date</label>
                <input id="edu-end" type="date" bind:value={formEndDate} />
              </div>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={formIsInProgress} /> In progress
              </label>
            </div>
            <div class="form-group">
              <label for="edu-description">Description</label>
              <textarea id="edu-description" bind:value={formEduDescription} rows="3"
                        placeholder="Additional notes about this degree..."></textarea>
            </div>

          {:else if formEducationType === 'certificate'}
            <!-- Certificate fields -->
            <div class="form-group">
              <label for="edu-cert-subtype">Certificate Type <span class="required">*</span></label>
              <select id="edu-cert-subtype" bind:value={formCertificateSubtype}>
                <option value="professional">Professional (CISSP, PE, PMP)</option>
                <option value="vendor">Vendor (AWS, Azure, CompTIA)</option>
                <option value="completion">Completion (Udemy, bootcamp)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="edu-org">Issuing Body</label>
              <div class="org-select-row">
                <OrgCombobox
                  id="edu-org"
                  organizations={eduFilteredOrgs}
                  bind:value={formEduOrgId}
                  placeholder="Search issuers..."
                  oncreate={openOrgModal}
                />
              </div>
            </div>
            <div class="form-group">
              <label for="edu-credential">Credential ID</label>
              <input id="edu-credential" type="text" bind:value={formCredentialId} />
            </div>
            <div class="form-group">
              <label for="edu-url">URL</label>
              <input id="edu-url" type="url" bind:value={formUrl} />
            </div>
            <div class="form-group">
              <label for="edu-expiration">Expiration Date</label>
              <input id="edu-expiration" type="date" bind:value={formExpirationDate} />
            </div>
            <div class="form-group">
              <label for="edu-description">Description</label>
              <textarea id="edu-description" bind:value={formEduDescription} rows="3"
                        placeholder="Additional notes about this certificate..."></textarea>
            </div>

          {:else if formEducationType === 'course'}
            <!-- Course fields -->
            <div class="form-row">
              <div class="form-group">
                <label for="edu-org">Institution (Provider)</label>
                <div class="org-select-row">
                  <OrgCombobox
                    id="edu-org"
                    organizations={eduFilteredOrgs}
                    bind:value={formEduOrgId}
                    placeholder="Search providers..."
                    oncreate={openOrgModal}
                  />
                </div>
              </div>
              <div class="form-group">
                <label for="edu-location">Location</label>
                <input id="edu-location" type="text" bind:value={formLocation}
                       placeholder="e.g. Las Vegas, NV" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="edu-start">Start Date</label>
                <input id="edu-start" type="date" bind:value={formStartDate} />
              </div>
              <div class="form-group">
                <label for="edu-end">End Date</label>
                <input id="edu-end" type="date" bind:value={formEndDate} />
              </div>
            </div>
            <div class="form-group">
              <label for="edu-url">URL</label>
              <input id="edu-url" type="url" bind:value={formUrl} />
            </div>
            <div class="form-group">
              <label for="edu-description">Description</label>
              <textarea id="edu-description" bind:value={formEduDescription} rows="3"
                        placeholder="What you learned, key takeaways..."></textarea>
            </div>

          {:else if formEducationType === 'self_taught'}
            <!-- Self-taught fields -->
            <div class="form-group">
              <label for="edu-description">Description <span class="required">*</span></label>
              <textarea id="edu-description" bind:value={formEduDescription} rows="6"
                        placeholder="Describe what you learned, resources used, projects built..."></textarea>
            </div>
            <div class="form-group">
              <label for="edu-url">URL</label>
              <input id="edu-url" type="url" bind:value={formUrl} />
            </div>
          {/if}
        {/if}

        <!-- Project-specific fields -->
        {#if formSourceType === 'project'}
          <div class="form-group">
            <label>
              <input type="checkbox" bind:checked={formIsPersonal} /> Personal project
            </label>
          </div>
          {#if !formIsPersonal}
            <div class="form-group">
              <label for="proj-org">Organization</label>
              <select id="proj-org" bind:value={formOrgId}>
                <option value={null}>None</option>
                {#each organizations as org}
                  <option value={org.id}>{org.name}</option>
                {/each}
              </select>
            </div>
          {/if}
          <div class="form-group">
            <label for="proj-url">URL</label>
            <input id="proj-url" type="url" bind:value={formProjectUrl} />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="proj-start">Start Date</label>
              <input id="proj-start" type="date" bind:value={formStartDate} />
            </div>
            <div class="form-group">
              <label for="proj-end">End Date</label>
              <input id="proj-end" type="date" bind:value={formEndDate} />
            </div>
          </div>
        {/if}

        <!-- Clearance-specific fields -->
        {#if formSourceType === 'clearance'}
          <div class="form-row">
            <div class="form-group">
              <label for="clearance-level">Level <span class="required">*</span></label>
              <select id="clearance-level" bind:value={formLevel}>
                {#each CLEARANCE_LEVELS as level}
                  <option value={level}>{CLEARANCE_LEVEL_LABELS[level]}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label for="clearance-status">Status</label>
              <select id="clearance-status" bind:value={formClearanceStatus}>
                {#each CLEARANCE_STATUSES as status}
                  <option value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="clearance-polygraph">Polygraph</label>
              <select id="clearance-polygraph" bind:value={formPolygraph}>
                <option value="">-- None --</option>
                {#each CLEARANCE_POLYGRAPHS as poly}
                  <option value={poly}>{CLEARANCE_POLYGRAPH_LABELS[poly]}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label for="clearance-type">Type</label>
              <select id="clearance-type" bind:value={formClearanceType}>
                {#each CLEARANCE_TYPES as ctype}
                  <option value={ctype}>{ctype.charAt(0).toUpperCase() + ctype.slice(1)}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Access Programs</label>
            <div class="checkbox-group">
              {#each CLEARANCE_ACCESS_PROGRAMS as prog}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formAccessPrograms.includes(prog)}
                    onchange={(e) => {
                      if (e.currentTarget.checked) {
                        formAccessPrograms = [...formAccessPrograms, prog]
                      } else {
                        formAccessPrograms = formAccessPrograms.filter(p => p !== prog)
                      }
                    }}
                  />
                  {CLEARANCE_ACCESS_PROGRAM_LABELS[prog]}
                </label>
              {/each}
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                bind:checked={formContinuousInvestigation}
              />
              Continuous Investigation (CE/CV)
            </label>
          </div>
        {/if}

        <!-- Notes (all types) -->
        <div class="form-group">
          <label for="source-notes">Notes</label>
          <textarea id="source-notes" bind:value={formNotes} rows="3"
                    placeholder="Internal notes about this source..."></textarea>
        </div>

        <div class="editor-actions">
          <button
            class="btn btn-save"
            onclick={saveSource}
            disabled={saving}
          >
            {#if saving}
              <LoadingSpinner size="sm" />
            {:else}
              {editing ? 'Create' : 'Save'}
            {/if}
          </button>

          {#if !editing && selectedSource}
            {#if selectedSource.status === 'draft' || selectedSource.status === 'approved'}
              <button
                class="btn btn-derive"
                onclick={deriveBullets}
                disabled={deriving}
              >
                {#if deriving}
                  <LoadingSpinner size="sm" />
                  <span>Deriving...</span>
                {:else}
                  Derive Bullets
                {/if}
              </button>
            {/if}

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
  title="Delete Source"
  message="Are you sure you want to delete this source? This action cannot be undone."
  confirmLabel="Delete"
  onconfirm={deleteSource}
  oncancel={() => confirmDeleteOpen = false}
  destructive
/>

<!-- Quick-create organization modal -->
{#if showOrgModal}
  <div class="modal-overlay" onclick={() => showOrgModal = false} role="presentation">
    <div class="org-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="org-modal-title">
      <h3 id="org-modal-title">New Organization</h3>
      <div class="form-group">
        <label for="new-org-name">Name *</label>
        <input id="new-org-name" type="text" bind:value={newOrgName} placeholder="e.g. Georgia Tech, CompTIA, Coursera" />
      </div>
      <div class="form-group">
        <label for="new-org-type">Primary Type</label>
        <select id="new-org-type" bind:value={newOrgType}>
          <option value="education">Education</option>
          <option value="company">Company</option>
          <option value="nonprofit">Nonprofit</option>
          <option value="government">Government</option>
          <option value="military">Military</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label>Tags</label>
        <div class="tag-checkboxes">
          {#each ['company', 'vendor', 'platform', 'university', 'school', 'nonprofit', 'government', 'military', 'conference', 'volunteer', 'freelance'] as tag}
            <label class="tag-checkbox">
              <input type="checkbox" checked={newOrgTags.includes(tag)}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement
                  if (target.checked) {
                    newOrgTags = [...newOrgTags, tag]
                  } else {
                    newOrgTags = newOrgTags.filter(t => t !== tag)
                  }
                }}
              />
              {tag}
            </label>
          {/each}
        </div>
      </div>
      <div class="form-group">
        <label for="new-org-website">Website</label>
        <input id="new-org-website" type="url" bind:value={newOrgWebsite} placeholder="https://..." />
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick={() => showOrgModal = false} disabled={creatingOrg}>Cancel</button>
        <button class="btn btn-primary" onclick={createOrgAndSelect} disabled={creatingOrg || !newOrgName.trim()}>
          {creatingOrg ? 'Creating...' : 'Create & Select'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .sources-page {
    display: flex;
    gap: 0;
    height: 100%;
  }

  /* ---- Group bar ---- */
  .group-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .group-bar label {
    color: #6b7280;
    font-weight: 500;
  }

  .group-bar select {
    font-size: 0.8rem;
    padding: 0.2rem 0.4rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #fff;
  }

  /* ---- Group sections ---- */
  .group-section {
    border-bottom: 1px solid #f3f4f6;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.6rem 1rem;
    background: #f9fafb;
    border: none;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
    text-align: left;
  }

  .group-header:hover {
    background: #f3f4f6;
  }

  .group-chevron {
    font-size: 0.7rem;
    transition: transform 0.15s;
    display: inline-block;
  }

  .group-chevron.collapsed {
    transform: rotate(-90deg);
  }

  .group-label {
    flex: 1;
  }

  .group-count {
    color: #9ca3af;
    font-weight: 400;
    font-size: 0.75rem;
  }

  .source-list.grouped {
    padding-left: 0;
  }

  /* ---- Modal overlay ---- */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ---- Org select row ---- */
  .org-select-row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .org-select-row select {
    flex: 1;
    min-width: 0;
  }

  .btn-new-sm {
    padding: 0.3rem 0.6rem;
    background: #6c63ff;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    flex-shrink: 0;
    line-height: 1;
  }

  .btn-new-sm:hover { background: #5a52e0; }

  /* ---- Org modal ---- */
  .org-modal {
    background: #fff;
    border-radius: 8px;
    padding: 1.5rem;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }

  .org-modal h3 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    color: #1a1a2e;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .tag-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }

  .tag-checkbox {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
    color: #4b5563;
  }

  .tag-checkbox input[type='checkbox'] {
    margin: 0;
  }

  .edu-type-badge {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    background: #e0e7ff;
    color: #4338ca;
    text-transform: capitalize;
  }

  /* ---- Left panel ---- */
  .list-panel {
    width: 340px;
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

  .btn-new:hover {
    background: #5a52e0;
  }

  .filter-tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    padding: 0 0.25rem;
    overflow-x: auto;
  }

  .filter-tab {
    flex: 1;
    padding: 0.5rem 0.35rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.72rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    text-align: center;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
  }

  .filter-tab:hover {
    color: #374151;
  }

  .filter-tab.active {
    color: #6c63ff;
    border-bottom-color: #6c63ff;
  }

  .tab-count {
    font-size: 0.65rem;
    color: #9ca3af;
    font-weight: 400;
  }

  .filter-tab.active .tab-count {
    color: #6c63ff;
  }

  .list-loading {
    display: flex;
    justify-content: center;
    padding: 3rem 1rem;
  }

  .source-list {
    list-style: none;
    overflow-y: auto;
    flex: 1;
  }

  .source-card {
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

  .source-card:hover {
    background: #f9fafb;
  }

  .source-card.selected {
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

  .card-meta {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.25rem;
  }

  .card-org {
    font-size: 0.72rem;
    color: #6b7280;
  }

  .type-badge {
    display: inline-block;
    padding: 0.1em 0.4em;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .type-role { background: #dbeafe; color: #1e40af; }
  .type-project { background: #fef3c7; color: #92400e; }
  .type-education { background: #d1fae5; color: #065f46; }
  .type-clearance { background: #fce7f3; color: #9d174d; }
  .type-general { background: #f3f4f6; color: #6b7280; }

  .card-date {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  /* ---- Right panel ---- */
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

  .required {
    color: #ef4444;
  }

  .form-group input[type='text'],
  .form-group input[type='date'],
  .form-group input[type='url'],
  .form-group input[type='number'],
  .form-group textarea,
  .form-group select {
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
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .form-group select:disabled {
    background: #f3f4f6;
    color: #9ca3af;
    cursor: not-allowed;
  }

  .form-group textarea {
    resize: vertical;
    min-height: 100px;
    line-height: 1.5;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .form-row .form-group {
    flex: 1;
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

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-save {
    background: #6c63ff;
    color: #fff;
  }

  .btn-save:hover:not(:disabled) {
    background: #5a52e0;
  }

  .btn-derive {
    background: #6c63ff;
    color: #fff;
  }

  .btn-derive:hover:not(:disabled) {
    background: #5a52e0;
  }

  .btn-delete {
    background: #fee2e2;
    color: #dc2626;
    margin-left: auto;
  }

  .btn-delete:hover {
    background: #fecaca;
  }

  .personal-badge {
    display: inline-block;
    padding: 0.1em 0.4em;
    background: #ede9fe;
    color: #6d28d9;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .checkbox-group {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    cursor: pointer;
  }
</style>
