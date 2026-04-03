<script lang="ts">
  import type { Organization } from '@forge/sdk'

  let { org, onclick }: {
    org: Organization
    onclick: () => void
  } = $props()

  const INTEREST_STYLES: Record<string, { bg: string; border: string; badge: string; label: string }> = {
    exciting: { bg: '#f0fdf4', border: '#22c55e', badge: '#16a34a', label: 'EXCITING' },
    interested: { bg: '#eff6ff', border: '#3b82f6', badge: '#2563eb', label: 'INTERESTED' },
    acceptable: { bg: '#fafafa', border: '#9ca3af', badge: '#6b7280', label: 'ACCEPTABLE' },
  }

  let interest = $derived(INTEREST_STYLES[org.status ?? ''] ?? null)
  let isExcluded = $derived(org.status === 'excluded')
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="kanban-card"
  class:excluded={isExcluded}
  style:background={interest?.bg ?? '#ffffff'}
  style:border-left={interest ? `4px solid ${interest.border}` : '1px solid #e5e7eb'}
  onclick={onclick}
  role="button"
  tabindex="0"
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick() } }}
>
  <div class="card-header">
    <span class="card-name" class:strike={isExcluded}>{org.name}</span>
    {#if org.worked}
      <span class="worked-badge">Worked</span>
    {/if}
  </div>

  {#if org.tags && org.tags.length > 0}
    <div class="tag-pills">
      {#each org.tags as tag}
        <span class="tag-pill">{tag}</span>
      {/each}
    </div>
  {/if}

  <div class="card-meta">
    {#if org.industry}
      <span class="meta-text">{org.industry}</span>
    {/if}
    {#if org.location}
      <span class="meta-text">{org.location}</span>
    {/if}
  </div>

  {#if interest}
    <span class="interest-badge" style:background={interest.badge}>
      {interest.label}
    </span>
  {/if}
</div>

<style>
  .kanban-card {
    padding: 0.6rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: grab;
    transition: box-shadow 0.12s, opacity 0.12s;
    margin-bottom: 0.35rem;
  }

  .kanban-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
    font-weight: 600;
    color: #1a1a2e;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .card-name.strike {
    text-decoration: line-through;
    color: #6b7280;
  }

  .worked-badge {
    display: inline-block;
    padding: 0.08em 0.35em;
    background: #d1fae5;
    color: #065f46;
    border-radius: 3px;
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
    margin-bottom: 0.2rem;
  }

  .tag-pill {
    display: inline-block;
    padding: 0.05em 0.3em;
    background: #e0e7ff;
    color: #3730a3;
    border-radius: 3px;
    font-size: 0.58rem;
    font-weight: 500;
    text-transform: lowercase;
  }

  .card-meta {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .meta-text {
    font-size: 0.7rem;
    color: #6b7280;
  }

  .interest-badge {
    display: inline-block;
    margin-top: 0.3rem;
    padding: 0.1em 0.4em;
    color: #fff;
    border-radius: 3px;
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
</style>
