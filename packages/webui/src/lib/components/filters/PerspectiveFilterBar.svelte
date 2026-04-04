<script lang="ts">
  import { forge } from '$lib/sdk'

  let { filters, onchange }: {
    filters: {
      archetype?: string
      domain?: string
      framing?: string
      search?: string
    }
    onchange: () => void
  } = $props()

  let archetypes = $state<string[]>([])
  let domains = $state<string[]>([])

  $effect(() => {
    loadFilterOptions()
  })

  async function loadFilterOptions() {
    const [archResult, domResult] = await Promise.all([
      forge.archetypes.list(),
      forge.domains.list(),
    ])
    if (archResult.ok) archetypes = archResult.data.map((a: any) => a.name)
    if (domResult.ok) domains = domResult.data.map((d: any) => d.name)
  }

  function handleChange() {
    onchange()
  }
</script>

<div class="filter-bar">
  <select
    class="field-select"
    bind:value={filters.archetype}
    onchange={handleChange}
  >
    <option value="">All Archetypes</option>
    {#each archetypes as arch}
      <option value={arch}>{arch}</option>
    {/each}
  </select>

  <select
    class="field-select"
    bind:value={filters.domain}
    onchange={handleChange}
  >
    <option value="">All Domains</option>
    {#each domains as domain}
      <option value={domain}>{domain}</option>
    {/each}
  </select>

  <select
    class="field-select"
    bind:value={filters.framing}
    onchange={handleChange}
  >
    <option value="">All Framings</option>
    <option value="accomplishment">Accomplishment</option>
    <option value="responsibility">Responsibility</option>
    <option value="context">Context</option>
  </select>

  <input
    type="text"
    class="field-input"
    placeholder="Search perspectives..."
    bind:value={filters.search}
    oninput={handleChange}
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
