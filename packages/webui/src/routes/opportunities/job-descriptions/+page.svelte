<!--
  JD Detail Page -- split-panel layout with list + editor, plus kanban board view.
  Manages JD list state, selection, create/edit mode, filters, and view toggle.
  View mode persisted in localStorage with key 'forge:viewMode:jobDescriptions'.
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { page } from '$app/state'
  import { LoadingSpinner, EmptyState } from '$lib/components'
  import ViewToggle from '$lib/components/ViewToggle.svelte'
  import GenericKanban from '$lib/components/kanban/GenericKanban.svelte'
  import JDKanbanCard from '$lib/components/kanban/JDKanbanCard.svelte'
  import JDFilterBar from '$lib/components/filters/JDFilterBar.svelte'
  import JDCard from '$lib/components/jd/JDCard.svelte'
  import JDEditor from '$lib/components/jd/JDEditor.svelte'
  import type { JobDescriptionWithOrg, Organization, JobDescriptionStatus } from '@forge/sdk'

  /**
   * Pipeline columns for the JD kanban board (7 columns mapping 9 statuses).
   * Mirrors JD_PIPELINE_COLUMNS from @forge/core/constants, defined inline
   * to avoid cross-package import issues (core uses bun:sqlite, webui is browser).
   */
  const JD_PIPELINE_COLUMNS = [
    { key: 'discovered', label: 'Discovered', statuses: ['discovered'], accent: '#a5b4fc' },
    { key: 'analyzing', label: 'Analyzing', statuses: ['analyzing'], accent: '#60a5fa' },
    { key: 'applying', label: 'Applying', statuses: ['applying'], accent: '#fbbf24' },
    { key: 'applied', label: 'Applied', statuses: ['applied'], accent: '#818cf8' },
    { key: 'interviewing', label: 'Interviewing', statuses: ['interviewing'], accent: '#a78bfa' },
    { key: 'offered', label: 'Offered', statuses: ['offered'], accent: '#22c55e' },
    {
      key: 'closed',
      label: 'Closed',
      statuses: ['rejected', 'withdrawn', 'closed'],
      dropStatus: 'closed',
      accent: '#d1d5db',
    },
  ]

  // ── View mode state (persisted in localStorage) ─────────────────────
  const STORAGE_KEY = 'forge:viewMode:jobDescriptions'
  let viewMode = $state<'list' | 'board'>(
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY) as 'list' | 'board'
      : null) ?? 'list'
  )

  // Persist view mode changes to localStorage
  $effect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, viewMode)
    }
  })

  // ── Data state ──────────────────────────────────────────────────────
  let jds = $state<JobDescriptionWithOrg[]>([])
  let organizations = $state<Organization[]>([])
  let selectedId = $state<string | null>(null)
  let createMode = $state(false)
  let loading = $state(true)

  // List view filters
  let statusFilter = $state<JobDescriptionStatus | 'all'>('all')
  let searchText = $state('')
  let locationFilter = $state('')

  // Initialize locationFilter reactively from URL params via $effect.
  // Using `$state(locationParam ?? '')` would capture the initial value only --
  // it would not update when the URL changes (e.g., browser back/forward).
  $effect(() => {
    const param = page.url.searchParams.get('location')
    if (param) locationFilter = param
  })

  // Board view filters
  let boardFilters = $state({ organization_id: '', location: '', search: '' })

  // ── Derived data ────────────────────────────────────────────────────

  // Filtered JDs for list view
  let filteredJds = $derived.by(() => {
    let result = jds
    if (statusFilter !== 'all') {
      result = result.filter(jd => jd.status === statusFilter)
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      result = result.filter(jd =>
        jd.title.toLowerCase().includes(q) ||
        jd.organization_name?.toLowerCase().includes(q)
      )
    }
    if (locationFilter.trim()) {
      const loc = locationFilter.toLowerCase()
      result = result.filter(jd =>
        (jd.location ?? '').toLowerCase().includes(loc)
      )
    }
    return result
  })

  // Filtered JDs for board view (client-side AND logic)
  let boardFilteredJDs = $derived(
    jds.filter(jd => {
      if (boardFilters.organization_id && jd.organization_id !== boardFilters.organization_id) return false
      if (boardFilters.location && !(jd.location ?? '').toLowerCase().includes(boardFilters.location.toLowerCase())) return false
      if (boardFilters.search) {
        const s = boardFilters.search.toLowerCase()
        if (
          !jd.title.toLowerCase().includes(s) &&
          !(jd.organization_name ?? '').toLowerCase().includes(s)
        ) return false
      }
      return true
    })
  )

  let selectedJd = $derived(jds.find(jd => jd.id === selectedId) ?? null)

  // ── Data loading ────────────────────────────────────────────────────

  $effect(() => {
    loadData()
  })

  async function loadData() {
    loading = true
    const [jdRes, orgRes] = await Promise.all([
      forge.jobDescriptions.list({ limit: 500 }),
      forge.organizations.list({ limit: 500 }),
    ])

    if (jdRes.ok) {
      jds = jdRes.data
    } else {
      addToast({ type: 'error', message: friendlyError(jdRes.error) })
    }

    if (orgRes.ok) {
      organizations = orgRes.data
    }
    loading = false
  }

  async function refreshJds() {
    const res = await forge.jobDescriptions.list({ limit: 500 })
    if (res.ok) {
      jds = res.data
    }
  }

  // ── Interaction handlers ────────────────────────────────────────────

  function selectJd(id: string) {
    createMode = false
    selectedId = id
  }

  function startCreate() {
    selectedId = null
    createMode = true
  }

  function handleCreated(jd: JobDescriptionWithOrg) {
    createMode = false
    selectedId = jd.id
    refreshJds()
  }

  function handleUpdated(jd: JobDescriptionWithOrg) {
    refreshJds()
  }

  function handleDeleted(id: string) {
    selectedId = null
    refreshJds()
  }

  // Card click from kanban: switch to list view with that JD selected.
  // Uses list view because Phase 49 builds a full split-panel editor.
  function selectJDFromBoard(id: string) {
    viewMode = 'list'
    selectedId = id
  }

  // Optimistic update: move card immediately, revert on API failure.
  // Uses array reassignment via .map() instead of index mutation
  // because index mutation does not reliably trigger Svelte 5 reactivity.
  async function handleJDDrop(itemId: string, newStatus: string) {
    const idx = jds.findIndex(jd => jd.id === itemId)
    if (idx >= 0) {
      const prev = jds[idx].status
      jds = jds.map((jd, i) =>
        i === idx ? { ...jd, status: newStatus as JobDescriptionStatus } : jd
      )

      const result = await forge.jobDescriptions.update(itemId, {
        status: newStatus as JobDescriptionStatus,
      })

      if (!result.ok) {
        // Revert on failure
        jds = jds.map((jd, i) =>
          i === idx ? { ...jd, status: prev } : jd
        )
        addToast({ type: 'error', message: friendlyError(result.error) })
      }
    }
  }
