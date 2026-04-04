<!--
  GraphFilterPanel.svelte — Collapsible filter sidebar for graph views.
  Renders checkbox groups for node types and statuses, dropdowns for
  domains and archetypes. Persists filter state via callback.
-->
<script lang="ts">
  import type { GraphFilterState } from './graph.filters'
  import { createDefaultFilterState } from './graph.filters'

  interface GraphFilterPanelProps {
    filterState: GraphFilterState
    availableTypes: string[]
    availableStatuses: string[]
    availableDomains: string[]
    availableArchetypes: string[]
    onFilterChange: (newState: GraphFilterState) => void
  }

  let {
    filterState,
    availableTypes,
    availableStatuses,
    availableDomains,
    availableArchetypes,
    onFilterChange,
  }: GraphFilterPanelProps = $props()

  let collapsed = $state(false)

  function toggleType(type: string) {
    const next = new Set(filterState.nodeTypes)
    if (next.has(type)) {
      next.delete(type)
    } else {
      next.add(type)
    }
    onFilterChange({ ...filterState, nodeTypes: next })
  }

  function toggleStatus(status: string) {
    const next = new Set(filterState.statuses)
    if (next.has(status)) {
      next.delete(status)
    } else {
      next.add(status)
    }
    onFilterChange({ ...filterState, statuses: next })
  }

  function selectDomain(event: Event) {
    const value = (event.target as HTMLSelectElement).value
    if (value) {
      onFilterChange({ ...filterState, domains: new Set([value]) })
    } else {
      onFilterChange({ ...filterState, domains: new Set() })
    }
  }

  function selectArchetype(event: Event) {
    const value = (event.target as HTMLSelectElement).value
    if (value) {
      onFilterChange({ ...filterState, archetypes: new Set([value]) })
    } else {
      onFilterChange({ ...filterState, archetypes: new Set() })
    }
  }

  function clearAll() {
    onFilterChange(createDefaultFilterState())
  }

  let hasActiveFilters = $derived(
    filterState.nodeTypes.size > 0
    || filterState.statuses.size > 0
    || filterState.domains.size > 0
    || filterState.archetypes.size > 0
  )
</script>

<div class="filter-panel" class:collapsed>
  <button class="filter-header" onclick={() => collapsed = !collapsed}>
    <span>Filters</span>
    <span class="toggle-icon">{collapsed ? '+' : '-'}</span>
  </button>

  {#if !collapsed}
    <div class="filter-body">
      {#if availableTypes.length > 0}
        <fieldset class="filter-group">
          <legend>Node Type</legend>
          {#each availableTypes as type}
            <label class="filter-checkbox">
              <input
                type="checkbox"
                checked={filterState.nodeTypes.size === 0 || filterState.nodeTypes.has(type)}
                onchange={() => toggleType(type)}
              />
              {type}
            </label>
          {/each}
        </fieldset>
      {/if}

      {#if availableStatuses.length > 0}
        <fieldset class="filter-group">
          <legend>Status</legend>
          {#each availableStatuses as status}
            <label class="filter-checkbox">
              <input
                type="checkbox"
                checked={filterState.statuses.size === 0 || filterState.statuses.has(status)}
                onchange={() => toggleStatus(status)}
              />
              {status}
            </label>
          {/each}
        </fieldset>
      {/if}

      {#if availableDomains.length > 0}
        <fieldset class="filter-group">
          <legend>Domain</legend>
          <select onchange={selectDomain}>
            <option value="">All domains</option>
            {#each availableDomains as domain}
              <option
                value={domain}
                selected={filterState.domains.has(domain)}
              >{domain}</option>
            {/each}
          </select>
        </fieldset>
      {/if}

      {#if availableArchetypes.length > 0}
        <fieldset class="filter-group">
          <legend>Archetype</legend>
          <select onchange={selectArchetype}>
            <option value="">All archetypes</option>
            {#each availableArchetypes as archetype}
              <option
                value={archetype}
                selected={filterState.archetypes.has(archetype)}
              >{archetype}</option>
            {/each}
          </select>
        </fieldset>
      {/if}

      {#if hasActiveFilters}
        <button class="clear-btn" onclick={clearAll}>
          Clear All Filters
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filter-panel {
    background: var(--color-surface, rgba(255, 255, 255, 0.95));
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-lg, 8px);
    box-shadow: var(--shadow-sm, 0 1px 4px rgba(0, 0, 0, 0.1));
    backdrop-filter: blur(4px);
    min-width: 180px;
    font-size: var(--text-sm, 0.85rem);
  }

  .filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border: none;
    background: none;
    cursor: pointer;
    font-weight: var(--font-semibold, 600);
    font-size: var(--text-sm, 0.85rem);
    color: var(--text-primary, #1a1a2e);
  }

  .toggle-icon {
    font-size: 1rem;
    color: var(--text-muted, #9ca3af);
  }

  .filter-body {
    padding: var(--space-1, 4px) var(--space-3, 12px) var(--space-3, 12px);
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
  }

  .filter-group {
    border: none;
    padding: 0;
    margin: 0;
  }

  .filter-group legend {
    font-weight: var(--font-medium, 500);
    font-size: var(--text-xs, 0.8rem);
    color: var(--text-muted, #6b7280);
    margin-bottom: var(--space-1, 4px);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .filter-checkbox {
    display: flex;
    align-items: center;
    gap: var(--space-2, 6px);
    padding: 2px 0;
    cursor: pointer;
    color: var(--text-primary, #1a1a2e);
  }

  .filter-checkbox input {
    margin: 0;
  }

  .filter-group select {
    width: 100%;
    padding: var(--space-1, 4px) var(--space-2, 8px);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-sm, 0.85rem);
    background: var(--color-surface, white);
    color: var(--text-primary, #1a1a2e);
  }

  .clear-btn {
    padding: var(--space-2, 6px) var(--space-3, 12px);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, white);
    cursor: pointer;
    font-size: var(--text-xs, 0.8rem);
    color: var(--text-muted, #6b7280);
    transition: background-color 0.15s;
  }

  .clear-btn:hover {
    background: var(--color-ghost, #f3f4f6);
  }
</style>
