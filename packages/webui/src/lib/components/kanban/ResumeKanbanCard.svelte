<script lang="ts">
  import type { Resume } from '@forge/sdk'

  let { resume, onclick }: {
    resume: Resume & { section_count?: number }
    onclick: () => void
  } = $props()

  let isApproved = $derived(resume.status === 'approved')
  let isArchived = $derived(resume.status === 'archived')
  let isRejected = $derived(resume.status === 'rejected')
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="kanban-card"
  class:archived={isArchived}
  class:rejected={isRejected}
  onclick={onclick}
  role="button"
  tabindex="0"
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick() } }}
>
  <div class="card-header">
    <span class="card-title">{resume.name}</span>
    {#if isApproved}
      <span class="approved-check" title="Approved">&#x2713;</span>
    {/if}
  </div>
  <span class="target-role">{resume.target_role}</span>
  <span class="target-employer">{resume.target_employer}</span>
  <div class="card-meta">
    <span class="archetype-badge">{resume.archetype}</span>
    {#if resume.section_count !== undefined}
      <span class="section-count">{resume.section_count} sections</span>
    {/if}
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

  .kanban-card.archived {
    opacity: 0.5;
    color: var(--text-muted, #6b7280);
  }

  .kanban-card.rejected {
    opacity: 0.7;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.4rem);
    margin-bottom: var(--space-1, 0.15rem);
  }

  .card-title {
    font-size: var(--text-sm, 0.82rem);
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #1a1a2e);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .approved-check {
    color: var(--color-success, #22c55e);
    font-size: var(--text-sm, 0.8rem);
    font-weight: var(--font-bold, 700);
  }

  .target-role {
    display: block;
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-secondary, #374151);
    margin-bottom: 0.1rem;
  }

  .target-employer {
    display: block;
    font-size: var(--text-xs, 0.7rem);
    color: var(--text-muted, #6b7280);
    margin-bottom: var(--space-1, 0.25rem);
  }

  .card-meta {
    display: flex;
    gap: var(--space-2, 0.4rem);
    align-items: center;
  }

  .archetype-badge {
    display: inline-block;
    padding: 0.05em 0.3em;
    background: var(--color-tag-bg, #e0e7ff);
    color: var(--color-tag-text, #3730a3);
    border-radius: var(--radius-sm, 3px);
    font-size: var(--text-xs, 0.6rem);
    font-weight: var(--font-medium, 500);
  }

  .section-count {
    font-size: var(--text-xs, 0.65rem);
    color: var(--text-faint, #9ca3af);
  }
</style>
