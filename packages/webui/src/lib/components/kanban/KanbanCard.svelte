<script lang="ts">
  import type { Organization } from '@forge/sdk'

  let { org, onclick, aliasCount = 0, hqLocation = '' }: {
    org: Organization
    onclick: () => void
    aliasCount?: number
    hqLocation?: string
  } = $props()

  const INTEREST_STYLES: Record<string, { bg: string; border: string; badge: string; label: string }> = {
    exciting: { bg: 'var(--color-success-subtle)', border: 'var(--color-success)', badge: 'var(--color-success-strong)', label: 'EXCITING' },
    interested: { bg: 'var(--color-info-subtle)', border: 'var(--color-info)', badge: 'var(--color-info)', label: 'INTERESTED' },
    acceptable: { bg: 'var(--color-surface-raised)', border: 'var(--text-faint)', badge: 'var(--text-muted)', label: 'ACCEPTABLE' },
  }

  let interest = $derived(INTEREST_STYLES[org.status ?? ''] ?? null)
  let isExcluded = $derived(org.status === 'excluded')
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="kanban-card"
  class:excluded={isExcluded}
  style:background={interest?.bg ?? 'var(--color-surface)'}
  style:border-left={interest ? `4px solid ${interest.border}` : `1px solid var(--color-border)`}
  onclick={onclick}
  role="button"
  tabindex="0"
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick() } }}
>
  <div class="card-header">
    <span class="card-name" class:strike={isExcluded}>{org.name}</span>
    {#if aliasCount > 0}
      <span class="alias-count">({aliasCount})</span>
    {/if}
    {#if org.worked}
      <span class="worked-badge">Worked</span>
    {/if}
  </div>

  {#if org.tags && org.tags.length > 0}
    <div class="tag-pills">
      {#each org.tags as tag}
        <span class="pill">{tag}</span>
      {/each}
    </div>
  {/if}

  <div class="card-meta">
    {#if org.industry}
      <span class="meta-text">{org.industry}</span>
    {/if}
    {#if hqLocation}
      <span class="meta-text">{hqLocation}</span>
    {/if}
  </div>

  {#if interest}
    <span class="badge" style:background={interest.badge}>
      {interest.label}
    </span>
  {/if}
</div>

<style>
  .kanban-card {
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: grab;
    transition: box-shadow 0.12s, opacity 0.12s;
    margin-bottom: 0.35rem;
  }

  .kanban-card:hover {
    box-shadow: var(--shadow-sm);
  }

  .kanban-card:active {
    cursor: grabbing;
  }

  .kanban-card.excluded {
    opacity: 0.6;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.25rem;
  }

  .card-name {
    font-size: 0.82rem;
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .card-name.strike {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .worked-badge {
    display: inline-block;
    padding: 0.08em 0.35em;
    background: var(--color-success-subtle);
    color: var(--color-success-text);
    border-radius: var(--radius-sm);
    font-size: 0.6rem;
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
    margin-bottom: 0.2rem;
  }

  .card-meta {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .meta-text {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .alias-count {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-weight: 400;
    flex-shrink: 0;
  }
</style>
