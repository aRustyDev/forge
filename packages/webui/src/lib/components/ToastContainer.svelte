<script lang="ts">
  import { getToasts, removeToast } from '$lib/stores/toast.svelte'
  import Toast from './Toast.svelte'

  let toasts = $derived(getToasts())
</script>

<div class="toast-container" aria-live="polite">
  {#each toasts as toast (toast.id)}
    <Toast
      message={toast.message}
      type={toast.type}
      onclose={() => removeToast(toast.id)}
    />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
  }

  .toast-container :global(.toast) {
    pointer-events: auto;
  }
</style>
