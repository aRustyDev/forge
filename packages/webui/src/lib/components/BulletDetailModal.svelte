<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { StatusBadge, LoadingSpinner, ConfirmDialog } from '$lib/components'
  import DerivePerspectivesDialog from './DerivePerspectivesDialog.svelte'
  import type { Bullet, Skill, Source, Perspective } from '@forge/sdk'

  let { bulletId, onclose, onupdate }: {
    bulletId: string
    onclose: () => void
    onupdate: () => void
  } = $props()

  // ── State ────────────────────────────────────────────────────────────

  // Note: `forge.bullets.get()` returns `BulletWithRelations` in the SDK type but the
  // actual API response is `Bullet` (no `perspective_count`). The modal uses `Bullet`
  // state type, so this is handled correctly. `perspective_count` is derived from the
  // perspectives list length.
  let bullet = $state<Bullet | null>(null)
  let bulletSkills = $state<Skill[]>([])
  let bulletSources = $state<Array<Source & { is_primary: number }>>([])
  let perspectives = $state<Perspective[]>([])
  let loading = $state(true)
  let saving = $state(false)

  // Editable fields
  let editContent = $state('')
  let editNotes = $state('')
  let editDomain = $state<string | null>(null)
  let editTechnologies = $state<string[]>([])

  // Skill picker
  let allSkills = $state<Skill[]>([])
  let skillSearch = $state('')
  let showSkillDropdown = $state(false)

  // Technology input
  let newTechInput = $state('')

  // Derivation dialog
  let showDeriveDialog = $state(false)

  // Delete confirmation
  let showDeleteConfirm = $state(false)

  // Reject inline input
  let showRejectInput = $state(false)
  let rejectReason = $state('')

  // Domain dropdown
  let allDomains = $state<Array<{ id: string; name: string }>>([])

  // ── Derived ──────────────────────────────────────────────────────────

  let filteredSkills = $derived.by(() => {
    if (!skillSearch.trim()) return []
    const q = skillSearch.toLowerCase()
    const linkedIds = new Set(bulletSkills.map(s => s.id))
    return allSkills
      .filter(s => !linkedIds.has(s.id) && s.name.toLowerCase().includes(q))
      .slice(0, 10)
  })

  let canCreateSkill = $derived.by(() => {
    if (!skillSearch.trim()) return false
    const q = skillSearch.trim().toLowerCase()
    // Check if any existing skill matches case-insensitively
    return !allSkills.some(s => s.name.toLowerCase() === q)
  })

  // ── Data Loading ─────────────────────────────────────────────────────

  $effect(() => {
    loadAllData()
  })

  async function loadAllData() {
    loading = true

    const [bulletRes, skillsRes, sourcesRes, perspectivesRes, allSkillsRes, domainsRes] = await Promise.all([
      forge.bullets.get(bulletId),
      forge.bullets.listSkills(bulletId),
      forge.bullets.listSources(bulletId),
      forge.perspectives.list({ bullet_id: bulletId, limit: 200 }),
      forge.skills.list({ limit: 500 }),
      forge.domains.list({ limit: 200 }),
    ])

    if (bulletRes.ok) {
      bullet = bulletRes.data as unknown as Bullet
      editContent = bulletRes.data.content
      editNotes = (bulletRes.data as any).notes ?? ''
      editDomain = (bulletRes.data as any).domain
      editTechnologies = [...((bulletRes.data as any).technologies ?? [])]
    } else {
      addToast({ message: friendlyError(bulletRes.error, 'Failed to load bullet'), type: 'error' })
      onclose()
      return
    }

    if (skillsRes.ok) bulletSkills = skillsRes.data
    if (sourcesRes.ok) bulletSources = sourcesRes.data
    if (perspectivesRes.ok) perspectives = perspectivesRes.data
    if (allSkillsRes.ok) allSkills = allSkillsRes.data
    if (domainsRes.ok) allDomains = domainsRes.data

    loading = false
  }

  // ── Save ──────────────────────────────────────────────────────────────

  async function save() {
    if (!bullet) return
    saving = true

    const res = await forge.bullets.update(bulletId, {
      content: editContent,
      notes: editNotes || null,
      domain: editDomain,
      technologies: editTechnologies,
    })

    if (res.ok) {
      bullet = res.data
      addToast({ message: 'Bullet saved', type: 'success' })
      onupdate()
    } else {
      addToast({ message: friendlyError(res.error, 'Failed to save'), type: 'error' })
    }

    saving = false
  }

  // ── Status Transitions ───────────────────────────────────────────────

  async function submitForReview() {
    const res = await forge.bullets.submit(bulletId)
    if (res.ok) {
      bullet = res.data
      addToast({ message: 'Submitted for review', type: 'success' })
      onupdate()
    } else {
      addToast({ message: friendlyError(res.error, 'Submit failed'), type: 'error' })
    }
  }

  async function approve() {
    const res = await forge.bullets.approve(bulletId)
    if (res.ok) {
      bullet = res.data
      addToast({ message: 'Bullet approved', type: 'success' })
      onupdate()
    } else {
      addToast({ message: friendlyError(res.error, 'Approve failed'), type: 'error' })
    }
  }

  async function submitReject() {
    if (!rejectReason.trim()) {
      addToast({ message: 'Please provide a rejection reason.', type: 'error' })
      return
    }
    const res = await forge.bullets.reject(bulletId, { rejection_reason: rejectReason })
    if (res.ok) {
      bullet = res.data
      showRejectInput = false
      rejectReason = ''
      addToast({ message: 'Bullet rejected', type: 'success' })
      onupdate()
    } else {
      addToast({ message: friendlyError(res.error, 'Reject failed'), type: 'error' })
    }
  }

  async function reopen() {
    const res = await forge.bullets.reopen(bulletId)
    if (res.ok) {
      bullet = res.data
      addToast({ message: 'Bullet reopened', type: 'success' })
      onupdate()
    } else {
      addToast({ message: friendlyError(res.error, 'Reopen failed'), type: 'error' })
    }
  }

  // ── Skills ────────────────────────────────────────────────────────────

  async function addExistingSkill(skill: Skill) {
    const res = await forge.bullets.addSkill(bulletId, { skill_id: skill.id })
    if (res.ok) {
      bulletSkills = [...bulletSkills, res.data]
      skillSearch = ''
      showSkillDropdown = false
    } else {
      addToast({ message: friendlyError(res.error, 'Failed to add skill'), type: 'error' })
    }
  }

  async function createAndAddSkill() {
    if (!skillSearch.trim()) return
    const res = await forge.bullets.addSkill(bulletId, { name: skillSearch.trim() })
    if (res.ok) {
      bulletSkills = [...bulletSkills, res.data]
      // Also add to allSkills so it appears in future searches
      if (!allSkills.some(s => s.id === res.data.id)) {
        allSkills = [...allSkills, res.data]
      }
      skillSearch = ''
      showSkillDropdown = false
    } else {
      addToast({ message: friendlyError(res.error, 'Failed to create skill'), type: 'error' })
    }
  }

  async function removeSkill(skillId: string) {
    const res = await forge.bullets.removeSkill(bulletId, skillId)
    if (res.ok) {
      bulletSkills = bulletSkills.filter(s => s.id !== skillId)
    } else {
      addToast({ message: friendlyError(res.error, 'Failed to remove skill'), type: 'error' })
    }
  }

  // ── Technologies ──────────────────────────────────────────────────────

  function addTechnology() {
    const tech = newTechInput.toLowerCase().trim()
    if (tech && !editTechnologies.includes(tech)) {
      editTechnologies = [...editTechnologies, tech]
    }
    newTechInput = ''
  }

  function removeTechnology(tech: string) {
    editTechnologies = editTechnologies.filter(t => t !== tech)
  }

  function handleTechKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTechnology()
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────

  async function deleteBullet() {
    const res = await forge.bullets.delete(bulletId)
    if (res.ok) {
      addToast({ message: 'Bullet deleted', type: 'success' })
      onupdate()
      onclose()
    } else {
      showDeleteConfirm = false
      if (res.error.code === 'CONFLICT') {
        addToast({ message: 'Cannot delete bullet with existing perspectives. Delete its perspectives first.', type: 'error' })
      } else {
        addToast({ message: friendlyError(res.error, 'Delete failed'), type: 'error' })
      }
    }
  }

  // ── Derive callback ───────────────────────────────────────────────────

  async function onDeriveComplete() {
    // Refresh perspectives list
    const res = await forge.perspectives.list({ bullet_id: bulletId, limit: 200 })
    if (res.ok) perspectives = res.data
    onupdate()
  }

  // ── Keyboard ──────────────────────────────────────────────────────────

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      // If a sub-dialog is open, let it handle Escape
      if (showDeriveDialog || showDeleteConfirm) return
      onclose()
    }
  }

  function truncateTitle(text: string, max: number = 60): string {
    if (text.length <= max) return text
    return text.slice(0, max) + '...'
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Bullet Details">
    {#if loading}
      <div class="loading-container">
        <LoadingSpinner size="lg" message="Loading bullet..." />
      </div>
    {:else if bullet}
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <h3>{truncateTitle(bullet.content)}</h3>
          <StatusBadge status={bullet.status} />
        </div>
        <button class="close-btn" onclick={onclose}>&times;</button>
      </div>

      <div class="modal-body">
        <!-- Status Actions -->
        <div class="status-actions">
          {#if bullet.status === 'draft'}
            <button class="btn btn-submit" onclick={submitForReview}>Submit for Review</button>
          {/if}
          {#if bullet.status === 'in_review'}
            <button class="btn btn-approve" onclick={approve}>Approve</button>
            {#if showRejectInput}
              <div class="reject-inline">
                <input
                  type="text"
                  class="reject-input"
                  placeholder="Rejection reason..."
                  bind:value={rejectReason}
                  onkeydown={(e) => { if (e.key === 'Enter') submitReject() }}
                />
                <button class="btn btn-danger-sm" onclick={submitReject}>Confirm</button>
                <button class="btn btn-ghost-sm" onclick={() => { showRejectInput = false; rejectReason = '' }}>Cancel</button>
              </div>
            {:else}
              <button class="btn btn-reject" onclick={() => showRejectInput = true}>Reject</button>
            {/if}
          {/if}
          {#if bullet.status === 'rejected'}
            <button class="btn btn-reopen" onclick={reopen}>Reopen</button>
            {#if bullet.rejection_reason}
              <span class="rejection-reason">Rejected: {bullet.rejection_reason}</span>
            {/if}
          {/if}
        </div>

        <!-- Content -->
        <div class="field-group">
          <label class="field-label" for="bullet-content">Content</label>
          <textarea
            id="bullet-content"
            class="field-textarea content-textarea"
            bind:value={editContent}
            rows="4"
          ></textarea>
        </div>

        <!-- Domain -->
        <div class="field-group">
          <label class="field-label" for="bullet-domain">Domain</label>
          <select id="bullet-domain" class="field-select" bind:value={editDomain}>
            <option value={null}>-- No domain --</option>
            {#each allDomains as domain}
              <option value={domain.name}>{domain.name}</option>
            {/each}
          </select>
        </div>

        <!-- Skills -->
        <div class="field-group">
          <label class="field-label">Skills</label>
          <div class="tag-pills">
            {#each bulletSkills as skill (skill.id)}
              <span class="tag-pill skill-pill">
                {skill.name}
                <button class="pill-remove" onclick={() => removeSkill(skill.id)}>&times;</button>
              </span>
            {/each}
          </div>
          <div class="skill-picker">
            <input
              type="text"
              class="skill-search"
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
            {#if showSkillDropdown && (filteredSkills.length > 0 || canCreateSkill)}
              <div class="skill-dropdown">
                {#each filteredSkills as skill (skill.id)}
                  <button class="dropdown-item" onmousedown={() => addExistingSkill(skill)}>
                    {skill.name}
                    {#if skill.category}
                      <span class="dropdown-category">{skill.category}</span>
                    {/if}
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

        <!-- Technologies -->
        <div class="field-group">
          <label class="field-label">Technologies</label>
          <div class="tag-pills">
            {#each editTechnologies as tech}
              <span class="tag-pill tech-pill">
                {tech}
                <button class="pill-remove" onclick={() => removeTechnology(tech)}>&times;</button>
              </span>
            {/each}
          </div>
          <input
            type="text"
            class="tech-input"
            placeholder="Type technology and press Enter..."
            bind:value={newTechInput}
            onkeydown={handleTechKeydown}
          />
        </div>

        <!-- Sources (read-only) -->
        <div class="field-group">
          <label class="field-label">Sources</label>
          {#if bulletSources.length === 0}
            <p class="empty-text">No sources linked</p>
          {:else}
            <div class="source-list">
              {#each bulletSources as src}
                <div class="source-item">
                  {#if src.is_primary}
                    <span class="primary-star" title="Primary source">&#9733;</span>
                  {/if}
                  <span class="source-title">{src.title}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Notes -->
        <div class="field-group">
          <label class="field-label" for="bullet-notes">Notes</label>
          <textarea
            id="bullet-notes"
            class="field-textarea"
            bind:value={editNotes}
            rows="3"
            placeholder="Add notes..."
          ></textarea>
        </div>

        <!-- Perspectives -->
        <div class="field-group">
          <label class="field-label">Perspectives ({perspectives.length})</label>
          {#if perspectives.length === 0}
            <p class="empty-text">No perspectives derived yet</p>
          {:else}
            <div class="perspective-list">
              {#each perspectives as p (p.id)}
                <div class="perspective-item">
                  <div class="perspective-meta">
                    {#if p.target_archetype}
                      <span class="meta-tag archetype">{p.target_archetype}</span>
                    {/if}
                    {#if p.domain}
                      <span class="meta-tag domain">{p.domain}</span>
                    {/if}
                    <span class="meta-tag framing">{p.framing}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p class="perspective-content">{p.content}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <div class="footer-left">
          <button class="btn btn-derive" onclick={() => showDeriveDialog = true}>
            Derive Perspectives
          </button>
        </div>
        <div class="footer-right">
          <button class="btn btn-delete" onclick={() => showDeleteConfirm = true}>Delete</button>
          <button class="btn btn-save" onclick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Derive Dialog -->
{#if showDeriveDialog}
  <DerivePerspectivesDialog
    {bulletId}
    onclose={() => showDeriveDialog = false}
    onderive={onDeriveComplete}
  />
{/if}

<!-- Delete Confirmation -->
<ConfirmDialog
  open={showDeleteConfirm}
  title="Delete Bullet"
  message="Are you sure you want to delete this bullet? This cannot be undone."
  confirmLabel="Delete"
  onconfirm={deleteBullet}
  oncancel={() => showDeleteConfirm = false}
/>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: #fff;
    border-radius: 10px;
    width: 90%;
    max-width: 640px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  }

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 4rem 0;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
    gap: 0.75rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .modal-header h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.3rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0.2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .close-btn:hover { color: #374151; }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
  }

  .status-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .reject-inline {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 1;
  }

  .reject-input {
    flex: 1;
    padding: 0.3rem 0.5rem;
    border: 1px solid #fca5a5;
    border-radius: 4px;
    font-size: 0.78rem;
    color: #1a1a1a;
  }

  .reject-input:focus {
    outline: none;
    border-color: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
  }

  .rejection-reason {
    font-size: 0.75rem;
    color: #ef4444;
    font-style: italic;
  }

  .field-group {
    margin-bottom: 1rem;
  }

  .field-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 0.3rem;
  }

  .field-textarea {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.82rem;
    color: #374151;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    min-height: 60px;
  }

  .content-textarea {
    min-height: 80px;
  }

  .field-textarea:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .field-select {
    width: 100%;
    padding: 0.45rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.82rem;
    color: #374151;
    background: #fff;
    font-family: inherit;
  }

  .field-select:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.35rem;
  }

  .tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.15em 0.45em;
    border-radius: 3px;
    font-size: 0.72rem;
    font-weight: 500;
  }

  .skill-pill {
    background: #dbeafe;
    color: #1e40af;
  }

  .tech-pill {
    background: #ede9fe;
    color: #5b21b6;
  }

  .pill-remove {
    background: none;
    border: none;
    font-size: 0.85rem;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    opacity: 0.6;
    padding: 0;
  }

  .pill-remove:hover { opacity: 1; }

  .skill-picker {
    position: relative;
  }

  .skill-search,
  .tech-input {
    width: 100%;
    padding: 0.4rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #1a1a1a;
  }

  .skill-search:focus,
  .tech-input:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .skill-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
    margin-top: 2px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.45rem 0.65rem;
    border: none;
    background: none;
    font-size: 0.8rem;
    color: #374151;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }

  .dropdown-item:hover {
    background: #f3f4f6;
  }

  .dropdown-category {
    font-size: 0.68rem;
    color: #9ca3af;
  }

  .create-item {
    color: #6c63ff;
    font-weight: 500;
    border-top: 1px solid #e5e7eb;
  }

  .source-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .source-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.82rem;
    color: #374151;
    padding: 0.3rem 0.5rem;
    background: #f9fafb;
    border-radius: 4px;
  }

  .primary-star {
    color: #f59e0b;
    font-size: 0.9rem;
  }

  .source-title {
    flex: 1;
  }

  .empty-text {
    font-size: 0.78rem;
    color: #9ca3af;
    font-style: italic;
  }

  .perspective-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .perspective-item {
    padding: 0.5rem 0.65rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  .perspective-meta {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
    align-items: center;
  }

  .meta-tag {
    display: inline-block;
    padding: 0.1em 0.4em;
    border-radius: 3px;
    font-size: 0.68rem;
    font-weight: 500;
  }

  .meta-tag.archetype { background: #eef2ff; color: #4f46e5; }
  .meta-tag.domain { background: #d1fae5; color: #065f46; }
  .meta-tag.framing { background: #fefce8; color: #a16207; }

  .perspective-content {
    font-size: 0.78rem;
    color: #4b5563;
    line-height: 1.4;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #e5e7eb;
  }

  .footer-left {
    display: flex;
    gap: 0.5rem;
  }

  .footer-right {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.4rem 0.8rem;
    border: none;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-save { background: #6c63ff; color: #fff; }
  .btn-save:hover:not(:disabled) { background: #5a52e0; }

  .btn-derive { background: #eef2ff; color: #4f46e5; }
  .btn-derive:hover { background: #dbeafe; }

  .btn-delete { background: #fee2e2; color: #dc2626; }
  .btn-delete:hover { background: #fecaca; }

  .btn-submit { background: #dbeafe; color: #1e40af; }
  .btn-submit:hover { background: #bfdbfe; }

  .btn-approve { background: #d1fae5; color: #065f46; }
  .btn-approve:hover { background: #bbf7d0; }

  .btn-reject { background: #fee2e2; color: #dc2626; }
  .btn-reject:hover { background: #fecaca; }

  .btn-reopen { background: #fef3c7; color: #92400e; }
  .btn-reopen:hover { background: #fde68a; }

  .btn-danger-sm {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    background: #ef4444;
    color: #fff;
  }

  .btn-danger-sm:hover { background: #dc2626; }

  .btn-ghost-sm {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    background: transparent;
    color: #6b7280;
  }

  .btn-ghost-sm:hover { color: #374151; background: #f3f4f6; }
</style>
