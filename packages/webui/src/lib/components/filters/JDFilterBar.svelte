<!--
  JDFilterBar.svelte -- Filter controls for the JD kanban board.
  Organization dropdown, location text filter, search text filter.
  All filters are client-side AND logic.
  Org dropdown only shows organizations that have at least one JD on the board.
-->
<script lang="ts">
  let { filters, jds, onchange }: {
    filters: { organization_id: string; location: string; search: string }
    jds: Array<{ organization_id: string | null; organization_name?: string | null }>
    onchange: () => void
  } = $props()

  interface OrgOption {
    id: string
    name: string
  }

  // Derive unique organizations from the JDs currently on the board.
  // Only shows orgs that actually have JDs, not all orgs in the system.
  let organizations = $derived.by(() => {
    const seen = new Map<string, string>()
    for (const jd of jds) {
      if (jd.organization_id && !seen.has(jd.organization_id)) {
        seen.set(jd.organization_id, jd.organization_name ?? 'Unknown')
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })
</script>

<div class="filter-bar">
  <select
    class="field-select"
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
    class="field-input"
    placeholder="Filter by location..."
    bind:value={filters.location}
    oninput={onchange}
  />

  <input
    type="text"
    class="field-input"
    placeholder="Search title or org..."
    bind:value={filters.search}
    oninput={onchange}
  />
</div>

<style>
  .filter-bar {
    display: flex;
    gap: var(--space-2, 0.5rem);
    flex-wrap: wrap;
    align-items: center;
  }

  .filter-bar .field-select,
  .filter-bar .field-input {
    font-size: var(--text-sm, 0.8rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 3px);
    background: var(--color-surface, #fff);
    color: var(--text-primary, #1a1a2e);
  }

  .filter-bar .field-input {
    min-width: 150px;
  }
</style>
