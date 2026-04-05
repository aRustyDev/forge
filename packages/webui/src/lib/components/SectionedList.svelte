<script lang="ts">
  import type { Snippet } from 'svelte'

  export interface SectionDef {
    title: string
    count?: number
    items: unknown[]
    icon?: string
  }

  interface Props {
    sections: SectionDef[]
    renderItem: Snippet<[item: unknown]>
    emptyMessage?: string
    hideWhenEmpty?: boolean
  }

  let {
    sections,
    renderItem,
    emptyMessage = 'No items',
    hideWhenEmpty = false,
  }: Props = $props()
</script>

<div class="sectioned-list">
  {#each sections as section (section.title)}
    {#if !hideWhenEmpty || section.items.length > 0}
      <div class="sectioned-list__section">
        <div class="sectioned-list__header">
          {#if section.icon}
            <span class="sectioned-list__icon">{section.icon}</span>
          {/if}
          <span class="sectioned-list__title">{section.title}</span>
          {#if section.count !== undefined}
            <span class="count-badge">{section.count}</span>
          {/if}
        </div>
        {#if section.items.length > 0}
          <div class="sectioned-list__items">
            {#each section.items as item}
              {@render renderItem(item)}
            {/each}
          </div>
        {:else}
          <p class="sectioned-list__empty">{emptyMessage}</p>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  .sectioned-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .sectioned-list__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }

  .sectioned-list__title {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .sectioned-list__items {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sectioned-list__empty {
    font-size: var(--text-sm);
    color: var(--text-faint);
    font-style: italic;
    padding: var(--space-2) 0;
  }
</style>
