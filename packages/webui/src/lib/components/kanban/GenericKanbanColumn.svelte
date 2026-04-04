<script lang="ts" generics="T extends { id: string }">
  import type { Snippet } from 'svelte'
  import { dndzone } from 'svelte-dnd-action'

  interface ColumnDef {
    key: string
    label: string
    statuses: string[]
    dropStatus?: string
    accent: string
  }

  let {
    column,
    items,
    cardContent,
    collapsed = false,
    onToggleCollapse,
    onDrop,
  }: {
    column: ColumnDef
    items: (T & { id: string })[]
    cardContent: Snippet<[T]>
    collapsed?: boolean
    onToggleCollapse?: () => void
    onDrop: (itemId: string) => void
  } = $props()

  let localItems = $state<(T & { id: string })[]>([])

  $effect(() => {
    localItems = [...items]
  })

  function handleConsider(e: CustomEvent) {
    localItems = e.detail.items
  }

  function handleFinalize(e: CustomEvent) {
    localItems = e.detail.items
    // Identify which items are new to this column
    const originalIds = new Set(items.map(i => i.id))
    const newItems = localItems.filter(i => !originalIds.has(i.id))
    for (const item of newItems) {
      onDrop(item.id)
    }
  }

  const flipDurationMs = 200
</script>

{#if collapsed}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="column-collapsed"
    style:border-top-color={column.accent}
    onclick={onToggleCollapse}
    role="button"
    tabindex="0"
    onkeydown={(e) => { if (e.key === 'Enter') onToggleCollapse?.() }}
  >
    <span class="collapsed-label">{column.label}</span>
    <span class="collapsed-count">{items.length}</span>
  </div>
{:else}
  <div class="column" style:border-top-color={column.accent}>
    <div class="column-header">
      <h3 class="column-label">{column.label}</h3>
      <span class="column-count">{localItems.length}</span>
      {#if onToggleCollapse}
        <button class="collapse-btn" onclick={onToggleCollapse} title="Collapse">
          &#x2715;
        </button>
      {/if}
    </div>

    <div
      class="column-body"
      use:dndzone={{ items: localItems, flipDurationMs, dropTargetStyle: { outline: `2px dashed ${column.accent}` } }}
      onconsider={handleConsider}
      onfinalize={handleFinalize}
    >
      {#each localItems as item (item.id)}
        <div class="kanban-card-wrapper">
          {@render cardContent(item)}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .column {
    flex: 0 0 auto;
    width: 280px;
    min-width: 220px;
    max-width: 320px;
    border-top: 3px solid;
    background: var(--color-surface-raised, #f9fafb);
    border-radius: var(--radius-md, 6px);
  }

  .column-header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.4rem);
    padding: var(--space-3, 0.6rem) var(--space-3, 0.75rem);
    background: var(--color-surface, #fff);
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    position: sticky;
    top: 0;
    z-index: 10;
    border-radius: var(--radius-md, 6px) var(--radius-md, 6px) 0 0;
  }

  .column-label {
    font-size: var(--text-sm, 0.8rem);
    font-weight: var(--font-bold, 700);
    color: var(--text-primary, #1a1a2e);
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
    padding: 0 var(--space-1, 0.3rem);
    background: var(--color-border, #e5e7eb);
    color: var(--text-secondary, #374151);
    border-radius: var(--radius-full, 999px);
    font-size: var(--text-xs, 0.7rem);
    font-weight: var(--font-semibold, 600);
  }

  .collapse-btn {
    background: none;
    border: none;
    color: var(--text-faint, #9ca3af);
    cursor: pointer;
    font-size: var(--text-xs, 0.7rem);
    padding: 0.15rem;
    border-radius: var(--radius-sm, 3px);
    line-height: 1;
  }

  .collapse-btn:hover {
    color: var(--text-secondary, #374151);
    background: var(--color-surface-sunken, #f3f4f6);
  }

  .column-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2, 0.5rem);
    min-height: 60px;
  }

  .kanban-card-wrapper {
    margin-bottom: var(--space-1, 0.35rem);
  }

  .column-collapsed {
    width: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2, 0.5rem);
    background: var(--color-surface-sunken, #f3f4f6);
    border-top: 3px solid;
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    transition: background 0.12s;
    padding: var(--space-4, 1rem) 0;
    min-height: 200px;
  }

  .column-collapsed:hover {
    background: var(--color-border, #e5e7eb);
  }

  .collapsed-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: var(--text-sm, 0.75rem);
    font-weight: var(--font-semibold, 600);
    color: var(--text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .collapsed-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.4rem;
    height: 1.4rem;
    background: var(--color-border-strong, #d1d5db);
    color: var(--text-secondary, #374151);
    border-radius: var(--radius-full, 999px);
    font-size: var(--text-xs, 0.65rem);
    font-weight: var(--font-semibold, 600);
  }
</style>
