<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    onNew?: () => void
    newLabel?: string
    actions?: Snippet
  }

  let { title, onNew, newLabel = '+ New', actions }: Props = $props()
</script>

<div class="list-panel-header">
  <h2 class="list-panel-header__title">{title}</h2>
  {#if actions || onNew}
    <div class="list-panel-header__actions">
      {#if actions}
        {@render actions()}
      {/if}
      {#if onNew}
        <button
          class="list-panel-header__new-btn"
          type="button"
          onclick={onNew}
        >
          {newLabel}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .list-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-5) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    gap: var(--space-2);
  }

  .list-panel-header__title {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .list-panel-header__actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .list-panel-header__new-btn {
    padding: 0.35rem var(--space-3);
    background: var(--color-primary);
    color: var(--text-inverse);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .list-panel-header__new-btn:hover {
    background: var(--color-primary-hover);
  }

  .list-panel-header__new-btn:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }
</style>
