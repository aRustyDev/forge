<!--
  Credentials page — split-panel CRUD for clearances, licenses, admissions.

  Phase 87 T87.2. Uses the Qualifications-track entities (credentials table
  with polymorphic details JSON). Each credential_type renders a distinct
  form section for the type-specific details fields.

  Follows the project's UI shared component rules:
  - SplitPanel for the two-column layout
  - ListPanelHeader for the list header with "New" button
  - EmptyPanel for the empty-state detail panel
  - ListSearchInput for the search/filter input
  - Global .btn classes for all buttons
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, SplitPanel, ListPanelHeader, EmptyPanel, ListSearchInput } from '$lib/components'
  import type { Credential, CredentialType } from '@forge/sdk'

  const CREDENTIAL_TYPES: Array<{ value: CredentialType; label: string }> = [
    { value: 'clearance', label: 'Clearance' },
    { value: 'drivers_license', label: "Driver's License" },
    { value: 'bar_admission', label: 'Bar Admission' },
    { value: 'medical_license', label: 'Medical License' },
  ]

  const STATUS_OPTIONS = ['active', 'inactive', 'expired'] as const

  // Clearance-specific options
  const CLEARANCE_LEVELS = ['public', 'confidential', 'secret', 'top_secret', 'q', 'l']
  const CLEARANCE_POLYGRAPHS = ['none', 'ci', 'full_scope']
  const CLEARANCE_TYPES = ['personnel', 'facility']
  const ACCESS_PROGRAMS = ['sci', 'sap', 'nato']

  let credentials = $state<Credential[]>([])
  let selectedId = $state<string | null>(null)
  let searchQuery = $state('')
  let loading = $state(true)
  let editing = $state(false)
  let saving = $state(false)

  // Form fields
  let formType = $state<CredentialType>('clearance')
  let formLabel = $state('')
  let formStatus = $state<string>('active')
  let formOrgId = $state<string | null>(null)
  let formIssuedDate = $state('')
  let formExpiryDate = $state('')
  // Clearance details
  let formLevel = $state('secret')
  let formPolygraph = $state<string | null>(null)
  let formClearanceType = $state('personnel')
  let formAccessPrograms = $state<Set<string>>(new Set())
  // Drivers license details
  let formDlClass = $state('')
  let formDlState = $state('')
  let formEndorsements = $state('')
  // Bar admission details
  let formJurisdiction = $state('')
  let formBarNumber = $state('')
  // Medical license details
  let formLicenseType = $state('')
  let formMedState = $state('')
  let formLicenseNumber = $state('')

  let filteredCredentials = $derived.by(() => {
    if (!searchQuery.trim()) return credentials
    const q = searchQuery.toLowerCase()
    return credentials.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.credential_type.toLowerCase().includes(q)
    )
  })

  let selectedCredential = $derived(credentials.find(c => c.id === selectedId) ?? null)

  $effect(() => { loadCredentials() })

  $effect(() => {
    if (selectedCredential && !editing) {
      populateForm(selectedCredential)
    }
  })

  async function loadCredentials() {
    loading = true
    const res = await forge.credentials.list()
    if (res.ok) credentials = res.data
    else addToast({ message: friendlyError(res.error, 'Failed to load credentials'), type: 'error' })
    loading = false
  }

  function populateForm(cred: Credential) {
    formType = cred.credential_type
    formLabel = cred.label
    formStatus = cred.status
    formOrgId = cred.organization_id
    formIssuedDate = cred.issued_date ?? ''
    formExpiryDate = cred.expiry_date ?? ''

    const d = cred.details as any
    if (cred.credential_type === 'clearance') {
      formLevel = d.level ?? 'secret'
      formPolygraph = d.polygraph ?? null
      formClearanceType = d.clearance_type ?? 'personnel'
      formAccessPrograms = new Set(d.access_programs ?? [])
    } else if (cred.credential_type === 'drivers_license') {
      formDlClass = d.class ?? ''
      formDlState = d.state ?? ''
      formEndorsements = (d.endorsements ?? []).join(', ')
    } else if (cred.credential_type === 'bar_admission') {
      formJurisdiction = d.jurisdiction ?? ''
      formBarNumber = d.bar_number ?? ''
    } else if (cred.credential_type === 'medical_license') {
      formLicenseType = d.license_type ?? ''
      formMedState = d.state ?? ''
      formLicenseNumber = d.license_number ?? ''
    }
  }

  function buildDetails(): any {
    switch (formType) {
      case 'clearance':
        return {
          level: formLevel,
          polygraph: formPolygraph,
          clearance_type: formClearanceType,
          access_programs: [...formAccessPrograms],
        }
      case 'drivers_license':
        return {
          class: formDlClass,
          state: formDlState,
          endorsements: formEndorsements.split(',').map(s => s.trim()).filter(Boolean),
        }
      case 'bar_admission':
        return {
          jurisdiction: formJurisdiction,
          bar_number: formBarNumber || null,
        }
      case 'medical_license':
        return {
          license_type: formLicenseType,
          state: formMedState,
          license_number: formLicenseNumber || null,
        }
    }
  }

  function startNew() {
    selectedId = null
    editing = true
    formType = 'clearance'
    formLabel = ''
    formStatus = 'active'
    formOrgId = null
    formIssuedDate = ''
    formExpiryDate = ''
    formLevel = 'secret'
    formPolygraph = null
    formClearanceType = 'personnel'
    formAccessPrograms = new Set()
    formDlClass = ''
    formDlState = ''
    formEndorsements = ''
    formJurisdiction = ''
    formBarNumber = ''
    formLicenseType = ''
    formMedState = ''
    formLicenseNumber = ''
  }

  function selectCredential(id: string) {
    editing = false
    selectedId = id
  }

  function startEditing() { editing = true }

  async function saveCredential() {
    if (!formLabel.trim()) {
      addToast({ message: 'Label is required', type: 'error' })
      return
    }
    saving = true

    if (editing && !selectedId) {
      const res = await forge.credentials.create({
        credential_type: formType,
        label: formLabel.trim(),
        status: formStatus as any,
        organization_id: formOrgId ?? undefined,
        details: buildDetails(),
        issued_date: formIssuedDate || undefined,
        expiry_date: formExpiryDate || undefined,
      })
      if (res.ok) {
        credentials = [...credentials, res.data]
        selectedId = res.data.id
        editing = false
        addToast({ message: 'Credential created', type: 'success' })
      } else {
        addToast({ message: friendlyError(res.error, 'Failed to create'), type: 'error' })
      }
    } else if (selectedId) {
      const res = await forge.credentials.update(selectedId, {
        label: formLabel.trim(),
        status: formStatus as any,
        organization_id: formOrgId,
        details: buildDetails(),
        issued_date: formIssuedDate || null,
        expiry_date: formExpiryDate || null,
      })
      if (res.ok) {
        credentials = credentials.map(c => c.id === selectedId ? res.data : c)
        editing = false
        addToast({ message: 'Credential updated', type: 'success' })
      } else {
        addToast({ message: friendlyError(res.error, 'Failed to update'), type: 'error' })
      }
    }
    saving = false
  }

  async function deleteCredential() {
    if (!selectedId) return
    const res = await forge.credentials.delete(selectedId)
    if (res.ok) {
      credentials = credentials.filter(c => c.id !== selectedId)
      selectedId = null
      editing = false
      addToast({ message: 'Credential deleted', type: 'success' })
    } else {
      addToast({ message: friendlyError(res.error, 'Failed to delete'), type: 'error' })
    }
  }

  function toggleAccessProgram(p: string) {
    const next = new Set(formAccessPrograms)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    formAccessPrograms = next
  }

  function typeBadgeLabel(type: CredentialType): string {
    return CREDENTIAL_TYPES.find(t => t.value === type)?.label ?? type
  }
