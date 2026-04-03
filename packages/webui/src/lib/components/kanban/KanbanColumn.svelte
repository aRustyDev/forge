<script lang="ts">
  import { dndzone } from 'svelte-dnd-action'
  import KanbanCard from './KanbanCard.svelte'
  import type { Organization } from '@forge/sdk'

  let {
    label,
    accent,
    items,
    collapsed = false,
    onToggleCollapse,
    onDrop,
    onCardClick,
  }: {
    label: string
    accent: string
    items: (Organization & { id: string })[]
    collapsed?: boolean
    onToggleCollapse?: () => void
    onDrop: (orgId: string) => void
    onCardClick: (orgId: string) => void
  } = $props()

  let localItems = $state<(Organization & { id: string })[]>([])

  $effect(() => {
    localItems = [...items]
  })

  function handleConsider(e: CustomEvent) {
    localItems = e.detail.items
  }

  function handleFinalize(e: CustomEvent) {
    localItems = e.detail.items
    // Identify which items are new to this column by comparing with the original items
    const originalIds = new Set(items.map(i => i.id))
    const newItems = localItems.filter(i => !originalIds.has(i.id))
    for (const item of newItems) {
      onDrop(item.id)
    }
    // Intra-column reorder: not supported (no position field in schema).
    // The card will visually snap back to its alphabetical position on the next render cycle.
    // Silently ignore — no onDrop call needed.
  }

  const flipDurationMs = 200
</script>

{#if collapsed}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="column-collapsed"
    style:border-top-color={accent}
    onclick={onToggleCollapse}
    role="button"
    tabindex="0"
    onkeydown={(e) => { if (e.key === 'Enter') onToggleCollapse?.() }}
  >
    <span class="collapsed-label">{label}</span>
    <span class="collapsed-count">{items.length}</span>
  </div>
{:else}
  <div class="column" style:border-top-color={accent}>
    <div class="column-header">
      <h3 class="column-label">{label}</h3>
      <span class="column-count">{localItems.length}</span>
      {#if onToggleCollapse}
        <button class="collapse-btn" onclick={onToggleCollapse} title="Collapse">
          &#x2715;
        </button>
      {/if}
    </div>

    <div
      class="column-body"
      use:dndzone={{ items: localItems, flipDurationMs, dropTargetStyle: { outline: `2px dashed ${accent}` } }}
      onconsider={handleConsider}
      onfinalize={handleFinalize}
    >
      {#each localItems as item (item.id)}
        <KanbanCard org={item} onclick={() => onCardClick(item.id)} />
      {/each}
    </div>
  </div>
{/if}

<style>
  .column {
    flex: 1;
    min-width: 220px;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    border-top: 3px solid;
    background: #f9fafb;
    border-radius: 6px;
    overflow: hidden;
  }

  .column-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem;
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
  }

  .column-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: #1a1a2e;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex: 1;
    margin: 0;
  }

  .column-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.4rem;
    height: 1.4rem;
    padding: 0 0.3rem;
    background: #e5e7eb;
    color: #374151;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .collapse-btn {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 0.7rem;
    padding: 0.15rem;
    border-radius: 3px;
    line-height: 1;
  }

  .collapse-btn:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .column-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    min-height: 60px;
  }

  .column-collapsed {
    width: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: #f3f4f6;
    border-top: 3px solid;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s;
    padding: 1rem 0;
    min-height: 200px;
  }

  .column-collapsed:hover {
    background: #e5e7eb;
  }

  .collapsed-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .collapsed-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.4rem;
    height: 1.4rem;
    background: #d1d5db;
    color: #374151;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 600;
  }
</style>
