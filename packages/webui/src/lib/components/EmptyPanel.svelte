<script lang="ts">
  interface Props {
    message?: string
  }

  let {
    message = 'Select an item to view details.',
  }: Props = $props()
</script>

<div class="empty-panel">
  <p class="empty-panel__message">{message}</p>
</div>

<style>
  .empty-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-faint);
    font-size: var(--text-sm);
    font-style: italic;
  }

  .empty-panel__message {
    text-align: center;
    line-height: var(--leading-normal);
  }
</style>
