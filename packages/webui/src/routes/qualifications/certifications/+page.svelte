<!--
  Certifications page — split-panel CRUD with skill tagging.

  Phase 87 T87.3. Lists certifications with their linked skills, provides
  a detail form with skill picker for keyword linking.

  Follows ui-shared-components.md rules:
  - SplitPanel, ListPanelHeader, EmptyPanel, ListSearchInput from $lib/components
  - Global .btn classes for all buttons
-->
<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { LoadingSpinner, SplitPanel, ListPanelHeader, EmptyPanel, ListSearchInput } from '$lib/components'
  import type { CertificationWithSkills, Skill } from '@forge/sdk'

  let certifications = $state<CertificationWithSkills[]>([])
  let allSkills = $state<Skill[]>([])
  let selectedId = $state<string | null>(null)
  let searchQuery = $state('')
  let loading = $state(true)
  let editing = $state(false)
  let saving = $state(false)

  // Form fields
  let formName = $state('')
  let formIssuer = $state('')
  let formDateEarned = $state('')
  let formExpiryDate = $state('')
  let formCredentialId = $state('')
  let formCredentialUrl = $state('')

  // Skill picker
  let skillSearch = $state('')
  let showSkillDropdown = $state(false)

  let filteredCerts = $derived.by(() => {
    if (!searchQuery.trim()) return certifications
    const q = searchQuery.toLowerCase()
    return certifications.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.issuer?.toLowerCase().includes(q) ?? false)
    )
  })

  let selectedCert = $derived(certifications.find(c => c.id === selectedId) ?? null)

  let linkedSkills = $derived(selectedCert?.skills ?? [])

  let filteredSkillCandidates = $derived.by(() => {
    if (!skillSearch.trim()) return []
    const q = skillSearch.toLowerCase()
    const linkedIds = new Set(linkedSkills.map(s => s.id))
    return allSkills
      .filter(s => !linkedIds.has(s.id) && s.name.toLowerCase().includes(q))
      .slice(0, 10)
  })

  let canCreateSkill = $derived.by(() => {
    if (!skillSearch.trim()) return false
    const q = skillSearch.trim().toLowerCase()
    return !allSkills.some(s => s.name.toLowerCase() === q)
  })

  /** Derive expiry-based display status. */
  function displayStatus(cert: CertificationWithSkills): string {
    if (!cert.expiry_date) return 'active'
    return new Date(cert.expiry_date) < new Date() ? 'expired' : 'active'
  }

  $effect(() => { loadAll() })

  $effect(() => {
    if (selectedCert && !editing) {
      formName = selectedCert.name
      formIssuer = selectedCert.issuer ?? ''
      formDateEarned = selectedCert.date_earned ?? ''
      formExpiryDate = selectedCert.expiry_date ?? ''
      formCredentialId = selectedCert.credential_id ?? ''
      formCredentialUrl = selectedCert.credential_url ?? ''
    }
  })

  async function loadAll() {
    loading = true
    const [certsRes, skillsRes] = await Promise.all([
      forge.certifications.list(),
      forge.skills.list({ limit: 500 }),
    ])
    if (certsRes.ok) certifications = certsRes.data
    else addToast({ message: friendlyError(certsRes.error, 'Failed to load certifications'), type: 'error' })
    if (skillsRes.ok) allSkills = skillsRes.data
    loading = false
  }

  function startNew() {
    selectedId = null
    editing = true
    formName = ''
    formIssuer = ''
    formDateEarned = ''
    formExpiryDate = ''
    formCredentialId = ''
    formCredentialUrl = ''
  }

  function selectCert(id: string) {
    editing = false
    selectedId = id
  }

  function startEditing() { editing = true }

  async function saveCert() {
    if (!formName.trim()) {
      addToast({ message: 'Name is required', type: 'error' })
      return
    }
    saving = true

    if (editing && !selectedId) {
      const res = await forge.certifications.create({
        name: formName.trim(),
        issuer: formIssuer || undefined,
        date_earned: formDateEarned || undefined,
        expiry_date: formExpiryDate || undefined,
        credential_id: formCredentialId || undefined,
        credential_url: formCredentialUrl || undefined,
      })
      if (res.ok) {
        // Reload to get the WithSkills variant
        await loadAll()
        selectedId = res.data.id
        editing = false
        addToast({ message: 'Certification created', type: 'success' })
      } else {
        addToast({ message: friendlyError(res.error, 'Failed to create'), type: 'error' })
      }
    } else if (selectedId) {
      const res = await forge.certifications.update(selectedId, {
        name: formName.trim(),
        issuer: formIssuer || null,
        date_earned: formDateEarned || null,
        expiry_date: formExpiryDate || null,
        credential_id: formCredentialId || null,
        credential_url: formCredentialUrl || null,
      })
      if (res.ok) {
        await loadAll()
        editing = false
        addToast({ message: 'Certification updated', type: 'success' })
      } else {
        addToast({ message: friendlyError(res.error, 'Failed to update'), type: 'error' })
      }
    }
    saving = false
  }

  async function deleteCert() {
    if (!selectedId) return
    const res = await forge.certifications.delete(selectedId)
    if (res.ok) {
      certifications = certifications.filter(c => c.id !== selectedId)
      selectedId = null
      editing = false
      addToast({ message: 'Certification deleted', type: 'success' })
    } else {
      addToast({ message: friendlyError(res.error, 'Failed to delete'), type: 'error' })
    }
  }

  // ── Skill picker ────────────────────────────────────────────────

  async function addExistingSkill(skill: Skill) {
    if (!selectedId) return
    const res = await forge.certifications.addSkill(selectedId, skill.id)
    if (res.ok) {
      certifications = certifications.map(c => c.id === selectedId ? res.data : c)
      skillSearch = ''
      showSkillDropdown = false
    } else {
      addToast({ message: friendlyError(res.error, 'Failed to add skill'), type: 'error' })
    }
  }

  async function createAndAddSkill() {
    if (!skillSearch.trim() || !selectedId) return
    const created = await forge.skills.create({ name: skillSearch.trim() })
    if (!created.ok) {
      addToast({ message: friendlyError(created.error, 'Failed to create skill'), type: 'error' })
      return
    }
    allSkills = [...allSkills, created.data]
    await addExistingSkill(created.data)
  }

  async function removeSkill(skillId: string) {
    if (!selectedId) return
    const res = await forge.certifications.removeSkill(selectedId, skillId)
    if (res.ok) {
      // Reload to refresh skills array
      const updated = await forge.certifications.get(selectedId)
      if (updated.ok) {
        certifications = certifications.map(c => c.id === selectedId ? updated.data : c)
      }
    } else {
      addToast({ message: friendlyError(res.error, 'Failed to remove skill'), type: 'error' })
    }
  }
