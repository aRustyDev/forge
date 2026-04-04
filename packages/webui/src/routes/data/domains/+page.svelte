<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import DomainsView from './DomainsView.svelte'
  import ArchetypesView from './ArchetypesView.svelte'

  const TABS = [
    { value: 'domains', label: 'Domains' },
    { value: 'archetypes', label: 'Archetypes' },
  ]

  let activeTab = $derived(page.url.searchParams.get('tab') ?? 'domains')

  function switchTab(tab: string) {
    goto(`/data/domains?tab=${tab}`, { replaceState: true })
  }
</script>

<div class="domains-container">
  <div class="tab-bar">
    {#each TABS as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.value}
        onclick={() => switchTab(tab.value)}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="tab-content">
    {#if activeTab === 'archetypes'}
      <ArchetypesView />
    {:else}
      <DomainsView />
    {/if}
  </div>
</div>

<style>
  .domains-container {
    max-width: 1000px;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--space-6);
  }

  .tab-btn {
    padding: 0.75rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab-btn:hover {
    color: var(--text-secondary);
  }

  .tab-btn.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  .tab-content {
    min-height: 0;
  }
</style>
