<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
  import { EntityNotes } from '$lib/components'
  import type { Organization } from '@forge/sdk'

  let { org, onclose, onupdate }: {
    org: Organization | null
    onclose: () => void
    onupdate: () => void
  } = $props()

  const TARGETING_STATUSES = ['exciting', 'interested', 'acceptable']
  const INTEREST_OPTIONS = [
    { value: 'exciting', label: 'Exciting', color: '#22c55e' },
    { value: 'interested', label: 'Interested', color: '#3b82f6' },
    { value: 'acceptable', label: 'Acceptable', color: '#9ca3af' },
  ]

  const COLUMN_LABELS: Record<string, string> = {
    backlog: 'Backlog',
    researching: 'Researching',
    exciting: 'Targeting',
    interested: 'Targeting',
    acceptable: 'Targeting',
    excluded: 'Excluded',
  }

  let removing = $state(false)

  let isTargeting = $derived(org ? TARGETING_STATUSES.includes(org.status ?? '') : false)
  let columnLabel = $derived(org ? (COLUMN_LABELS[org.status ?? ''] ?? 'Unknown') : '')

  async function changeInterest(newStatus: string) {
    if (!org) return
    const result = await forge.organizations.update(org.id, { status: newStatus as any })
    if (result.ok) {
      addToast({ message: `Interest level changed to ${newStatus}`, type: 'success' })
      onupdate()
    } else {
      addToast({ message: friendlyError(result.error), type: 'error' })
    }
  }

  async function removeFromPipeline() {
    if (!org) return
    removing = true
    const result = await forge.organizations.update(org.id, { status: null })
    if (result.ok) {
      addToast({ message: `${org.name} removed from pipeline`, type: 'success' })
      onupdate()
      onclose()
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to remove from pipeline'), type: 'error' })
    }
    removing = false
  }
</script>

{#if org}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={onclose} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Organization Details">
      <div class="modal-header">
        <div class="header-left">
          <h3>{org.name}</h3>
          <span class="column-indicator">{columnLabel}</span>
          {#if org.worked}
            <span class="worked-badge">Worked</span>
          {/if}
        </div>
        <button class="close-btn" onclick={onclose}>&times;</button>
      </div>

      <div class="modal-body">
        {#if isTargeting}
          <div class="field-group">
            <label class="field-label">Interest Level</label>
            <div class="interest-selector">
              {#each INTEREST_OPTIONS as opt}
                <button
                  class="interest-btn"
                  class:active={org.status === opt.value}
                  style:--accent={opt.color}
                  onclick={() => changeInterest(opt.value)}
                >
                  {opt.label}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if org.tags && org.tags.length > 0}
          <div class="field-group">
            <label class="field-label">Tags</label>
            <div class="tag-pills">
              {#each org.tags as tag}
                <span class="tag-pill">{tag}</span>
              {/each}
            </div>
          </div>
        {/if}

        <div class="info-grid">
          {#if org.industry}
            <div class="info-item">
              <span class="info-label">Industry</span>
              <span class="info-value">{org.industry}</span>
            </div>
          {/if}
          {#if org.size}
            <div class="info-item">
              <span class="info-label">Size</span>
              <span class="info-value">{org.size}</span>
            </div>
          {/if}
          {#if org.glassdoor_rating}
            <div class="info-item">
              <span class="info-label">Glassdoor</span>
              <span class="info-value">{org.glassdoor_rating}/5</span>
            </div>
          {/if}
        </div>

        <div class="links">
          {#if org.website}
            <a href={org.website} target="_blank" rel="noopener" class="detail-link">Website</a>
          {/if}
          {#if org.linkedin_url}
            <a href={org.linkedin_url} target="_blank" rel="noopener" class="detail-link">LinkedIn</a>
          {/if}
          {#if org.glassdoor_url}
            <a href={org.glassdoor_url} target="_blank" rel="noopener" class="detail-link">Glassdoor</a>
          {/if}
        </div>

        <EntityNotes entityType="organization" entityId={org?.id} />
      </div>

      <div class="modal-footer">
        <a href="/data/organizations?id={org.id}" class="btn btn-ghost">
          Edit Full Details
        </a>
        <button
          class="btn btn-danger"
          onclick={removeFromPipeline}
          disabled={removing}
        >
          {removing ? 'Removing...' : 'Remove from Pipeline'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
  }

  .modal-content {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    width: 90%;
    max-width: 520px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .modal-header h3 {
    font-size: 1.05rem;
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .column-indicator {
    padding: 0.1em 0.4em;
    background: var(--color-tag-bg);
    color: var(--color-tag-text);
    border-radius: var(--radius-sm);
    font-size: 0.65rem;
    font-weight: var(--font-semibold);
    text-transform: uppercase;
  }

  .worked-badge {
    padding: 0.1em 0.35em;
    background: var(--color-success-subtle);
    color: var(--color-success-text);
    border-radius: var(--radius-sm);
    font-size: 0.6rem;
    font-weight: var(--font-semibold);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.3rem;
    color: var(--text-faint);
    cursor: pointer;
    padding: 0.2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .close-btn:hover { color: var(--text-secondary); }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4) var(--space-5);
  }

  .field-group {
    margin-bottom: var(--space-4);
  }

  .field-label {
    display: block;
    font-size: 0.75rem;
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 0.3rem;
  }

  .interest-selector {
    display: flex;
    gap: 0.35rem;
  }

  .interest-btn {
    flex: 1;
    padding: 0.4rem 0.5rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: 0.78rem;
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
    font-family: inherit;
  }

  .interest-btn:hover {
    border-color: var(--accent);
  }

  .interest-btn.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--color-surface));
    font-weight: var(--font-semibold);
  }

  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .tag-pill {
    padding: 0.1em 0.4em;
    background: var(--color-tag-bg);
    color: var(--color-tag-text);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .info-item {
    font-size: var(--text-sm);
  }

  .info-label {
    display: block;
    font-size: 0.68rem;
    color: var(--text-faint);
    text-transform: uppercase;
    font-weight: var(--font-medium);
  }

  .info-value {
    color: var(--text-secondary);
  }

  .links {
    display: flex;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .detail-link {
    font-size: 0.78rem;
    color: var(--color-primary);
    text-decoration: none;
  }

  .detail-link:hover {
    text-decoration: underline;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--color-border);
  }

  .btn {
    padding: 0.45rem 0.9rem;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-family: inherit;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: var(--text-muted); }
  .btn-ghost:hover { color: var(--text-secondary); background: var(--color-ghost); }
  .btn-danger { background: var(--color-danger-subtle); color: var(--color-danger-text); }
  .btn-danger:hover:not(:disabled) { background: var(--color-danger-subtle); }
</style>
