<script lang="ts">
  import { forge } from '$lib/sdk'

  let { filters, onchange }: {
    filters: {
      archetype?: string
      target_employer?: string
      search?: string
    }
    onchange: () => void
  } = $props()

  let archetypes = $state<string[]>([])
  let employers = $state<string[]>([])

  $effect(() => {
    loadFilterOptions()
  })

  async function loadFilterOptions() {
    const [archResult, resumeResult] = await Promise.all([
      forge.archetypes.list(),
      forge.resumes.list({ limit: 500 }),
    ])
    if (archResult.ok) archetypes = archResult.data.map((a: any) => a.name)
    if (resumeResult.ok) {
      employers = [...new Set(resumeResult.data.map(r => r.target_employer).filter(Boolean))]
    }
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
    bind:value={filters.target_employer}
    onchange={handleChange}
  >
    <option value="">All Employers</option>
    {#each employers as emp}
      <option value={emp}>{emp}</option>
    {/each}
  </select>

  <input
    type="text"
    class="field-input"
    placeholder="Search resumes..."
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
