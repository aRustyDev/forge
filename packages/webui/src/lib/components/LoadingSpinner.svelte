<script lang="ts">
  let { size = 'md', message }: {
    size?: 'sm' | 'md' | 'lg'
    message?: string
  } = $props()

  const sizeMap: Record<string, string> = {
    sm: '16px',
    md: '24px',
    lg: '32px',
  }

  let dimension = $derived(sizeMap[size] ?? sizeMap.md)
</script>

<div class="spinner-wrapper">
  <div
    class="spinner"
    style:width={dimension}
    style:height={dimension}
    role="status"
    aria-label="Loading"
  ></div>
  {#if message}
    <p class="message">{message}</p>
  {/if}
</div>

<style>
  .spinner-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .spinner {
    border: 3px solid #e5e7eb;
    border-top-color: #6c63ff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .message {
    font-size: 0.85rem;
    color: #6b7280;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
