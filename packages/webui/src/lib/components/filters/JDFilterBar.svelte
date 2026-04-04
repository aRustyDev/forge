<!--
  JDFilterBar.svelte -- Filter controls for the JD kanban board.
  Organization dropdown, location text filter, search text filter.
  All filters are client-side AND logic.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import type { ForgeClient } from '@forge/sdk'

  let { filters, forge, onchange }: {
    filters: { organization_id: string; location: string; search: string }
    forge: ForgeClient
    onchange: () => void
  } = $props()

  interface OrgOption {
    id: string
    name: string
  }

  let organizations = $state<OrgOption[]>([])

  // Use onMount for org loading instead of $effect.
  // $effect would re-run when organizations is written, causing an
  // infinite loop (effect reads forge -> writes organizations -> re-runs).
  onMount(() => {
    forge.organizations.list({ limit: 500 }).then(result => {
      if (result.ok) {
        organizations = result.data.map(o => ({ id: o.id, name: o.name }))
      }
    })
  })
</script>

<div class="filter-bar">
  <select
    class="filter-select"
    bind:value={filters.organization_id}
    onchange={onchange}
  >
    <option value="">All organizations</option>
    {#each organizations as org (org.id)}
      <option value={org.id}>{org.name}</option>
    {/each}
  </select>

  <input
    type="text"
    class="filter-input"
    placeholder="Filter by location..."
    bind:value={filters.location}
    oninput={onchange}
  />

  <input
    type="text"
    class="filter-input"
    placeholder="Search title or org..."
    bind:value={filters.search}
    oninput={onchange}
  />
</div>

<style>
  .filter-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 8px 0;
  }

  .filter-select, .filter-input {
    font-size: 0.875rem;
    padding: 4px 8px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 4px;
    background: var(--color-surface, white);
  }

  .filter-input {
    min-width: 160px;
  }
</style>
