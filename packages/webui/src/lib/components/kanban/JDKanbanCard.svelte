<!--
  JDKanbanCard.svelte -- JD card content for kanban board.
  Dense layout for scannability: truncated title, org, location/salary, skill pills.
-->
<script lang="ts">
  import type { JobDescriptionWithOrg } from '@forge/sdk'

  let { jd, onclick }: {
    jd: JobDescriptionWithOrg & { skills?: Array<{ name: string }> }
    onclick: () => void
  } = $props()

  let truncatedTitle = $derived(
    jd.title.length > 50 ? jd.title.slice(0, 47) + '...' : jd.title
  )

  let displaySkills = $derived(jd.skills?.slice(0, 3) ?? [])
  let overflowCount = $derived(Math.max(0, (jd.skills?.length ?? 0) - 3))

  let isOffered = $derived(jd.status === 'offered')
  let isClosed = $derived(['rejected', 'withdrawn', 'closed'].includes(jd.status))
  let isRejected = $derived(jd.status === 'rejected')
  let isWithdrawn = $derived(jd.status === 'withdrawn')
</script>

<button
  class="jd-kanban-card"
  class:offered={isOffered}
  class:closed={isClosed}
  class:rejected={isRejected}
  class:withdrawn={isWithdrawn}
  {onclick}
>
  <div class="card-title">{truncatedTitle}</div>

  {#if jd.organization_name}
    <div class="card-org muted">{jd.organization_name}</div>
  {/if}

  {#if jd.location || jd.salary_range}
    <div class="card-meta muted">
      {#if jd.location}{jd.location}{/if}
      {#if jd.location && jd.salary_range} &bull; {/if}
      {#if jd.salary_range}{jd.salary_range}{/if}
    </div>
  {/if}

  {#if displaySkills.length > 0}
    <div class="card-skills">
      {#each displaySkills as skill}
        <span class="skill-pill">{skill.name}</span>
      {/each}
      {#if overflowCount > 0}
        <span class="skill-pill overflow">+{overflowCount} more</span>
      {/if}
    </div>
  {/if}

  {#if isClosed}
    <span class="sub-status-badge sub-status-{jd.status}">{jd.status}</span>
  {/if}
</button>

<style>
  .jd-kanban-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    background: var(--color-surface, white);
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .jd-kanban-card:hover {
    border-color: var(--color-border-strong, #d1d5db);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .jd-kanban-card.offered {
    background: var(--color-success-subtle, #f0fdf4);
    border-left: 3px solid var(--color-success, #22c55e);
  }

  .jd-kanban-card.closed {
    opacity: 0.6;
  }

  .jd-kanban-card.rejected {
    border-left: 3px solid var(--color-danger, #ef4444);
  }

  .jd-kanban-card.withdrawn {
    border-left: 3px solid #f97316;
  }

  .card-title {
    font-weight: 600;
    font-size: 0.875rem;
    line-height: 1.25;
  }

  .card-org, .card-meta {
    font-size: 0.75rem;
    color: var(--text-muted, #6b7280);
  }

  .card-skills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .skill-pill {
    font-size: 0.625rem;
    padding: 1px 6px;
    border-radius: 9999px;
    background: var(--color-ghost, #f3f4f6);
    color: var(--text-secondary, #4b5563);
  }

  .skill-pill.overflow {
    color: var(--text-muted, #6b7280);
    font-style: italic;
  }

  .sub-status-badge {
    font-size: 0.625rem;
    padding: 1px 6px;
    border-radius: 4px;
    margin-top: 2px;
    width: fit-content;
  }

  .sub-status-rejected {
    background: var(--color-danger-subtle, #fef2f2);
    color: var(--color-danger, #dc2626);
  }

  .sub-status-withdrawn {
    background: #fff7ed;
    color: #ea580c;
  }

  .sub-status-closed {
    background: var(--color-ghost, #f3f4f6);
    color: var(--text-muted, #6b7280);
  }
</style>
