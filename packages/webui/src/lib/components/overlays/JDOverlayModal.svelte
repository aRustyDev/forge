<!--
  JDOverlayModal.svelte — Prop-driven read-only JD detail overlay.

  Wraps the base Modal primitive. Fetches canonical JD data + skills on open.
  Accepts optional initialData so callers with pre-fetched fields (e.g. a
  JDLink row on the resume page) can paint the modal instantly while the
  canonical fetch runs in the background.

  State machine:
    closed → fetching → loaded | error → closed
    'fetching' has two render variants: placeholder (if initialData provided)
    or spinner (otherwise).

  Usage (direct):
    <JDOverlayModal
      open={isOpen}
      jdId={selectedId}
      initialData={{ title, status, organization_name }}
      onClose={() => isOpen = false}
    />

  Usage (via singleton): mount <JDOverlayHost /> once in +layout.svelte and
  call openJDOverlay(id, data) from any consumer.
-->
<script lang="ts">
  import { goto } from '$app/navigation'
  import Modal from '$lib/components/Modal.svelte'
  import { forge, friendlyError } from '$lib/sdk'
  import type { JobDescriptionWithOrg, Skill } from '@forge/sdk'
  import type { JDOverlayInitialData } from './jdOverlay.svelte'

  // JD status → accent color. Duplicated from gantt-utils.ts intentionally;
  // the overlays module should not depend on the charts module. If a future
  // phase introduces a shared $lib/constants module, both sites should migrate.
  const STATUS_COLORS: Record<string, string> = {
    discovered:   '#a5b4fc',
    analyzing:    '#60a5fa',
    applying:     '#fbbf24',
    applied:      '#818cf8',
    interviewing: '#a78bfa',
    offered:      '#22c55e',
    rejected:     '#f87171',
    withdrawn:    '#fb923c',
    closed:       '#d1d5db',
  }

  let {
    open,
    jdId,
    initialData,
    onClose,
    size = 'lg',
  }: {
    open: boolean
    jdId: string | null
    initialData?: JDOverlayInitialData
    onClose: () => void
    size?: 'lg' | 'xl'
  } = $props()

  // --- Fetch state ---
  let state = $state<'idle' | 'fetching' | 'loaded' | 'error'>('idle')
  let canonical = $state<JobDescriptionWithOrg | null>(null)
  let skills = $state<Skill[] | null>(null)
  let skillsError = $state<string | null>(null)
  let jdError = $state<string | null>(null)

  // Track which jdId we last fetched for so we can re-fetch when it changes.
  let fetchedId = $state<string | null>(null)

  $effect(() => {
    if (open && jdId && jdId !== fetchedId) {
      loadData(jdId)
    } else if (!open) {
      // Reset when closed so the next open starts fresh.
      state = 'idle'
      canonical = null
      skills = null
      skillsError = null
      jdError = null
      fetchedId = null
    }
  })

  async function loadData(id: string) {
    state = 'fetching'
    canonical = null
    skills = null
    skillsError = null
    jdError = null
    fetchedId = id

    const [jdResult, skillsResult] = await Promise.all([
      forge.jobDescriptions.get(id),
      forge.jobDescriptions.listSkills(id),
    ])

    if (!jdResult.ok) {
      jdError = friendlyError(jdResult.error)
      state = 'error'
      return
    }

    canonical = jdResult.data
    if (!skillsResult.ok) {
      skillsError = 'Failed to load skills'
      skills = []
    } else {
      skills = skillsResult.data
    }
    state = 'loaded'
  }

  function retry() {
    if (jdId) loadData(jdId)
  }

  function handleOpenFullPage() {
    if (!jdId) return
    goto(`/opportunities/job-descriptions?selected=${jdId}`)
    onClose()
  }

  // --- Derived display values (prefer canonical, fall back to initialData) ---

  let displayTitle = $derived(canonical?.title ?? initialData?.title ?? '')
  let displayOrg = $derived(canonical?.organization_name ?? initialData?.organization_name ?? null)
  let displayStatus = $derived(canonical?.status ?? initialData?.status ?? null)
  let displayLocation = $derived(canonical?.location ?? initialData?.location ?? null)
  let displaySalaryRange = $derived(canonical?.salary_range ?? initialData?.salary_range ?? null)
  let displaySalaryMin = $derived(canonical?.salary_min ?? null)
  let displaySalaryMax = $derived(canonical?.salary_max ?? null)
  let displayUrl = $derived(canonical?.url ?? null)
  let displayRawText = $derived(canonical?.raw_text ?? '')
  let displayNotes = $derived(canonical?.notes ?? null)
  let displayCreatedAt = $derived(canonical?.created_at ?? null)
  let displayUpdatedAt = $derived(canonical?.updated_at ?? null)
  let displaySkills = $derived(skills ?? initialData?.skills ?? [])

  let salaryLabel = $derived.by(() => {
    if (displaySalaryRange) return displaySalaryRange
    if (displaySalaryMin != null && displaySalaryMax != null) {
      return `$${Math.round(displaySalaryMin / 1000)}k–$${Math.round(displaySalaryMax / 1000)}k`
    }
    return null
  })

  let hasMetadataStrip = $derived(
    displayLocation !== null || salaryLabel !== null || displayUrl !== null
  )

  let statusColor = $derived(displayStatus ? STATUS_COLORS[displayStatus] ?? '#9ca3af' : '#9ca3af')

  function formatDate(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Limit skills shown inline; count overflow as "+N more" chip.
  const SKILL_LIMIT = 6
  let visibleSkills = $derived(displaySkills.slice(0, SKILL_LIMIT))
  let overflowSkillCount = $derived(Math.max(0, displaySkills.length - SKILL_LIMIT))
</script>

<Modal {open} {onClose} {size}>
  {#snippet header()}
    <div class="jd-overlay-header">
      <div class="jd-overlay-header-top">
        {#if displayStatus}
          <span
            class="jd-overlay-status-badge"
            style:background={statusColor}
          >{displayStatus}</span>
        {/if}
        <h3 class="jd-overlay-title">{displayTitle || 'Loading…'}</h3>
        <button
          type="button"
          class="jd-overlay-close-x"
          onclick={onClose}
          aria-label="Close"
        >&times;</button>
      </div>
      {#if displayOrg}
        <div class="jd-overlay-org">{displayOrg}</div>
      {/if}
    </div>
  {/snippet}

  {#snippet body()}
    {#if state === 'fetching' && !initialData}
      <div class="jd-overlay-spinner" aria-busy="true">Loading…</div>
    {:else if state === 'error'}
      <div class="jd-overlay-error">
        <p class="jd-overlay-error-message">Failed to load job description</p>
        {#if jdError}<p class="jd-overlay-error-detail">{jdError}</p>{/if}
        <button type="button" class="jd-overlay-retry" onclick={retry}>Retry</button>
      </div>
    {:else}
      {#if hasMetadataStrip}
        <div class="jd-overlay-metadata-strip">
          {#if displayLocation}
            <span class="jd-overlay-meta-item">📍 {displayLocation}</span>
          {/if}
          {#if salaryLabel}
            <span class="jd-overlay-meta-item">💰 {salaryLabel}</span>
          {/if}
          {#if displayUrl}
            <a
              class="jd-overlay-meta-item jd-overlay-url"
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
            >🔗 Source</a>
          {/if}
        </div>
      {/if}

      {#if displaySkills.length > 0 || skillsError}
        <section class="jd-overlay-section">
          <h4 class="jd-overlay-section-title">Skills</h4>
          {#if skillsError}
            <p class="jd-overlay-skills-error">{skillsError}</p>
          {:else}
            <div class="jd-overlay-skill-tags">
              {#each visibleSkills as skill (skill.id)}
                <span class="jd-overlay-skill-tag">{skill.name}</span>
              {/each}
              {#if overflowSkillCount > 0}
                <span class="jd-overlay-skill-tag jd-overlay-skill-overflow">
                  +{overflowSkillCount} more
                </span>
              {/if}
            </div>
          {/if}
        </section>
      {/if}

      <section class="jd-overlay-section">
        <h4 class="jd-overlay-section-title">Description</h4>
        <div class="jd-overlay-description">
          {#if state === 'fetching' && initialData}
            <div class="jd-overlay-skeleton">Loading description…</div>
          {:else}
            {displayRawText}
          {/if}
        </div>
      </section>

      {#if displayNotes}
        <section class="jd-overlay-section">
          <h4 class="jd-overlay-section-title">Notes</h4>
          <div class="jd-overlay-notes">{displayNotes}</div>
        </section>
      {/if}
    {/if}
  {/snippet}

  {#snippet footer()}
    <div class="jd-overlay-footer">
      <div class="jd-overlay-timestamps">
        {#if displayCreatedAt}
          <span>Created {formatDate(displayCreatedAt)}</span>
        {/if}
        {#if displayUpdatedAt && displayUpdatedAt !== displayCreatedAt}
          <span class="jd-overlay-timestamp-sep">·</span>
          <span>Updated {formatDate(displayUpdatedAt)}</span>
        {/if}
      </div>
      <div class="jd-overlay-actions">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={handleOpenFullPage}
          disabled={!jdId}
        >Open full page →</button>
        <button type="button" class="btn" onclick={onClose}>Close</button>
      </div>
    </div>
  {/snippet}
</Modal>

<style>
  .jd-overlay-header {
    padding: var(--space-4) var(--space-5) var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  .jd-overlay-header-top {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .jd-overlay-status-badge {
    font-size: var(--text-xs);
    padding: 0.15rem 0.5rem;
    border-radius: var(--radius-sm);
    color: #111;
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    flex-shrink: 0;
    align-self: center;
  }

  .jd-overlay-title {
    flex: 1;
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    line-height: 1.3;
  }

  .jd-overlay-close-x {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--text-faint);
    cursor: pointer;
    padding: 0 var(--space-2);
    line-height: 1;
    flex-shrink: 0;
  }

  .jd-overlay-close-x:hover {
    color: var(--text-secondary);
  }

  .jd-overlay-org {
    margin-top: var(--space-1);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .jd-overlay-spinner {
    padding: var(--space-6);
    text-align: center;
    color: var(--text-muted);
  }

  .jd-overlay-error {
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-start;
  }

  .jd-overlay-error-message {
    margin: 0;
    font-weight: var(--font-semibold);
    color: var(--color-danger-text);
  }

  .jd-overlay-error-detail {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  .jd-overlay-retry {
    margin-top: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border-strong);
    background: var(--color-surface);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .jd-overlay-metadata-strip {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .jd-overlay-meta-item {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .jd-overlay-url {
    color: var(--color-primary);
    text-decoration: none;
  }

  .jd-overlay-url:hover {
    text-decoration: underline;
  }

  .jd-overlay-section {
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border);
  }

  .jd-overlay-section:last-child {
    border-bottom: none;
  }

  .jd-overlay-section-title {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .jd-overlay-skill-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .jd-overlay-skill-tag {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    font-size: var(--text-xs);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
  }

  .jd-overlay-skill-overflow {
    color: var(--text-muted);
    font-style: italic;
  }

  .jd-overlay-skills-error {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
    font-style: italic;
  }

  .jd-overlay-description {
    max-height: 50vh;
    overflow-y: auto;
    white-space: pre-wrap;
    font-size: var(--text-sm);
    color: var(--text-primary);
    line-height: 1.6;
  }

  .jd-overlay-skeleton {
    color: var(--text-muted);
    font-style: italic;
  }

  .jd-overlay-notes {
    white-space: pre-wrap;
    font-size: var(--text-sm);
    color: var(--text-primary);
    line-height: 1.6;
  }

  .jd-overlay-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-5);
    gap: var(--space-3);
  }

  .jd-overlay-timestamps {
    font-size: var(--text-xs);
    color: var(--text-muted);
    display: flex;
    gap: var(--space-1);
  }

  .jd-overlay-timestamp-sep {
    opacity: 0.5;
  }

  .jd-overlay-actions {
    display: flex;
    gap: var(--space-2);
  }
</style>