</script>

<div class="certifications-page">
  <SplitPanel listWidth={320}>
    {#snippet list()}
      <ListPanelHeader title="Certifications" onNew={startNew} />
      <ListSearchInput bind:value={searchQuery} placeholder="Search certifications..." />

      {#if loading}
        <div style="display: flex; justify-content: center; padding: 3rem 1rem;">
          <LoadingSpinner size="md" message="Loading certifications..." />
        </div>
      {:else if filteredCerts.length === 0}
        <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: var(--text-sm);">
          {searchQuery ? 'No certifications match your search.' : 'No certifications yet. Create one.'}
        </div>
      {:else}
        <ul class="cert-list">
          {#each filteredCerts as cert (cert.id)}
            <li>
              <button
                class="cert-card"
                class:selected={selectedId === cert.id}
                onclick={() => selectCert(cert.id)}
              >
                <div class="card-main">
                  <span class="card-name">{cert.name}</span>
                  {#if cert.issuer}
                    <span class="card-issuer">{cert.issuer}</span>
                  {/if}
                </div>
                <span class="badge" class:expired={displayStatus(cert) === 'expired'}>
                  {displayStatus(cert)}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/snippet}

    {#snippet detail()}
      {#if !selectedCert && !editing}
        <EmptyPanel message="Select a certification or create a new one." />
      {:else}
        <div class="editor-content">
          <div class="editor-header">
            <h3>{editing && !selectedId ? 'New Certification' : editing ? 'Edit Certification' : 'Certification Details'}</h3>
            {#if !editing && selectedCert}
              <button class="btn btn-ghost" onclick={startEditing}>Edit</button>
            {/if}
          </div>

          <div class="form-group">
            <label for="cert-name">Name <span class="required">*</span></label>
            <input id="cert-name" type="text" bind:value={formName} class="form-input"
                   placeholder="e.g. AWS Solutions Architect Professional" disabled={!editing} />
          </div>

          <div class="form-group">
            <label for="cert-issuer">Issuer</label>
            <input id="cert-issuer" type="text" bind:value={formIssuer} class="form-input"
                   placeholder="e.g. Amazon Web Services" disabled={!editing} />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="cert-earned">Date Earned</label>
              <input id="cert-earned" type="date" bind:value={formDateEarned} disabled={!editing} class="form-input" />
            </div>
            <div class="form-group">
              <label for="cert-expiry">Expiry Date</label>
              <input id="cert-expiry" type="date" bind:value={formExpiryDate} disabled={!editing} class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label for="cert-cred-id">Credential ID</label>
            <input id="cert-cred-id" type="text" bind:value={formCredentialId} disabled={!editing} class="form-input"
                   placeholder="e.g. AWS-123456" />
          </div>

          <div class="form-group">
            <label for="cert-cred-url">Verification URL</label>
            <input id="cert-cred-url" type="text" bind:value={formCredentialUrl} disabled={!editing} class="form-input"
                   placeholder="e.g. https://verify.example.com/123" />
          </div>

          <!-- Skills section (only in view/non-new-edit mode) -->
          {#if selectedId}
            <div class="form-group">
              <span class="form-label-text">Skills</span>
              <div class="skill-pills">
                {#each linkedSkills as skill (skill.id)}
                  <span class="skill-pill">
                    {skill.name}
                    <button class="pill-remove" onclick={() => removeSkill(skill.id)} aria-label="Remove {skill.name}">&times;</button>
                  </span>
                {/each}
                {#if linkedSkills.length === 0}
                  <span class="empty-hint">No skills linked yet.</span>
                {/if}
              </div>
              <div class="skill-picker">
                <input
                  type="text"
                  class="form-input"
                  placeholder="Search or create skill..."
                  bind:value={skillSearch}
                  onfocus={() => showSkillDropdown = true}
                  onblur={() => setTimeout(() => showSkillDropdown = false, 200)}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' && canCreateSkill) {
                      e.preventDefault()
                      createAndAddSkill()
                    }
                  }}
                />
                {#if showSkillDropdown && (filteredSkillCandidates.length > 0 || canCreateSkill)}
                  <div class="skill-dropdown">
                    {#each filteredSkillCandidates as skill (skill.id)}
                      <button class="dropdown-item" onmousedown={() => addExistingSkill(skill)}>
                        {skill.name}
                        {#if skill.category}<span class="dropdown-cat">{skill.category}</span>{/if}
                      </button>
                    {/each}
                    {#if canCreateSkill}
                      <button class="dropdown-item create-item" onmousedown={createAndAddSkill}>
                        Create "{skillSearch.trim()}"
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          {#if editing}
            <div class="editor-actions">
              <button class="btn btn-primary" onclick={saveCert} disabled={saving}>
                {saving ? 'Saving...' : (selectedId ? 'Save' : 'Create')}
              </button>
              <button class="btn btn-ghost" onclick={() => { editing = false; if (!selectedId) selectedId = null }}>
                Cancel
              </button>
            </div>
          {:else if selectedId}
            <div class="editor-actions">
              <button class="btn btn-danger" onclick={deleteCert}>Delete</button>
            </div>
          {/if}
        </div>
      {/if}
    {/snippet}
  </SplitPanel>
</div>

<style>
  .certifications-page { height: 100%; }

  .cert-list { list-style: none; padding: var(--space-2) 0; }
  .cert-list li { padding: 0 var(--space-3); margin-bottom: var(--space-1); }

  .cert-card {
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
  .cert-card:hover { background: var(--color-surface-raised); }
  .cert-card.selected {
    background: var(--color-primary-subtle);
    border-left: 3px solid var(--color-primary);
    padding-left: calc(0.85rem - 3px);
  }

  .card-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .card-name {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .card-issuer {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .badge {
    display: inline-block;
    padding: 0.1em 0.4em;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    background: var(--color-success-subtle);
    color: var(--color-success-text);
    flex-shrink: 0;
  }
  .badge.expired {
    background: var(--color-danger-subtle);
    color: var(--color-danger-text);
  }

  .editor-content { max-width: 520px; padding: 1.5rem; }
  .editor-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1.25rem;
  }
  .editor-header h3 {
    font-size: var(--text-lg); font-weight: var(--font-semibold);
    color: var(--text-primary); margin: 0;
  }

  .form-group { margin-bottom: 1rem; }
  .form-group label, .form-label-text {
    display: block;
    font-size: var(--text-sm); font-weight: var(--font-medium);
    color: var(--text-secondary); margin-bottom: 0.3rem;
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

  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

  .skill-pills {
    display: flex; flex-wrap: wrap; gap: 0.35rem;
    min-height: 1.75rem; padding: 0.25rem 0;
  }
  .skill-pill {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.2em 0.55em;
    background: var(--color-info-subtle); color: var(--color-info-text);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm); font-weight: var(--font-medium);
  }
  .pill-remove {
    background: none; border: none; color: inherit;
    font-size: 1rem; line-height: 1; cursor: pointer;
    opacity: 0.6; padding: 0;
  }
  .pill-remove:hover { opacity: 1; }
  .empty-hint {
    font-size: var(--text-sm); color: var(--text-faint); font-style: italic;
  }

  .skill-picker { position: relative; }
  .skill-dropdown {
    position: absolute; top: 100%; left: 0; right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
    max-height: 200px; overflow-y: auto; z-index: 10;
    margin-top: 2px;
  }
  .dropdown-item {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 0.45rem 0.65rem;
    border: none; background: none;
    font-size: var(--text-sm); color: var(--text-secondary);
    cursor: pointer; text-align: left; font-family: inherit;
  }
  .dropdown-item:hover { background: var(--color-ghost); }
  .dropdown-cat { font-size: var(--text-xs); color: var(--text-faint); }
  .create-item {
    color: var(--color-primary); font-weight: var(--font-medium);
    border-top: 1px solid var(--color-border);
  }

  .editor-actions {
    display: flex; gap: 0.75rem; margin-top: 1.25rem;
    padding-top: 1rem; border-top: 1px solid var(--color-border);
  }
</style>
