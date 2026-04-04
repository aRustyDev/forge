<script lang="ts">
  interface Props {
    message?: string
    actionLabel?: string
    onAction?: () => void
  }

  let {
    message = 'Select an item to view details.',
    actionLabel,
    onAction,
  }: Props = $props()
</script>

<div class="empty-panel">
  <p class="empty-panel-message">{message}</p>
  {#if actionLabel}
    <button class="empty-panel-action" type="button" onclick={onAction}>
      {actionLabel}
    </button>
  {/if}
</div>

<style>
  .empty-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--space-8);
    gap: var(--space-3);
  }

  .empty-panel-message {
    font-size: var(--text-sm);
    color: var(--text-muted);
    text-align: center;
    line-height: var(--leading-normal);
  }

  .empty-panel-action {
    padding: var(--space-2) var(--space-4);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .empty-panel-action:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .empty-panel-action:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }
</style>
