<script lang="ts">
  import type { Source } from '@forge/sdk'

  let { source, onclick }: {
    source: Source & { bullet_count?: number; organization_name?: string }
    onclick: () => void
  } = $props()

  const TYPE_LABELS: Record<string, string> = {
    role: 'Role',
    project: 'Project',
    education: 'Education',
    clearance: 'Clearance',
    general: 'General',
  }

  let typeLabel = $derived(TYPE_LABELS[source.source_type] ?? source.source_type)
  let isDeriving = $derived(source.status === 'deriving')
  let isArchived = $derived(source.status === 'archived')
  let isRejected = $derived(source.status === 'rejected')
  let dateRange = $derived(() => {
    if (!source.start_date) return ''
    const start = source.start_date.slice(0, 7) // YYYY-MM
    const end = source.end_date ? source.end_date.slice(0, 7) : 'Present'
    return `${start} -- ${end}`
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="kanban-card"
  class:deriving={isDeriving}
  class:archived={isArchived}
  class:rejected={isRejected}
  onclick={onclick}
  role="button"
  tabindex="0"
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick() } }}
>
  <div class="card-header">
    <span class="card-title">{source.title}</span>
    <span class="type-badge">{typeLabel}</span>
  </div>

  {#if source.organization_name}
    <span class="org-name">{source.organization_name}</span>
  {/if}

  {#if dateRange()}
    <span class="date-range">{dateRange()}</span>
  {/if}

  <div class="card-footer">
    {#if source.bullet_count !== undefined}
      <span class="bullet-count">{source.bullet_count} bullets</span>
    {/if}
    {#if isDeriving}
      <span class="deriving-indicator" title="Derivation in progress">&#x21BB;</span>
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

  .kanban-card.deriving {
    cursor: not-allowed;
    border-left: 3px solid var(--color-info, #3b82f6);
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
    margin-bottom: var(--space-1, 0.25rem);
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

  .type-badge {
    display: inline-block;
    padding: 0.05em 0.3em;
    background: var(--color-tag-bg, #e0e7ff);
    color: var(--color-tag-text, #3730a3);
    border-radius: var(--radius-sm, 3px);
    font-size: var(--text-xs, 0.6rem);
    font-weight: var(--font-medium, 500);
    flex-shrink: 0;
  }

  .org-name {
    display: block;
    font-size: var(--text-xs, 0.7rem);
    color: var(--text-muted, #6b7280);
    margin-bottom: var(--space-1, 0.15rem);
  }

  .date-range {
    display: block;
    font-size: var(--text-xs, 0.65rem);
    color: var(--text-faint, #9ca3af);
    margin-bottom: var(--space-1, 0.15rem);
  }

  .card-footer {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.4rem);
  }

  .bullet-count {
    font-size: var(--text-xs, 0.65rem);
    color: var(--text-faint, #9ca3af);
  }

  .deriving-indicator {
    font-size: var(--text-sm, 0.8rem);
    color: var(--color-info, #3b82f6);
    animation: spin 1.5s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
