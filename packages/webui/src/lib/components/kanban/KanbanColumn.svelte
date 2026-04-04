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
    background: var(--color-surface-raised);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .column-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }

  .column-label {
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    color: var(--text-primary);
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
    background: var(--color-border);
    color: var(--text-secondary);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
  }

  .collapse-btn {
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.7rem;
    padding: 0.15rem;
    border-radius: var(--radius-sm);
    line-height: 1;
  }

  .collapse-btn:hover {
    color: var(--text-secondary);
    background: var(--color-surface-sunken);
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
    background: var(--color-surface-sunken);
    border-top: 3px solid;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.12s;
    padding: 1rem 0;
    min-height: 200px;
  }

  .column-collapsed:hover {
    background: var(--color-border);
  }

  .collapsed-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 0.75rem;
    font-weight: var(--font-semibold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .collapsed-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.4rem;
    height: 1.4rem;
    background: var(--color-border-strong);
    color: var(--text-secondary);
    border-radius: var(--radius-full);
    font-size: 0.65rem;
    font-weight: var(--font-semibold);
  }
</style>
