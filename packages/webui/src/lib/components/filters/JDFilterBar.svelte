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
