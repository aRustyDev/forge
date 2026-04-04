<!--
  JDCard.svelte -- Card for the JD list panel.
  Displays title, organization name, status badge, location, and salary range.
-->
<script lang="ts">
  import { StatusBadge } from '$lib/components'
  import type { JobDescriptionWithOrg } from '@forge/sdk'

  let {
    jd,
    selected = false,
    onclick,
  }: {
    jd: JobDescriptionWithOrg
    selected?: boolean
    onclick: () => void
  } = $props()
</script>

<button
  class="jd-card"
  class:selected
  onclick={onclick}
  type="button"
>
  <div class="card-header">
    <span class="title">{jd.title}</span>
    <StatusBadge status={jd.status} />
  </div>
  <span class="org-name">{jd.organization_name ?? 'No organization'}</span>
  {#if jd.location || jd.salary_range}
    <div class="card-meta">
      {#if jd.location}
        <span class="meta-item">{jd.location}</span>
      {/if}
      {#if jd.salary_range}
        <span class="meta-item">{jd.salary_range}</span>
      {/if}
    </div>
  {/if}
</button>

<style>
  .jd-card {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-surface);
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .jd-card:hover {
    border-color: var(--color-info-border);
    background: var(--color-info-subtle);
  }

  .jd-card.selected {
    border-color: var(--color-info);
    background: var(--color-info-subtle);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .org-name {
    display: block;
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }

  .card-meta {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .meta-item {
    font-size: 0.75rem;
    color: var(--text-faint);
  }
</style>
