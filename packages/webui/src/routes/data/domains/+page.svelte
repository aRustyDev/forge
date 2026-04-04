<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { TabBar } from '$lib/components'
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
  <TabBar tabs={TABS} active={activeTab} onchange={switchTab} />
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

  .tab-content {
    min-height: 0;
  }
</style>
