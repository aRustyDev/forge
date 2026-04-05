<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    onclick?: () => void
    selected?: boolean
    disabled?: boolean
    children: Snippet
  }

  let {
    onclick,
    selected = false,
    disabled = false,
    children,
  }: Props = $props()
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="entry"
  class:selected
  class:disabled
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : undefined}
  onclick={onclick}
  onkeydown={(e) => {
    if (onclick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onclick()
    }
  }}
>
  {@render children()}
</div>

<style>
  .entry {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    transition: background 0.12s;
    color: var(--text-primary);
    font-size: var(--text-sm);
    border-left: 3px solid transparent;
  }

  .entry:hover {
    background: var(--color-surface-raised);
  }

  .entry.selected {
    background: var(--color-primary-subtle);
    border-left-color: var(--color-primary);
  }

  .entry.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
</style>
