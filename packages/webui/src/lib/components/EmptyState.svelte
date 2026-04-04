<script lang="ts">
  let { title, description, action, onaction }: {
    title: string
    description: string
    action?: string
    onaction?: () => void
  } = $props()
</script>

<div class="empty-state">
  <h3 class="title">{title}</h3>
  <p class="description">{description}</p>
  {#if action && onaction}
    <button class="btn btn-primary" onclick={onaction}>
      {action}
    </button>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    text-align: center;
  }

  .title {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
  }

  .description {
    font-size: 0.9rem;
    color: var(--text-muted);
    max-width: 320px;
    margin-bottom: var(--space-5);
  }
</style>
