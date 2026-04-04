<script lang="ts">
  import type { Bullet } from '@forge/sdk'

  let { bullet, onclick }: {
    bullet: Bullet
    onclick: () => void
  } = $props()

  let contentPreview = $derived(
    bullet.content.length > 80 ? bullet.content.slice(0, 80) + '...' : bullet.content
  )
  let isRejected = $derived(bullet.status === 'rejected')
  let isArchived = $derived(bullet.status === 'archived')
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

  {#if bullet.domain}
    <span class="domain-badge">{bullet.domain}</span>
  {/if}

  {#if bullet.technologies && bullet.technologies.length > 0}
    <div class="tech-pills">
      {#each bullet.technologies.slice(0, 3) as tech}
        <span class="pill">{tech}</span>
      {/each}
      {#if bullet.technologies.length > 3}
        <span class="pill pill-neutral">+{bullet.technologies.length - 3}</span>
      {/if}
    </div>
  {/if}
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

  .domain-badge {
    display: inline-block;
    padding: 0.05em 0.3em;
    background: var(--color-info-subtle, #eff6ff);
    color: var(--color-info-text, #1e40af);
    border-radius: var(--radius-sm, 3px);
    font-size: var(--text-xs, 0.65rem);
    font-weight: var(--font-medium, 500);
    margin-bottom: var(--space-1, 0.25rem);
  }

  .tech-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
    margin-bottom: var(--space-1, 0.2rem);
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
</style>
