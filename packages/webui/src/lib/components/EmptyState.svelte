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
    <button class="action-btn" onclick={onaction}>
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
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .description {
    font-size: 0.9rem;
    color: #6b7280;
    max-width: 320px;
    margin-bottom: 1.25rem;
  }

  .action-btn {
    padding: 0.5rem 1.25rem;
    background: #6c63ff;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .action-btn:hover {
    background: #5a52e0;
  }
</style>