</script>

<div class="jd-page">
  {#if loading}
    <div class="loading-container">
      <LoadingSpinner />
    </div>
  {:else}
    <div class="page-header">
      <h2 class="panel-title">Job Descriptions</h2>
      <div class="header-actions">
        <button class="btn-new" onclick={startCreate} type="button">
          + New JD
        </button>
        <ViewToggle mode={viewMode} onchange={(m) => viewMode = m} />
      </div>
    </div>

    {#if viewMode === 'board'}
      <div class="board-container">
        <GenericKanban
          columns={JD_PIPELINE_COLUMNS}
          items={boardFilteredJDs}
          onDrop={handleJDDrop}
          {loading}
          emptyMessage="No job descriptions yet. Create one to start tracking your pipeline."
          defaultCollapsed="closed"
          sortItems={(a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')}
        >
          {#snippet filterBar()}
            <JDFilterBar bind:filters={boardFilters} {forge} onchange={() => {}} />
          {/snippet}

          {#snippet cardContent(jd)}
            <JDKanbanCard {jd} onclick={() => selectJDFromBoard(jd.id)} />
          {/snippet}
        </GenericKanban>
      </div>
    {:else}
      <div class="split-panel">
        <!-- List Panel -->
        <div class="list-panel">
          <div class="list-filters">
            <select
              class="status-filter"
              bind:value={statusFilter}
            >
              <option value="all">All Statuses</option>
              <option value="discovered">Discovered</option>
              <option value="analyzing">Analyzing</option>
              <option value="applying">Applying</option>
              <option value="applied">Applied</option>
              <option value="interviewing">Interviewing</option>
              <option value="offered">Offered</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="closed">Closed</option>
            </select>
            <input
              type="text"
              class="search-input"
              placeholder="Search title or org..."
              bind:value={searchText}
            />
            {#if locationFilter}
              <button
                class="location-badge"
                onclick={() => { locationFilter = '' }}
                title="Clear location filter"
              >
                {locationFilter} &times;
              </button>
            {/if}
          </div>

          <div class="card-list">
            {#if filteredJds.length === 0}
              <p class="empty-list">No job descriptions match your filters.</p>
            {:else}
              {#each filteredJds as jd (jd.id)}
                <JDCard
                  {jd}
                  selected={selectedId === jd.id}
                  onclick={() => selectJd(jd.id)}
                />
              {/each}
            {/if}
          </div>
        </div>

        <!-- Editor Panel -->
        <div class="editor-panel">
          {#if createMode}
            <JDEditor
              jd={null}
              {organizations}
              createMode={true}
              oncreated={handleCreated}
              onupdated={handleUpdated}
              ondeleted={handleDeleted}
            />
          {:else if selectedJd}
            {#key selectedJd.id}
              <JDEditor
                jd={selectedJd}
                {organizations}
                createMode={false}
                oncreated={handleCreated}
                onupdated={handleUpdated}
                ondeleted={handleDeleted}
              />
            {/key}
          {:else}
            <div class="empty-editor">
              <EmptyState
                title="No job description selected"
                description="Select a job description or create a new one"
              />
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .jd-page {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 300px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .btn-new {
    padding: 0.35rem 0.75rem;
    background: var(--color-info);
    color: var(--color-surface);
    border: none;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-new:hover {
    background: var(--color-info-text);
  }

  .board-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .split-panel {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .list-panel {
    width: 320px;
    min-width: 280px;
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .list-filters {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--color-ghost);
  }

  .status-filter {
    flex: 0 0 auto;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.375rem;
    font-size: 0.8rem;
    outline: none;
  }

  .search-input {
    flex: 1;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.375rem;
    font-size: 0.8rem;
    outline: none;
  }

  .search-input:focus,
  .status-filter:focus {
    border-color: var(--color-info);
  }

  .location-badge {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0.25rem 0.5rem;
    background: var(--color-info-subtle);
    border: 1px solid var(--color-info);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-info-text);
    cursor: pointer;
    white-space: nowrap;
  }

  .location-badge:hover {
    background: var(--color-info);
    color: var(--color-surface);
  }

  .card-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty-list {
    text-align: center;
    color: var(--text-faint);
    padding: 2rem 1rem;
    font-size: 0.85rem;
  }

  .editor-panel {
    flex: 1;
    overflow-y: auto;
    min-width: 0;
  }

  .empty-editor {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
  }
</style>
