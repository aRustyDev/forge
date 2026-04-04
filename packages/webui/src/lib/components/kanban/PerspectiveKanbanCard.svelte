<script lang="ts">
  import type { Perspective } from '@forge/sdk'

  let { perspective, onclick }: {
    perspective: Perspective
    onclick: () => void
  } = $props()

  let contentPreview = $derived(
    perspective.content.length > 80 ? perspective.content.slice(0, 80) + '...' : perspective.content
  )
  let isRejected = $derived(perspective.status === 'rejected')
  let isArchived = $derived(perspective.status === 'archived')
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="kanban-card"
  class:rejected={isRejected}
  class:archived={isArchived}
  onclick={onclick}
  role="button"
  tabindex="0"
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick() } }}
>
  <p class="card-content">{contentPreview}</p>

  <div class="badge-row">
    {#if perspective.target_archetype}
      <span class="pill">{perspective.target_archetype}</span>
    {/if}
    {#if perspective.domain}
      <span class="pill pill-neutral">{perspective.domain}</span>
    {/if}
    <span class="framing-badge">{perspective.framing}</span>
  </div>
</div>

<style>
  .kanban-card {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 6px);
    cursor: grab;
    background: var(--color-surface, #ffffff);
    transition: box-shadow 0.12s, opacity 0.12s;
  }

  .kanban-card:hover {
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.08));
  }

  .kanban-card:active {
    cursor: grabbing;
  }

  .kanban-card.rejected {
    opacity: 0.7;
  }

  .kanban-card.archived {
    opacity: 0.5;
    color: var(--text-muted, #6b7280);
  }

  .card-content {
    font-size: var(--text-sm, 0.8rem);
    color: var(--text-primary, #1a1a2e);
    line-height: var(--leading-normal, 1.5);
    margin: 0 0 var(--space-1, 0.25rem) 0;
  }

  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
  }

  .pill {
    display: inline-block;
    padding: 0.05em 0.3em;
    background: var(--color-tag-bg, #e0e7ff);
    color: var(--color-tag-text, #3730a3);
    border-radius: var(--radius-sm, 3px);
    font-size: var(--text-xs, 0.6rem);
    font-weight: var(--font-medium, 500);
  }

  .pill-neutral {
    background: var(--color-border, #e5e7eb);
    color: var(--text-muted, #6b7280);
  }

  .framing-badge {
    display: inline-block;
    padding: 0.05em 0.3em;
    background: var(--color-success-subtle, #f0fdf4);
    color: var(--color-success-text, #065f46);
    border-radius: var(--radius-sm, 3px);
    font-size: var(--text-xs, 0.6rem);
    font-weight: var(--font-medium, 500);
    text-transform: capitalize;
  }
</style>
