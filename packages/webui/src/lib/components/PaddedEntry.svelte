<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    onclick?: () => void
    selected?: boolean
    disabled?: boolean
    variant?: 'default' | 'template'
    children: Snippet
  }

  let {
    onclick,
    selected = false,
    disabled = false,
    variant = 'default',
    children,
  }: Props = $props()
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="padded-entry"
  class:selected
  class:disabled
  class:padded-entry--template={variant === 'template'}
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
  .padded-entry {
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: box-shadow 0.12s, border-color 0.12s;
  }

  .padded-entry:hover {
    box-shadow: var(--shadow-sm);
    border-color: var(--color-border-strong);
  }

  .padded-entry.selected {
    border-left: 3px solid var(--color-primary);
    padding-left: calc(var(--space-4) - 2px);
    background: var(--color-primary-subtle);
  }

  .padded-entry.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .padded-entry--template {
    border-color: var(--color-template-border);
    background: var(--color-template-bg);
  }
</style>