</script>

<div class="credentials-page">
  <SplitPanel listWidth={320}>
    {#snippet list()}
      <ListPanelHeader title="Credentials" onNew={startNew} />
      <ListSearchInput bind:value={searchQuery} placeholder="Search credentials..." />

      {#if loading}
        <div style="display: flex; justify-content: center; padding: 3rem 1rem;">
          <LoadingSpinner size="md" message="Loading credentials..." />
        </div>
      {:else if filteredCredentials.length === 0}
        <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: var(--text-sm);">
          {searchQuery ? 'No credentials match your search.' : 'No credentials yet. Create one.'}
        </div>
      {:else}
        <ul class="credential-list">
          {#each filteredCredentials as cred (cred.id)}
            <li>
              <button
                class="credential-card"
                class:selected={selectedId === cred.id}
                onclick={() => selectCredential(cred.id)}
              >
                <span class="card-label">{cred.label}</span>
                <span class="card-badges">
                  <span class="badge badge-type">{typeBadgeLabel(cred.credential_type)}</span>
                  <span class="badge badge-status" class:inactive={cred.status !== 'active'}>
                    {cred.status}
                  </span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/snippet}

    {#snippet detail()}
      {#if !selectedCredential && !editing}
        <EmptyPanel message="Select a credential or create a new one." />
      {:else}
        <div class="editor-content">
          <div class="editor-header">
            <h3>{editing && !selectedId ? 'New Credential' : editing ? 'Edit Credential' : 'Credential Details'}</h3>
            {#if !editing && selectedCredential}
              <button class="btn btn-ghost" onclick={startEditing}>Edit</button>
            {/if}
          </div>

          {#if editing && !selectedId}
            <div class="form-group">
              <label for="cred-type">Credential Type</label>
              <select id="cred-type" bind:value={formType} class="form-input">
                {#each CREDENTIAL_TYPES as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>
          {:else}
            <div class="form-group">
              <span class="form-label-text">Type</span>
              <span class="type-display">{typeBadgeLabel(formType)}</span>
            </div>
          {/if}

          <div class="form-group">
            <label for="cred-label">Label <span class="required">*</span></label>
            <input id="cred-label" type="text" bind:value={formLabel} class="form-input"
                   placeholder="e.g. Top Secret / SCI" disabled={!editing} />
          </div>

          <div class="form-group">
            <label for="cred-status">Status</label>
            <select id="cred-status" bind:value={formStatus} disabled={!editing} class="form-input">
              {#each STATUS_OPTIONS as opt}
                <option value={opt}>{opt}</option>
              {/each}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="cred-issued">Issued Date</label>
              <input id="cred-issued" type="date" bind:value={formIssuedDate} disabled={!editing} class="form-input" />
            </div>
            <div class="form-group">
              <label for="cred-expiry">Expiry Date</label>
              <input id="cred-expiry" type="date" bind:value={formExpiryDate} disabled={!editing} class="form-input" />
            </div>
          </div>

          <!-- Type-specific detail fields -->
          {#if formType === 'clearance'}
            <fieldset class="detail-section">
              <legend>Clearance Details</legend>
              <div class="form-group">
                <label for="clr-level">Level</label>
                <select id="clr-level" bind:value={formLevel} disabled={!editing} class="form-input">
                  {#each CLEARANCE_LEVELS as lvl}
                    <option value={lvl}>{lvl.replace(/_/g, ' ')}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group">
                <label for="clr-poly">Polygraph</label>
                <select id="clr-poly" bind:value={formPolygraph} disabled={!editing} class="form-input">
                  <option value={null}>None</option>
                  {#each CLEARANCE_POLYGRAPHS as p}
                    <option value={p}>{p.replace(/_/g, ' ')}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group">
                <label for="clr-type">Type</label>
                <select id="clr-type" bind:value={formClearanceType} disabled={!editing} class="form-input">
                  {#each CLEARANCE_TYPES as t}
                    <option value={t}>{t}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group">
                <span class="form-label-text">Access Programs</span>
                <div class="checkbox-list">
                  {#each ACCESS_PROGRAMS as prog}
                    <label class="checkbox-item">
                      <input type="checkbox" checked={formAccessPrograms.has(prog)}
                             onchange={() => toggleAccessProgram(prog)} disabled={!editing} />
                      <span>{prog.toUpperCase()}</span>
                    </label>
                  {/each}
                </div>
              </div>
            </fieldset>
          {:else if formType === 'drivers_license'}
            <fieldset class="detail-section">
              <legend>License Details</legend>
              <div class="form-group">
                <label for="dl-class">Class</label>
                <input id="dl-class" type="text" bind:value={formDlClass} disabled={!editing} class="form-input" placeholder="e.g. A, B, C" />
              </div>
              <div class="form-group">
                <label for="dl-state">State</label>
                <input id="dl-state" type="text" bind:value={formDlState} disabled={!editing} class="form-input" placeholder="e.g. VA" />
              </div>
              <div class="form-group">
                <label for="dl-endorsements">Endorsements (comma-separated)</label>
                <input id="dl-endorsements" type="text" bind:value={formEndorsements} disabled={!editing} class="form-input" placeholder="e.g. hazmat, motorcycle" />
              </div>
            </fieldset>
          {:else if formType === 'bar_admission'}
            <fieldset class="detail-section">
              <legend>Bar Admission Details</legend>
              <div class="form-group">
                <label for="bar-jurisdiction">Jurisdiction</label>
                <input id="bar-jurisdiction" type="text" bind:value={formJurisdiction} disabled={!editing} class="form-input" placeholder="e.g. Virginia" />
              </div>
              <div class="form-group">
                <label for="bar-number">Bar Number</label>
                <input id="bar-number" type="text" bind:value={formBarNumber} disabled={!editing} class="form-input" placeholder="Optional" />
              </div>
            </fieldset>
          {:else if formType === 'medical_license'}
            <fieldset class="detail-section">
              <legend>Medical License Details</legend>
              <div class="form-group">
                <label for="med-type">License Type</label>
                <input id="med-type" type="text" bind:value={formLicenseType} disabled={!editing} class="form-input" placeholder="e.g. MD, DO, RN" />
              </div>
              <div class="form-group">
                <label for="med-state">State</label>
                <input id="med-state" type="text" bind:value={formMedState} disabled={!editing} class="form-input" placeholder="e.g. VA" />
              </div>
              <div class="form-group">
                <label for="med-number">License Number</label>
                <input id="med-number" type="text" bind:value={formLicenseNumber} disabled={!editing} class="form-input" placeholder="Optional" />
              </div>
            </fieldset>
          {/if}

          {#if editing}
            <div class="editor-actions">
              <button class="btn btn-primary" onclick={saveCredential} disabled={saving}>
                {saving ? 'Saving...' : (selectedId ? 'Save' : 'Create')}
              </button>
              <button class="btn btn-ghost" onclick={() => { editing = false; if (!selectedId) selectedId = null }}>
                Cancel
              </button>
            </div>
          {:else if selectedId}
            <div class="editor-actions">
              <button class="btn btn-danger" onclick={deleteCredential}>Delete</button>
            </div>
          {/if}
        </div>
      {/if}
    {/snippet}
  </SplitPanel>
</div>

<style>
  .credentials-page {
    height: 100%;
  }

  .credential-list {
    list-style: none;
    padding: var(--space-2) 0;
  }

  .credential-list li {
    padding: 0 var(--space-3);
    margin-bottom: var(--space-1);
  }

  .credential-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.6rem 0.85rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.12s;
    gap: 0.5rem;
  }

  .credential-card:hover { background: var(--color-surface-raised); }
  .credential-card.selected {
    background: var(--color-primary-subtle);
    border-left: 3px solid var(--color-primary);
    padding-left: calc(0.85rem - 3px);
  }

  .card-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .card-badges {
    display: flex;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .badge {
    display: inline-block;
    padding: 0.1em 0.4em;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .badge-type {
    background: var(--color-info-subtle);
    color: var(--color-info-text);
  }

  .badge-status {
    background: var(--color-success-subtle);
    color: var(--color-success-text);
  }

  .badge-status.inactive {
    background: var(--color-warning-subtle);
    color: var(--color-warning-text);
  }

  .editor-content {
    max-width: 520px;
    padding: 1.5rem;
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  .editor-header h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label, .form-label-text {
    display: block;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    margin-bottom: 0.3rem;
  }

  .required { color: var(--color-danger); }

  .form-input {
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    color: var(--text-primary);
    background: var(--color-surface);
    font-family: inherit;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }

  .form-input:disabled {
    background: var(--color-surface-raised);
    color: var(--text-muted);
    cursor: default;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .type-display {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }

  .detail-section {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .detail-section legend {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    padding: 0 0.5rem;
  }

  .checkbox-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-primary);
    cursor: pointer;
  }

  .checkbox-item input[type='checkbox'] {
    margin: 0;
    cursor: pointer;
  }

  .editor-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }
</style>
