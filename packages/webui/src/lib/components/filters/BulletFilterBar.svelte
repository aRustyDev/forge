<script lang="ts">
  import { forge } from '$lib/sdk'

  let { filters, onchange }: {
    filters: {
      source?: string
      domain?: string
      search?: string
    }
    onchange: () => void
  } = $props()

  let sources = $state<{ id: string; title: string }[]>([])
  let domains = $state<string[]>([])

  $effect(() => {
    loadFilterOptions()
  })

  async function loadFilterOptions() {
    const [srcResult] = await Promise.all([
      forge.sources.list({ limit: 500 }),
    ])
    if (srcResult.ok) sources = srcResult.data.map(s => ({ id: s.id, title: s.title }))

    // Collect unique domains from bullets
    const bulletResult = await forge.bullets.list({ limit: 500 })
    if (bulletResult.ok) {
      domains = [...new Set(bulletResult.data.map(b => b.domain).filter((d): d is string => !!d))]
    }
  }

  function handleChange() {
    onchange()
  }
</script>

<div class="filter-bar">
  <select
    class="field-select"
    bind:value={filters.source}
    onchange={handleChange}
  >
    <option value="">All Sources</option>
    {#each sources as src}
      <option value={src.id}>{src.title}</option>
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

  <input
    type="text"
    class="field-input"
    placeholder="Search bullets..."
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
