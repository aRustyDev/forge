<script lang="ts">
  import { forge, friendlyError } from '$lib/sdk'
  import { addToast } from '$lib/stores/toast.svelte'
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

  let notesValue = $state('')
  let reputationValue = $state('')
  let savingNotes = $state(false)
  let savingReputation = $state(false)
  let removing = $state(false)

  let isTargeting = $derived(org ? TARGETING_STATUSES.includes(org.status ?? '') : false)
  let columnLabel = $derived(org ? (COLUMN_LABELS[org.status ?? ''] ?? 'Unknown') : '')

  $effect(() => {
    if (org) {
      notesValue = org.notes ?? ''
      reputationValue = org.reputation_notes ?? ''
    }
  })

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

  async function saveNotes() {
    if (!org) return
    savingNotes = true
    const result = await forge.organizations.update(org.id, { notes: notesValue || null })
    if (result.ok) {
      onupdate()
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to save notes'), type: 'error' })
    }
    savingNotes = false
  }

  async function saveReputation() {
    if (!org) return
    savingReputation = true
    const result = await forge.organizations.update(org.id, { reputation_notes: reputationValue || null })
    if (result.ok) {
      onupdate()
    } else {
      addToast({ message: friendlyError(result.error, 'Failed to save reputation notes'), type: 'error' })
    }
    savingReputation = false
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
          {#if org.location}
            <div class="info-item">
              <span class="info-label">Location</span>
              <span class="info-value">{org.location}</span>
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

        <div class="field-group">
          <label class="field-label" for="detail-notes">Notes</label>
          <textarea
            id="detail-notes"
            class="detail-textarea"
            bind:value={notesValue}
            onblur={saveNotes}
            rows="3"
            placeholder="Add notes about this organization..."
          ></textarea>
          {#if savingNotes}
            <span class="saving-indicator">Saving...</span>
          {/if}
        </div>

        <div class="field-group">
          <label class="field-label" for="detail-reputation">Reputation Notes</label>
          <textarea
            id="detail-reputation"
            class="detail-textarea"
            bind:value={reputationValue}
            onblur={saveReputation}
            rows="3"
            placeholder="Reputation, red flags, culture notes..."
          ></textarea>
          {#if savingReputation}
            <span class="saving-indicator">Saving...</span>
          {/if}
        </div>
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
    max-width: 520px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .modal-header h3 {
    font-size: 1.05rem;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0;
  }

  .column-indicator {
    padding: 0.1em 0.4em;
    background: #e0e7ff;
    color: #3730a3;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .worked-badge {
    padding: 0.1em 0.35em;
    background: #d1fae5;
    color: #065f46;
    border-radius: 3px;
    font-size: 0.6rem;
    font-weight: 600;
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

  .interest-selector {
    display: flex;
    gap: 0.35rem;
  }

  .interest-btn {
    flex: 1;
    padding: 0.4rem 0.5rem;
    border: 2px solid #e5e7eb;
    border-radius: 6px;
    background: #fff;
    font-size: 0.78rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
    font-family: inherit;
  }

  .interest-btn:hover {
    border-color: var(--accent);
  }

  .interest-btn.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, white);
    font-weight: 600;
  }

  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .tag-pill {
    padding: 0.1em 0.4em;
    background: #e0e7ff;
    color: #3730a3;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .info-item {
    font-size: 0.8rem;
  }

  .info-label {
    display: block;
    font-size: 0.68rem;
    color: #9ca3af;
    text-transform: uppercase;
    font-weight: 500;
  }

  .info-value {
    color: #374151;
  }

  .links {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .detail-link {
    font-size: 0.78rem;
    color: #6c63ff;
    text-decoration: none;
  }

  .detail-link:hover {
    text-decoration: underline;
  }

  .detail-textarea {
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

  .detail-textarea:focus {
    outline: none;
    border-color: #6c63ff;
    box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
  }

  .saving-indicator {
    font-size: 0.68rem;
    color: #6c63ff;
    font-style: italic;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #e5e7eb;
  }

  .btn {
    padding: 0.45rem 0.9rem;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: #6b7280; }
  .btn-ghost:hover { color: #374151; background: #f3f4f6; }
  .btn-danger { background: #fee2e2; color: #dc2626; }
  .btn-danger:hover:not(:disabled) { background: #fecaca; }
</style>
