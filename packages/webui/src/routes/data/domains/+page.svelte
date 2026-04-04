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
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 1.5rem;
  }

  .tab-btn {
    padding: 0.75rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.85rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab-btn:hover {
    color: #374151;
  }

  .tab-btn.active {
    color: #6c63ff;
    border-bottom-color: #6c63ff;
  }

  .tab-content {
    min-height: 0;
  }
</style>
