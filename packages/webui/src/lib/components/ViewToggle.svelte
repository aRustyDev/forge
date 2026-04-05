<script lang="ts">
  let { mode, onchange }: {
    mode: 'list' | 'board'
    onchange: (mode: 'list' | 'board') => void
  } = $props()
</script>

<div class="view-toggle" role="radiogroup" aria-label="View mode">
  <button
    class="toggle-btn"
    class:active={mode === 'list'}
    type="button"
    role="radio"
    aria-checked={mode === 'list'}
    onclick={() => onchange('list')}
  >
    List
  </button>
  <button
    class="toggle-btn"
    class:active={mode === 'board'}
    type="button"
    role="radio"
    aria-checked={mode === 'board'}
    onclick={() => onchange('board')}
  >
    Board
  </button>
</div>

<style>
  .view-toggle {
    display: inline-flex;
    border: 1px solid var(--color-border-strong, #d1d5db);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
  }

  .toggle-btn {
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    border: none;
    background: var(--color-surface, #ffffff);
    color: var(--text-muted, #6b7280);
    font-size: var(--text-sm, 0.8rem);
    font-weight: var(--font-medium, 500);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .toggle-btn:not(:last-child) {
    border-right: 1px solid var(--color-border-strong, #d1d5db);
  }

  .toggle-btn.active {
    background: var(--color-primary, #6c63ff);
    color: var(--text-inverse, #ffffff);
  }

  .toggle-btn:hover:not(.active) {
    background: var(--color-ghost, #f3f4f6);
  }
</style>
