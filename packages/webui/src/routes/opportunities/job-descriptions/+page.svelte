<!--
  JD Detail Page -- split-panel layout with list + editor.
  Manages JD list state, selection, create/edit mode, and filters.
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, EmptyState } from '$lib/components'
  import JDCard from '$lib/components/jd/JDCard.svelte'
  import JDEditor from '$lib/components/jd/JDEditor.svelte'
  import type { JobDescriptionWithOrg, Organization, JobDescriptionStatus } from '@forge/sdk'

  let jds = $state<JobDescriptionWithOrg[]>([])
  let organizations = $state<Organization[]>([])
  let selectedId = $state<string | null>(null)
  let createMode = $state(false)
  let statusFilter = $state<JobDescriptionStatus | 'all'>('all')
  let searchText = $state('')
  let loading = $state(true)

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
    return result
  })

  let selectedJd = $derived(jds.find(jd => jd.id === selectedId) ?? null)

  $effect(() => {
    loadData()
  })

  async function loadData() {
    loading = true
    const [jdRes, orgRes] = await Promise.all([
      forge.jobDescriptions.list({ limit: 200 }),
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
    const res = await forge.jobDescriptions.list({ limit: 200 })
    if (res.ok) {
      jds = res.data
    }
  }

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
</script>

<div class="jd-page">
  {#if loading}
    <div class="loading-container">
      <LoadingSpinner />
    </div>
  {:else}
    <div class="split-panel">
      <!-- List Panel -->
      <div class="list-panel">
        <div class="list-header">
          <h2 class="panel-title">Job Descriptions</h2>
          <button class="btn-new" onclick={startCreate} type="button">
            + New JD
          </button>
        </div>

        <div class="list-filters">
          <select
            class="status-filter"
            bind:value={statusFilter}
          >
            <option value="all">All Statuses</option>
            <option value="interested">Interested</option>
            <option value="analyzing">Analyzing</option>
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

  .split-panel {
    display: flex;
    height: 100%;
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

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
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
