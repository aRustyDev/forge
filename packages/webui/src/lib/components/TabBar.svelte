<script lang="ts">
  import type { Snippet } from 'svelte'

  export interface TabItem {
    value: string
    label: string
  }

  interface Props {
    tabs: TabItem[]
    active: string
    onchange: (value: string) => void
    tab?: Snippet<[{ tab: TabItem; active: boolean }]>
  }

  let { tabs, active, onchange, tab: tabSnippet }: Props = $props()

  let tabRefs: HTMLButtonElement[] = $state([])

  function handleClick(value: string) {
    if (value !== active) {
      onchange(value)
    }
  }

  function handleKeydown(e: KeyboardEvent, index: number) {
    let targetIndex = -1

    switch (e.key) {
      case 'ArrowRight':
        targetIndex = (index + 1) % tabs.length
        break
      case 'ArrowLeft':
        targetIndex = (index - 1 + tabs.length) % tabs.length
        break
      case 'Home':
        targetIndex = 0
        break
      case 'End':
        targetIndex = tabs.length - 1
        break
      default:
        return
    }

    e.preventDefault()
    tabRefs[targetIndex]?.focus()
  }
</script>

<nav class="tab-bar" role="tablist" aria-label="Tabs">
  {#each tabs as t, i (t.value)}
    <button
      bind:this={tabRefs[i]}
      class="tab-bar-btn"
      class:active={active === t.value}
      role="tab"
      aria-selected={active === t.value}
      tabindex={active === t.value ? 0 : -1}
      onclick={() => handleClick(t.value)}
      onkeydown={(e) => handleKeydown(e, i)}
    >
      {#if tabSnippet}
        {@render tabSnippet({ tab: t, active: active === t.value })}
      {:else}
        {t.label}
      {/if}
    </button>
  {/each}
</nav>

<style>
  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--space-6);
  }

  .tab-bar-btn {
    padding: var(--space-3) var(--space-4);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .tab-bar-btn:hover {
    color: var(--text-secondary);
  }

  .tab-bar-btn:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: -2px;
    border-radius: var(--radius-sm);
  }

  .tab-bar-btn.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }
</style>
