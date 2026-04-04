<script lang="ts" generics="T extends { id: string; status: string }">
  import type { Snippet } from 'svelte'
  import GenericKanbanColumn from './GenericKanbanColumn.svelte'
  import { LoadingSpinner } from '$lib/components'

  interface ColumnDef {
    /** Unique key for this column (used as drop target identifier) */
    key: string
    /** Display label */
    label: string
    /** Status values that map to this column */
    statuses: string[]
    /** Default status to set when dropping into this column (first entry in statuses[] if omitted) */
    dropStatus?: string
    /** Accent color (CSS color value) for column header border */
    accent: string
  }

  let {
    columns,
    items,
    onDrop,
    loading = false,
    loadingMessage = 'Loading...',
    emptyMessage = 'No items yet.',
    filterBar,
    cardContent,
    defaultCollapsed = '',
    sortItems = (a: T, b: T) => {
      // Default sort: alphabetical by first string field after id and status
      const aVal = Object.values(a).find((v, i) => i > 1 && typeof v === 'string') as string ?? ''
      const bVal = Object.values(b).find((v, i) => i > 1 && typeof v === 'string') as string ?? ''
      return aVal.localeCompare(bVal)
    },
  }: {
    columns: ColumnDef[]
    items: T[]
    onDrop: (itemId: string, newStatus: string) => Promise<void>
    loading?: boolean
    loadingMessage?: string
    emptyMessage?: string
    filterBar?: Snippet
    cardContent: Snippet<[T]>
    defaultCollapsed?: string
    sortItems?: (a: T, b: T) => number
  } = $props()

  // Track which columns are collapsed
  let collapsedColumns = $state<Record<string, boolean>>({})

  // Initialize collapsed state for defaultCollapsed column
  $effect(() => {
    if (defaultCollapsed && !(defaultCollapsed in collapsedColumns)) {
      collapsedColumns[defaultCollapsed] = true
    }
  })

  // Group items into columns, synced from props
  let columnState = $state<Map<string, T[]>>(new Map())

  $effect(() => {
    const grouped = new Map<string, T[]>()
    for (const col of columns) {
      const colItems = items
        .filter(item => col.statuses.includes(item.status))
        .sort(sortItems)
      grouped.set(col.key, colItems)
    }
    columnState = grouped
  })

  function toggleCollapse(key: string) {
    collapsedColumns[key] = !collapsedColumns[key]
  }

  async function handleDrop(columnKey: string, itemId: string) {
    const col = columns.find(c => c.key === columnKey)
    if (!col) return
    const newStatus = col.dropStatus ?? col.statuses[0]

    // Check if the item is already in this column (intra-column reorder -- no-op)
    const currentItems = columnState.get(columnKey) ?? []
    if (currentItems.some(i => i.id === itemId)) return

    // Optimistic update: move item to new column locally
    const item = items.find(i => i.id === itemId)
    if (!item) return

    const previousStatus = item.status
    // Temporarily update status for local display
    ;(item as any).status = newStatus

    // Re-group to reflect the change
    const grouped = new Map<string, T[]>()
    for (const c of columns) {
      const cItems = items
        .filter(i => c.statuses.includes(i.status))
        .sort(sortItems)
      grouped.set(c.key, cItems)
    }
    columnState = grouped

    try {
      await onDrop(itemId, newStatus)
    } catch {
      // Revert on failure
      ;(item as any).status = previousStatus
      const reverted = new Map<string, T[]>()
      for (const c of columns) {
        const cItems = items
          .filter(i => c.statuses.includes(i.status))
          .sort(sortItems)
        reverted.set(c.key, cItems)
      }
      columnState = reverted
    }
  }
</script>

{#if loading}
  <div class="board-loading">
    <LoadingSpinner message={loadingMessage} />
  </div>
{:else if items.length === 0}
  <div class="board-empty">
    <p>{emptyMessage}</p>
  </div>
{:else}
  {#if filterBar}
    <div class="board-filter-bar">
      {@render filterBar()}
    </div>
  {/if}

  <div class="board-columns">
    {#each columns as col (col.key)}
      <GenericKanbanColumn
        column={col}
        items={columnState.get(col.key) ?? []}
        {cardContent}
        collapsed={collapsedColumns[col.key] ?? false}
        onToggleCollapse={() => toggleCollapse(col.key)}
        onDrop={(itemId) => handleDrop(col.key, itemId)}
      />
    {/each}
  </div>
{/if}

<style>
  .board-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--space-12, 3rem);
  }

  .board-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-12, 3rem);
    color: var(--text-muted, #6b7280);
    font-size: var(--text-base, 0.875rem);
    text-align: center;
    gap: var(--space-1, 0.25rem);
  }

  .board-empty p {
    margin: 0;
  }

  .board-filter-bar {
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .board-columns {
    display: flex;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-4, 1rem);
    flex: 1;
    overflow-x: auto;
    align-items: flex-start;
  }
</style>
